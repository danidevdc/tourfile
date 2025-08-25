
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileSpreadsheet, ArrowRight, ClipboardList, Settings, Search, Plane, Calendar, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth"; 
import { useToast } from "@/hooks/use-toast"; 
import { version } from '../../package.json';
import { useState } from "react";
import { findFlight } from "@/ai/flows/find-flight-flow";
import type { FindFlightOutput } from "@/ai/flows/flight-types";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";


function FlightSearchCard() {
  const [flightNumber, setFlightNumber] = useState('');
  const [flightDate, setFlightDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<FindFlightOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        // The transferType is not relevant for this general search, but the function requires it.
        // We can set a default or adapt the function signature later if needed.
        transferType: 'TRF IN' 
      });
      if (!result.flightFound) {
        setError("Vuelo no encontrado. Verifica los datos e intenta de nuevo.");
      }
      setSearchResult(result);
    } catch (e) {
      console.error(e);
      setError("Ocurrió un error al buscar el vuelo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full shadow-lg rounded-xl mt-6 border-primary/20">
       <CardHeader>
        <CardTitle className="text-2xl font-bold text-primary flex items-center gap-3">
          <Plane className="h-8 w-8" />
          Buscador de Vuelos
        </CardTitle>
        <CardDescription>
          Ingresa un número de vuelo y fecha para obtener su estado.
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
            onChange={(e) => setFlightDate(e.target.value)}
            className="w-full sm:w-auto"
          />
          <Button onClick={handleSearch} disabled={isLoading || !flightNumber || !flightDate} className="w-full sm:w-auto">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Buscar
          </Button>
        </div>
        {error && (
          <div className="mt-4 text-sm text-destructive bg-destructive/10 p-3 rounded-md flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}
        {searchResult?.flightFound && (
           <div className="mt-4 text-sm text-primary-foreground bg-primary/90 p-4 rounded-lg space-y-2">
              <p className="font-bold text-lg">{searchResult.airline}</p>
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


export default function HomePage() {
  const { isCurrentUserAdmin, isLoading: authLoading } = useAuth(); 
  const { toast } = useToast(); 

  const appVersion = process.env.NEXT_PUBLIC_APP_ENV && process.env.NEXT_PUBLIC_APP_ENV !== "production"
    ? `${version}-${process.env.NEXT_PUBLIC_APP_ENV}`
    : version;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-2xl shadow-lg rounded-xl">
        <CardContent className="p-10">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold text-primary">
              Bienvenido!
            </h1>
            <p className="text-xl text-muted-foreground mt-2">
              Selecciona una opción
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Link href="/city-selection" passHref>
              <Button
                variant="default"
                className="w-full h-auto py-8 text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 group"
              >
                <FileSpreadsheet className="h-12 w-12 mr-6 text-primary-foreground transition-transform duration-300 group-hover:scale-105 shrink-0" />
                <div className="text-left flex-grow">
                  <span className="block text-2xl font-bold text-primary-foreground">
                    Generar Caja Chica
                  </span>
                </div>
                <ArrowRight className="h-8 w-8 ml-auto text-primary-foreground/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
              </Button>
            </Link>

            <Link href="/service-order" passHref>
              <Button
                className="w-full h-auto py-8 text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 group bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <ClipboardList className="h-12 w-12 mr-6 transition-transform duration-300 group-hover:scale-105 shrink-0" />
                <div className="text-left flex-grow">
                  <span className="block text-2xl font-bold">
                    Generar Órdenes de Servicio
                  </span>
                </div>
                <ArrowRight className="h-8 w-8 ml-auto text-accent-foreground/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
              </Button>
            </Link>

            {!authLoading && isCurrentUserAdmin && (
               <Link href="/admin/dashboard" passHref>
                 <Button
                  variant="secondary" 
                  className="w-full h-auto py-8 text-lg flex flex-row items-center justify-start shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl px-8 group"
                >
                  <Settings className="h-12 w-12 mr-6 text-secondary-foreground transition-transform duration-300 group-hover:scale-105 shrink-0" />
                  <div className="text-left flex-grow">
                    <span className="block text-2xl font-bold text-secondary-foreground">
                      Administrar
                    </span>
                     <span className="block text-sm font-normal text-secondary-foreground/80">
                      Gestionar datos, lógica y usuarios
                    </span>
                  </div>
                  <ArrowRight className="h-8 w-8 ml-auto text-secondary-foreground/70 transition-transform duration-300 group-hover:translate-x-1 shrink-0" />
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      <FlightSearchCard />

       <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} TourFile Generator. Todos los derechos reservados. (Versión: {appVersion})</p>
      </footer>
    </div>
  );
}
