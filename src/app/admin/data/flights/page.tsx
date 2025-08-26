
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, AlertTriangle, RefreshCw, Trash2, PlaneTakeoff, PlaneLanding, Plane } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

import { 
  getFlightsForDate, 
  triggerSyncBasedOnSchedule, 
  deleteOldFlights, 
  type StoredFlight 
} from '@/lib/flightSyncService';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function ManageFlightsPage() {
  const { isCurrentUserAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [flights, setFlights] = useState<StoredFlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    if (!authLoading && !isCurrentUserAdmin) {
      toast({ title: "Acceso Denegado", description: "No tienes permisos para acceder.", variant: "destructive" });
      router.replace('/');
    }
  }, [authLoading, isCurrentUserAdmin, router, toast]);

  useEffect(() => {
    async function fetchFlights() {
      if (isCurrentUserAdmin) {
        setIsLoading(true);
        try {
          const dateString = format(selectedDate, 'yyyy-MM-dd');
          const fetchedFlights = await getFlightsForDate(dateString);
          setFlights(fetchedFlights);
        } catch (error) {
          console.error("Error loading flights:", error);
          toast({ title: "Error", description: "No se pudieron cargar los vuelos.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      }
    }
    if (!authLoading) {
        fetchFlights();
    }
  }, [isCurrentUserAdmin, authLoading, toast, selectedDate]);
  
  const handleSync = async () => {
    setIsSyncing(true);
    toast({ title: "Iniciando Sincronización", description: "Contactando a la API de AviationStack..." });
    try {
      const results = await triggerSyncBasedOnSchedule();
      results.forEach(res => toast({ title: "Resultado de Sincronización", description: res, duration: 7000, className: "bg-green-100 dark:bg-green-900 border-green-500"}));
    } catch (error: any) {
       toast({ title: "Error de Sincronización", description: error.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteOldFlights();
      toast({ title: "Limpieza Completada", description: result, className: "bg-green-100 dark:bg-green-900 border-green-500" });
    } catch(error: any) {
        toast({ title: "Error de Limpieza", description: error.message, variant: "destructive" });
    } finally {
        setIsDeleting(false);
    }
  }
  
  const formatTime = (date?: Date) => date ? format(new Date(date), 'HH:mm') : '---';

  const { arrivals, departures } = useMemo(() => {
    const arrivals = flights.filter(f => f.type === 'arrival').sort((a, b) => a.arrival.scheduled.getTime() - b.arrival.scheduled.getTime());
    const departures = flights.filter(f => f.type === 'departure').sort((a,b) => a.departure.scheduled.getTime() - b.departure.scheduled.getTime());
    return { arrivals, departures };
  }, [flights]);


  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8 space-y-6">
      <div className="w-full max-w-7xl">
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <Card className="w-full max-w-7xl shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
              <CardTitle className="text-2xl font-headline text-primary">Gestión de Vuelos Sincronizados</CardTitle>
              <CardDescription>Visualiza y gestiona los datos de vuelos guardados en la base de datos.</CardDescription>
            </div>
            <div className="flex gap-2 mt-4 sm:mt-0">
               <Button onClick={handleDelete} variant="outline" disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                  Limpiar Antiguos
                </Button>
                <Button onClick={handleSync} disabled={isSyncing}>
                  {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                  Sincronizar Vuelos
                </Button>
            </div>
        </CardHeader>
        <CardContent>
           <div className="mb-4">
              <Label htmlFor="flight-date-picker">Seleccionar Fecha:</Label>
              <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="flight-date-picker"
                        variant={"outline"}
                        className={cn("w-[280px] justify-start text-left font-normal ml-2", !selectedDate && "text-muted-foreground")}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
           </div>
          {isLoading ? (
             <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FlightTable title="Llegadas a LPB" flights={arrivals} type="arrival" formatTime={formatTime} />
                <FlightTable title="Salidas de LPB" flights={departures} type="departure" formatTime={formatTime} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface FlightTableProps {
    title: string;
    flights: StoredFlight[];
    type: 'arrival' | 'departure';
    formatTime: (date?: Date) => string;
}

const FlightTable: React.FC<FlightTableProps> = ({ title, flights, type, formatTime }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
                {type === 'arrival' ? <PlaneLanding className="text-primary"/> : <PlaneTakeoff className="text-primary"/>}
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="border rounded-lg max-h-96 overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vuelo</TableHead>
                            <TableHead>{type === 'arrival' ? 'Origen' : 'Destino'}</TableHead>
                            <TableHead>Prog.</TableHead>
                            <TableHead>Real</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {flights.length > 0 ? flights.map(flight => (
                            <TableRow key={flight.id}>
                                <TableCell className="font-medium">{flight.flight.iata}</TableCell>
                                <TableCell>{type === 'arrival' ? flight.departure.iata : flight.arrival.iata}</TableCell>
                                <TableCell>{formatTime(type === 'arrival' ? flight.arrival.scheduled : flight.departure.scheduled)}</TableCell>
                                <TableCell className="font-semibold text-green-600 dark:text-green-400">{formatTime(type === 'arrival' ? flight.arrival.actual : flight.departure.actual)}</TableCell>
                            </TableRow>
                        )) : (
                           <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No hay vuelos de {type === 'arrival' ? 'llegada' : 'salida'} para esta fecha.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
);
