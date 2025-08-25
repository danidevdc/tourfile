
"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Plane, Search, AlertTriangle, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, parse } from "date-fns";
import { findFlight } from "@/ai/flows/find-flight-flow";
import type { FindFlightOutput } from "@/ai/flows/flight-types";
import { useAuth } from "@/hooks/useAuth";

function FlightSearchCard() {
  const [flightNumber, setFlightNumber] = useState('');
  const [flightDate, setFlightDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<FindFlightOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const parsedDate = parse(e.target.value, 'yyyy-MM-dd', new Date());
      setFlightDate(format(parsedDate, 'yyyy-MM-dd'));
    } catch {
      // Ignore invalid date formats during input
    }
  };

  const handleSearch = async () => {
    if (!flightNumber || !flightDate) {
      setError("Por favor, ingresa el número de vuelo y la fecha.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    try {
      const result = await findFlight({
        flightNumber,
        date: flightDate,
        transferType: 'TRF IN' 
      });
      if (!result.flightFound) {
        setError(`Vuelo ${flightNumber} no encontrado para la fecha seleccionada. Verifica los datos e intenta de nuevo.`);
      }
      setSearchResult(result);
    } catch (e) {
      console.error(e);
      setError("Ocurrió un error al buscar el vuelo. Revisa la consola para más detalles.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-lg rounded-xl mt-6 border-primary/20">
       <CardHeader>
        <CardTitle className="text-2xl font-bold text-primary flex items-center gap-3">
          <Plane className="h-8 w-8" />
          Buscador de Vuelos (Prueba de IA)
        </CardTitle>
        <CardDescription>
          Ingresa un número de vuelo y fecha para obtener su estado. La IA buscará en la web para encontrar los detalles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Input 
            type="text" 
            placeholder="Ej: OB305" 
            value={flightNumber} 
            onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
            className="flex-grow"
          />
          <Input 
            type="date"
            value={flightDate}
            onChange={handleDateChange}
            className="w-full sm:w-auto"
            required
          />
          <Button onClick={handleSearch} disabled={isLoading || !flightNumber || !flightDate} className="w-full sm:w-auto">
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
           <div className="mt-4 text-sm text-card-foreground bg-green-100 dark:bg-green-900/30 p-4 rounded-lg space-y-2 border border-green-500">
              <p className="font-bold text-lg text-green-800 dark:text-green-200">{searchResult.airline}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                <p><strong>Sale:</strong> {searchResult.departure?.airport.code} a las {searchResult.departure?.time.scheduled}</p>
                <p><strong>Llega:</strong> {searchResult.arrival?.airport.code} a las {searchResult.arrival?.time.scheduled}</p>
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

    useEffect(() => {
        if (!isLoading && !isCurrentUserAdmin) {
            router.replace('/');
        }
    }, [isLoading, isCurrentUserAdmin, router]);

    if (isLoading || !isCurrentUserAdmin) {
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
