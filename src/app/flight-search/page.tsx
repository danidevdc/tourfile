
"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Plane, Search, AlertTriangle, ArrowLeft, Calendar as CalendarIcon, PlaneTakeoff, PlaneLanding, GaugeCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { findFlight } from "@/ai/flows/find-flight-flow";
import type { FindFlightOutput, FindFlightInput } from "@/ai/flows/flight-types";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getApiUsageStats, checkAndIncrementApiUsage, type ApiUsageStats } from '@/lib/apiUsageService';

function ApiUsageStatusCard({ usageStats, isLoading }: { usageStats: ApiUsageStats | null, isLoading: boolean }) {
  return (
    <Card className="w-full max-w-2xl shadow-lg rounded-xl mt-6 border-primary/20">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <GaugeCircle className="text-primary"/> Uso de API (AeroAPI)
        </CardTitle>
        <CardDescription>Consultas a la API de FlightAware. Los contadores se resetean según el periodo.</CardDescription>
      </CardHeader>
      <CardContent>
         {isLoading ? (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
         ) : usageStats ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium text-muted-foreground">Minuto</span>
                <span className="font-bold text-2xl text-foreground">{usageStats.minute}</span>
              </div>
              <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium text-muted-foreground">Hora</span>
                <span className="font-bold text-2xl text-foreground">{usageStats.hour}</span>
              </div>
               <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium text-muted-foreground">Día (UTC)</span>
                <span className="font-bold text-2xl text-foreground">{usageStats.day}</span>
              </div>
              <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium text-muted-foreground">Mes (UTC)</span>
                <span className="font-bold text-2xl text-foreground">{usageStats.month}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center items-center h-48">
                <p className="text-muted-foreground">No hay datos de uso de API.</p>
            </div>
          )}
      </CardContent>
    </Card>
  );
}


function FlightSearchCard({ onSearchSuccess }: { onSearchSuccess: () => void }) {
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
    
    // Increment counter on button click, before doing anything else.
    await checkAndIncrementApiUsage('AeroAPI');
    
    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    
    try {
      const flightDataPayload: FindFlightInput = {
        flightNumber,
        date: format(date, 'yyyy-MM-dd'),
      };
      
      const result = await findFlight(flightDataPayload);
      
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
      onSearchSuccess(); // Callback to refresh stats
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
                    placeholder="Ej: AAL923, OB305" 
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
           <div className="mt-6 text-sm text-card-foreground bg-green-50 dark:bg-green-900/20 p-4 rounded-lg space-y-4 border border-green-200 dark:border-green-800">
              <h3 className="font-bold text-lg text-green-800 dark:text-green-200 text-center">Vuelo Encontrado: {searchResult.flightNumber}</h3>
              <div className="flex items-center text-base">
                  {/* --- Departure --- */}
                  <div className="w-5/12 text-center">
                    <PlaneTakeoff className="mx-auto h-6 w-6 text-muted-foreground mb-1"/>
                    <p className="font-bold text-2xl text-foreground">{searchResult.departure?.airport.code}</p>
                    <p className="font-mono text-3xl font-bold text-primary">{searchResult.departure?.time.scheduled}</p>
                    <p className="text-xs text-muted-foreground truncate">{searchResult.departure?.airport.city}</p>
                  </div>
                  
                  {/* --- Flight Path --- */}
                  <div className="w-2/12 flex items-center justify-center">
                     <div className="w-full flex items-center">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/50"></span>
                        <div className="flex-grow border-b-2 border-dotted border-muted-foreground/50"></div>
                        <Plane className="h-4 w-4 text-muted-foreground -ml-1 -mr-1" />
                        <div className="flex-grow border-b-2 border-dotted border-muted-foreground/50"></div>
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/50"></span>
                    </div>
                  </div>

                  {/* --- Arrival --- */}
                   <div className="w-5/12 text-center">
                    <PlaneLanding className="mx-auto h-6 w-6 text-muted-foreground mb-1"/>
                    <p className="font-bold text-2xl text-foreground">{searchResult.arrival?.airport.code}</p>
                    <p className="font-mono text-3xl font-bold text-primary">{searchResult.arrival?.time.scheduled}</p>
                    <p className="text-xs text-muted-foreground truncate">{searchResult.arrival?.airport.city}</p>
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
    const { isCurrentUserAdmin, isLoading: authLoading } = useAuth();
    
    const [apiUsage, setApiUsage] = useState<ApiUsageStats | null>(null);
    const [isUsageLoading, setIsUsageLoading] = useState(true);

    const fetchApiUsage = async () => {
        setIsUsageLoading(true);
        try {
            const stats = await getApiUsageStats('AeroAPI');
            setApiUsage(stats);
        } catch (error) {
            console.error("Failed to fetch API usage stats:", error);
            setApiUsage(null);
        } finally {
            setIsUsageLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && isCurrentUserAdmin) {
            fetchApiUsage();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, isCurrentUserAdmin]);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    // Redirect non-admins away
    if (!isCurrentUserAdmin) {
        router.replace('/');
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
                <p>Redirigiendo...</p>
                <Loader2 className="h-12 w-12 animate-spin text-primary ml-4" />
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
            <FlightSearchCard onSearchSuccess={fetchApiUsage} />
            <ApiUsageStatusCard usageStats={apiUsage} isLoading={isUsageLoading} />
        </div>
    );
}
