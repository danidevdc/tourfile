
"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Plane, Search, AlertTriangle, ArrowLeft, ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { findFlight } from "@/ai/flows/find-flight-flow";
import type { FindFlightOutput, FindFlightInput } from "@/ai/flows/flight-types";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";


function FlightSearchCard() {
  const [flightNumber, setFlightNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<FindFlightOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!flightNumber) {
      setError("Por favor, ingresa el número de vuelo.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    try {
      const flightDataPayload: FindFlightInput = {
        flightNumber,
      };
      
      console.log("[CLIENT] Calling API with:", JSON.stringify(flightDataPayload, null, 2));

      const result = await findFlight(flightDataPayload);
      
      console.log("[CLIENT] API Response:", JSON.stringify(result, null, 2));
      
      if (result.errorMessage) {
          setError(`Error del servidor: ${result.errorMessage}.`);
      } else if (!result.flightFound) {
        setError(`Vuelo ${flightNumber} no encontrado. Verifica el número.`);
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
          Buscador de Vuelos en Tiempo Real
        </CardTitle>
        <CardDescription>
          Ingresa un número de vuelo para obtener su estado actual desde la API de AviationStack (Plan Gratuito).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4">
            <div>
                 <Label htmlFor="flight-number">N° de Vuelo</Label>
                 <Input
                    id="flight-number"
                    type="text" 
                    placeholder="Ej: OB305" 
                    value={flightNumber} 
                    onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                    className="mt-1"
                  />
            </div>
        </div>
        <div className="mt-4">
             <Button onClick={handleSearch} disabled={isLoading || !flightNumber} className="w-full">
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
              <p className="font-bold text-lg text-green-800 dark:text-green-200">{searchResult.airline} - Vuelo {searchResult.flightNumber}</p>
              <div className="flex items-center text-base">
                  <div className="text-center">
                    <p className="font-bold text-xl">{searchResult.departure?.airport.code}</p>
                    <p className="text-xs">{searchResult.departure?.time.scheduled}</p>
                    <p className="text-xs text-green-600 dark:text-green-400">{searchResult.departure?.time.actual}</p>
                  </div>
                  <div className="flex-grow flex items-center justify-center mx-4">
                    <ArrowRightLeft className="h-5 w-5 text-muted-foreground"/>
                  </div>
                   <div className="text-center">
                    <p className="font-bold text-xl">{searchResult.arrival?.airport.code}</p>
                    <p className="text-xs">{searchResult.arrival?.time.scheduled}</p>
                     <p className="text-xs text-green-600 dark:text-green-400">{searchResult.arrival?.time.actual}</p>
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

    // The page is now public, so we remove the admin check redirection.
    // Anyone can search for a flight.
    
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
