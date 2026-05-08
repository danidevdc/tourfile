from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

from fli.core import build_flight_segments, parse_max_stops, parse_sort_by, resolve_airport
from fli.models import FlightSearchFilters, PassengerInfo, SeatType, TripType
from fli.search import SearchFlights


app = FastAPI(title="Tourfile Google Flights Proxy")


class FlightLookupRequest(BaseModel):
    flightNumber: str = Field(min_length=2, max_length=12)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    origin: str = Field(min_length=3, max_length=3)
    destination: str = Field(min_length=3, max_length=3)
    airlineCode: str | None = Field(default=None, min_length=2, max_length=4)
    targetDepartureTime: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    targetArrivalTime: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")


def format_date(value: Any) -> str | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    text = str(value)
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except ValueError:
        return text[:10]


def format_time(value: Any) -> str | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.strftime("%H:%M")
    text = str(value)
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).strftime("%H:%M")
    except ValueError:
        return text[11:16] if len(text) >= 16 else text


def normalize_flight_number(value: str) -> str:
    normalized = value.replace(" ", "").upper()
    if normalized.startswith("BOV") or normalized.startswith("ECO") or normalized.startswith("LAN"):
        return normalized
    if normalized.startswith("AVA"):
        return normalized.replace("AVA", "AV", 1)
    if normalized.startswith("OB"):
        return normalized.replace("OB", "BOV", 1)
    if normalized.startswith("BO"):
        return normalized.replace("BO", "BOV", 1)
    if normalized.startswith("8J"):
        return normalized.replace("8J", "ECO", 1)
    if normalized.startswith("LA"):
        return normalized.replace("LA", "LAN", 1)
    return normalized


def airline_from_flight_number(value: str) -> str:
    normalized = normalize_flight_number(value)
    prefix = ""
    for char in normalized:
        if char.isdigit():
            break
        prefix += char
    return prefix


def minutes_from_time(value: str | None) -> int | None:
    if not value:
        return None
    try:
        hour, minute = value.split(":", 1)
        return int(hour) * 60 + int(minute)
    except (TypeError, ValueError):
        return None


def time_distance_minutes(left: str | None, right: str | None) -> int | None:
    left_minutes = minutes_from_time(left)
    right_minutes = minutes_from_time(right)
    if left_minutes is None or right_minutes is None:
        return None
    direct = abs(left_minutes - right_minutes)
    return min(direct, (24 * 60) - direct)


def flight_number_variants(value: str) -> set[str]:
    normalized = normalize_flight_number(value)
    variants = {normalized}
    if normalized.startswith("BOV"):
        variants.add(f"OB{normalized[3:]}")
        variants.add(f"BO{normalized[3:]}")
        variants.add(normalized[3:])
    elif normalized.startswith("OB"):
        variants.add(f"BOV{normalized[2:]}")
        variants.add(normalized[2:])
    elif normalized.startswith("ECO"):
        variants.add(f"8J{normalized[3:]}")
        variants.add(normalized[3:])
    elif normalized.startswith("LAN"):
        variants.add(f"LA{normalized[3:]}")
        variants.add(normalized[3:])
    return {variant.replace(" ", "").upper() for variant in variants if variant}


def airline_code_variants(airline: Any) -> set[str]:
    values = {
        str(airline or ""),
        str(getattr(airline, "value", "") or ""),
        str(getattr(airline, "name", "") or ""),
    }
    normalized = {value.replace("_", "").replace(" ", "").upper() for value in values if value}
    if any("BOLIVIANA" in value or "BOA" in value or value == "BOV" for value in normalized):
        normalized.update({"BOV", "OB", "BO", "BOA"})
    if any("ECO" in value or "ECOJET" in value for value in normalized):
        normalized.update({"ECO", "8J", "ECOJET"})
    if any("LATAM" in value or value in {"LAN", "LA", "LPE"} for value in normalized):
        normalized.update({"LAN", "LA", "LPE", "LATAM"})
    if any("AVIANCA" in value or value == "AV" for value in normalized):
        normalized.update({"AV", "AVIANCA"})
    return normalized


def leg_matches(leg: Any, flight_number: str) -> bool:
    raw_number = str(getattr(leg, "flight_number", "") or "").replace(" ", "").upper()
    target_variants = flight_number_variants(flight_number)
    airline_variants = airline_code_variants(getattr(leg, "airline", None))
    candidates = {raw_number}
    candidates.update(f"{airline}{raw_number}" for airline in airline_variants)
    candidates.update(flight_number_variants(raw_number))
    return bool(target_variants.intersection(candidates))


def airline_matches(leg: Any, airline_code: str | None) -> bool:
    if not airline_code:
        return False
    target = airline_code.replace(" ", "").upper()
    variants = airline_code_variants(getattr(leg, "airline", None))
    return target in variants


def fallback_score(leg: Any, request: FlightLookupRequest, flight_number: str) -> int | None:
    airline_code = (request.airlineCode or airline_from_flight_number(flight_number)).upper()
    if not airline_matches(leg, airline_code):
        return None

    departure_time = format_time(getattr(leg, "departure_datetime", None))
    arrival_time = format_time(getattr(leg, "arrival_datetime", None))
    distances = [
        value for value in [
            time_distance_minutes(departure_time, request.targetDepartureTime),
            time_distance_minutes(arrival_time, request.targetArrivalTime),
        ] if value is not None
    ]

    if not distances:
        return 240

    best_distance = min(distances)
    return best_distance if best_distance <= 240 else None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/search-flight")
def search_flight(request: FlightLookupRequest) -> dict[str, Any]:
    flight_number = normalize_flight_number(request.flightNumber)
    origin = resolve_airport(request.origin.upper())
    destination = resolve_airport(request.destination.upper())
    segments, _trip_type = build_flight_segments(
        origin=origin,
        destination=destination,
        departure_date=request.date,
        return_date=None,
        time_restrictions=None,
    )
    filters = FlightSearchFilters(
        trip_type=TripType.ONE_WAY,
        passenger_info=PassengerInfo(adults=1),
        flight_segments=segments,
        stops=parse_max_stops("ANY"),
        seat_type=SeatType.ECONOMY,
        sort_by=parse_sort_by("DEPARTURE_TIME"),
    )

    flights = SearchFlights().search(filters, top_n=25) or []
    seen_flights: list[str] = []
    fallback_matches: list[tuple[int, Any]] = []
    for flight in flights:
        for leg in getattr(flight, "legs", []):
            airline = getattr(leg, "airline", "")
            raw_number = str(getattr(leg, "flight_number", "") or "").replace(" ", "").upper()
            seen_flights.append(f"{getattr(airline, 'value', airline)} {raw_number}".strip())
            if not leg_matches(leg, flight_number):
                continue

            departure_airport = str(getattr(leg, "departure_airport", request.origin))
            arrival_airport = str(getattr(leg, "arrival_airport", request.destination))
            return {
                "flightFound": True,
                "flightNumber": flight_number,
                "flightSegment": f"{request.origin.upper()}/{request.destination.upper()}",
                "leg": {
                    "flightNumber": flight_number,
                    "airline": str(getattr(leg, "airline", "")),
                    "origin": request.origin.upper(),
                    "originCity": departure_airport,
                    "destination": request.destination.upper(),
                    "destinationCity": arrival_airport,
                    "departureTime": format_time(getattr(leg, "departure_datetime", None)),
                    "departureDate": format_date(getattr(leg, "departure_datetime", None)),
                    "arrivalTime": format_time(getattr(leg, "arrival_datetime", None)),
                    "arrivalDate": format_date(getattr(leg, "arrival_datetime", None)),
                    },
                }

            score = fallback_score(leg, request, flight_number)
            if score is not None:
                fallback_matches.append((score, leg))

    if fallback_matches:
        fallback_matches.sort(key=lambda item: item[0])
        score, leg = fallback_matches[0]
        departure_airport = str(getattr(leg, "departure_airport", request.origin))
        arrival_airport = str(getattr(leg, "arrival_airport", request.destination))
        raw_number = str(getattr(leg, "flight_number", "") or "").replace(" ", "").upper()
        airline = getattr(leg, "airline", "")
        airline_text = str(getattr(airline, "value", airline))
        matched_flight_number = f"{airline_text}{raw_number}".replace(" ", "").upper() if raw_number else flight_number
        return {
            "flightFound": True,
            "flightNumber": matched_flight_number,
            "flightSegment": f"{request.origin.upper()}/{request.destination.upper()}",
            "matchType": "route_airline_time",
            "timeDeltaMinutes": score,
            "leg": {
                "flightNumber": matched_flight_number,
                "airline": str(getattr(leg, "airline", "")),
                "origin": request.origin.upper(),
                "originCity": departure_airport,
                "destination": request.destination.upper(),
                "destinationCity": arrival_airport,
                "departureTime": format_time(getattr(leg, "departure_datetime", None)),
                "departureDate": format_date(getattr(leg, "departure_datetime", None)),
                "arrivalTime": format_time(getattr(leg, "arrival_datetime", None)),
                "arrivalDate": format_date(getattr(leg, "arrival_datetime", None)),
            },
        }

    return {
        "flightFound": False,
        "flightNumber": flight_number,
        "errorMessage": (
            f"Google Flights no encontró {flight_number} en {request.origin.upper()}/{request.destination.upper()} "
            f"para {request.date}. Vuelos revisados: {', '.join(seen_flights[:12]) or 'ninguno'}."
        ),
    }
