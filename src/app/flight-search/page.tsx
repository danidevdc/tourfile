
"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Plane, Search, AlertTriangle, ArrowLeft, ArrowRightLeft, Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { findFlight } from "@/ai/flows/find-flight-flow";
import type { FindFlightOutput, FindFlightInput } from "@/ai/flows/flight-types";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";


function FlightSearchCard() {
  const [flightNumber, setFlightNumber] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<FindFlightOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!flightNumber || !date) {
      setError("Por favor, ingresa el número de vuelo y selecciona una fecha.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    try {
      const flightDataPayload: FindFlightInput = {
        flightNumber,
        date: format(date, 'yyyy-MM-dd'),
      };
      
      console.log("[CLIENT] Calling API with:", JSON.stringify(flightDataPayload, null, 2));

      const result = await findFlight(flightDataPayload);
      
      console.log("[CLIENT] API Response:", JSON.stringify(result, null, 2));
      
      if (result.errorMessage) {
          if (result.errorMessage.includes("No flight found for this date")) {
            setError(`No se encontró ningún vuelo para el número "${flightNumber}" en la fecha seleccionada. Por favor, verifica si el vuelo opera ese día.`);
          } else {
            setError(`Error: ${result.errorMessage}`);
          }
      } else if (!result.flightFound) {
        setError(`Vuelo ${flightNumber} no encontrado. Revisa los datos e inténtalo de nuevo.`);
      }
      setSearchResult(result);
    } catch (e) {
      console.error(e);
      setError("Ocurrió un error inesperado al buscar el vuelo. Revisa la consola para más detalles.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-lg rounded-xl mt-6 border-primary/20">
       <CardHeader>
        <CardTitle className="text-2xl font-bold text-primary flex items-center gap-3">
          <Plane className="h-8 w-8" />
          Buscador de Vuelos (AeroAPI)
        </CardTitle>
        <CardDescription>
          Ingresa un número de vuelo y una fecha para obtener su estado desde la API de FlightAware.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
                 <Label htmlFor="flight-number">N° de Vuelo</Label>
                 <Input
                    id="flight-number"
                    type="text" 
                    placeholder="Ej: AAL923, OAL305" 
                    value={flightNumber} 
                    onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                    className="mt-1"
                  />
            </div>
            <div>
              <Label htmlFor="flight-date">Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="flight-date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Selecciona una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
        </div>
        <div className="mt-6">
             <Button onClick={handleSearch} disabled={isLoading || !flightNumber || !date} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Buscar Vuelo
              </Button>
        </div>
        {error && (
          <div className="mt-4 text-sm text-destructive bg-destructive/10 p-3 rounded-md flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}
        {searchResult?.flightFound && (
           <div className="mt-6 text-sm text-card-foreground bg-green-100 dark:bg-green-900/30 p-4 rounded-lg space-y-3 border border-green-500">
              <p className="font-bold text-lg text-green-800 dark:text-green-200">Vuelo {searchResult.flightNumber}</p>
              <div className="flex items-center text-base">
                  <div className="text-center flex-1">
                    <p className="font-bold text-xl">{searchResult.departure?.airport.code}</p>
                    <p className="text-xs">{searchResult.departure?.airport.name}</p>
                    <p className="font-mono mt-1 text-sm">Sale: {searchResult.departure?.time.scheduled}</p>
                    <p className="font-mono text-xs text-green-600 dark:text-green-400">Real: {searchResult.departure?.time.actual}</p>
                  </div>
                  <div className="flex-grow-0 flex items-center justify-center mx-4">
                    <ArrowRightLeft className="h-5 w-5 text-muted-foreground"/>
                  </div>
                   <div className="text-center flex-1">
                    <p className="font-bold text-xl">{searchResult.arrival?.airport.code}</p>
                     <p className="text-xs">{searchResult.arrival?.airport.name}</p>
                    <p className="font-mono mt-1 text-sm">Llega: {searchResult.arrival?.time.scheduled}</p>
                     <p className="font-mono text-xs text-green-600 dark:text-green-400">Real: {searchResult.arrival?.time.actual}</p>
                  </div>
              </div>
           </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FlightSearchPage() {
    const router = useRouter();
    const { isCurrentUserAdmin, isLoading } = useAuth();
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="flex flex-col items-center justify-start min-h-screen p-4 bg-background pt-8">
            <div className="w-full max-w-2xl mb-4">
              <Button variant="default" size="icon" onClick={() => router.push('/')} aria-label="Go home">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </div>
            <FlightSearchCard />
        </div>
    );
}
