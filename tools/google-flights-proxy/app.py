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
    return normalized.replace("OB", "BOV", 1) if normalized.startswith("OB") else normalized


def flight_number_variants(value: str) -> set[str]:
    normalized = normalize_flight_number(value)
    variants = {normalized}
    if normalized.startswith("BOV"):
        variants.add(f"OB{normalized[3:]}")
        variants.add(normalized[3:])
    elif normalized.startswith("OB"):
        variants.add(f"BOV{normalized[2:]}")
        variants.add(normalized[2:])
    return {variant.replace(" ", "").upper() for variant in variants if variant}


def airline_code_variants(airline: Any) -> set[str]:
    values = {
        str(airline or ""),
        str(getattr(airline, "value", "") or ""),
        str(getattr(airline, "name", "") or ""),
    }
    normalized = {value.replace("_", "").replace(" ", "").upper() for value in values if value}
    if any("BOLIVIANA" in value or "BOA" in value or value == "BOV" for value in normalized):
        normalized.update({"BOV", "OB", "BOA"})
    return normalized


def leg_matches(leg: Any, flight_number: str) -> bool:
    raw_number = str(getattr(leg, "flight_number", "") or "").replace(" ", "").upper()
    target_variants = flight_number_variants(flight_number)
    airline_variants = airline_code_variants(getattr(leg, "airline", None))
    candidates = {raw_number}
    candidates.update(f"{airline}{raw_number}" for airline in airline_variants)
    candidates.update(flight_number_variants(raw_number))
    return bool(target_variants.intersection(candidates))


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

    return {
        "flightFound": False,
        "flightNumber": flight_number,
        "errorMessage": (
            f"Google Flights no encontró {flight_number} en {request.origin.upper()}/{request.destination.upper()} "
            f"para {request.date}. Vuelos revisados: {', '.join(seen_flights[:12]) or 'ninguno'}."
        ),
    }
