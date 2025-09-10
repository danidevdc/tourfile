
"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  createHotel, getHotelsFromFirestore,
  createDriver, getDriversFromFirestore,
  createActivity, getActivitiesFromFirestore,
  createGuide, getGuidesFromFirestore,
  createFlight, getFlightsFromFirestore,
  checkIfGuideExists, checkIfHotelExists, checkIfDriverExists, checkIfActivityExists, checkIfFlightExists,
  deleteGuide, deleteHotel, deleteDriver, deleteActivity, deleteFlight,
  type Hotel, type Driver, type Activity, type ServiceOrderGuide, type PredefinedFlight
} from '@/lib/serviceOrderService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, PlusCircle, Hotel as HotelIcon, Car, ListChecks, UserSquare, Plane, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type DataType = 'guides' | 'hotels' | 'drivers' | 'activities' | 'flights';
const VALID_TABS: DataType[] = ['guides', 'hotels', 'drivers', 'activities', 'flights'];
type ItemToDelete = (Hotel | Driver | Activity | ServiceOrderGuide | PredefinedFlight) & { type: DataType; name?: string; fullName?: string; flightNumber?: string; };


export default function ContributeDataPage() {
  const { isCurrentUserAdmin, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [guides, setGuides] = useState<ServiceOrderGuide[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [flights, setFlights] = useState<PredefinedFlight[]>([]);
  
  const [newItemName, setNewItemName] = useState('');
  const [newItemLastName, setNewItemLastName] = useState('');
  const [driverType, setDriverType] = useState<'propio' | 'externo'>('propio');
  
  const [newFlightNumber, setNewFlightNumber] = useState('');
  const [newFlightTime, setNewFlightTime] = useState('');
  const [newFlightObs, setNewFlightObs] = useState('');

  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);

  const initialTab = searchParams.get('tab') as DataType | null;
  const activeTab = initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'guides';

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({ title: "Acceso Denegado", description: "Debes iniciar sesión para contribuir.", variant: "destructive" });
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router, toast]);

  const fetchData = async () => {
    if (isAuthenticated) {
      setIsLoading(true);
      try {
        const [fetchedHotels, fetchedDrivers, fetchedActivities, fetchedGuides, fetchedFlights] = await Promise.all([
          getHotelsFromFirestore(),
          getDriversFromFirestore(),
          getActivitiesFromFirestore(),
          getGuidesFromFirestore(),
          getFlightsFromFirestore(),
        ]);
        setHotels(fetchedHotels);
        setDrivers(fetchedDrivers);
        setActivities(fetchedActivities);
        setGuides(fetchedGuides);
        setFlights(fetchedFlights);
      } catch (error) {
        console.error("Error loading data:", error);
        toast({ title: "Error", description: "No se pudieron cargar los datos.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  const handleAddItem = async (type: DataType) => {
    setIsSubmitting(true);
    try {
      if (type === 'flights') {
        if (!newFlightNumber.trim() || !newFlightTime.trim()) {
          toast({ title: "Datos Requeridos", description: "El número de vuelo y la hora son obligatorios.", variant: "destructive" }); return;
        }
        const flightExists = await checkIfFlightExists(newFlightNumber.trim().toUpperCase());
        if (flightExists) {
            toast({ title: "Registro Duplicado", description: `El vuelo "${newFlightNumber.toUpperCase()}" ya existe en la base de datos.`, variant: "destructive" }); return;
        }
        await createFlight({
            flightNumber: newFlightNumber.trim().toUpperCase(),
            time: newFlightTime.trim(),
            observations: newFlightObs.trim()
        });
        toast({ title: "¡Gracias!", description: `Vuelo añadido correctamente.`, className: "bg-green-100 dark:bg-green-900 border-green-500" });
        setNewFlightNumber(''); setNewFlightTime(''); setNewFlightObs('');
      } else {
        const name = newItemName.trim().toUpperCase();
        const lastName = newItemLastName.trim().toUpperCase();

        if (!name) {
          toast({ title: "Dato Requerido", description: "El nombre no puede estar vacío.", variant: "destructive" }); return;
        }
        if (type === 'guides' && !lastName) {
           toast({ title: "Dato Requerido", description: "El apellido no puede estar vacío.", variant: "destructive" }); return;
        }

        let exists = false;
        let finalNameToSave = name;

        if (type === 'guides') {
            exists = await checkIfGuideExists(name, lastName);
        } else if (type === 'hotels') {
            exists = await checkIfHotelExists(name);
        } else if (type === 'activities') {
            exists = await checkIfActivityExists(name);
        } else if (type === 'drivers') {
            finalNameToSave = driverType === 'externo' && !name.startsWith('CONT ') ? `CONT ${name}` : name;
            exists = await checkIfDriverExists(finalNameToSave);
        }
        
        if (exists) {
            toast({ title: "Registro Duplicado", description: `El registro "${type === 'guides' ? `${name} ${lastName}`: finalNameToSave}" ya existe.`, variant: "destructive" });
            return;
        }

        if (type === 'guides') await createGuide({ firstName: name, lastName: lastName });
        else if (type === 'hotels') await createHotel(name);
        else if (type === 'activities') await createActivity(name);
        else if (type === 'drivers') await createDriver(finalNameToSave);

        toast({ title: "¡Gracias!", description: `Tu contribución ha sido añadida.`, className: "bg-green-100 dark:bg-green-900 border-green-500" });
        setNewItemName(''); setNewItemLastName('');
      }
      await fetchData();
    } catch (error) {
      console.error(`Error adding ${type}:`, error);
      toast({ title: "Error", description: `No se pudo añadir el registro.`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      const id = 'uid' in itemToDelete ? itemToDelete.uid : itemToDelete.id;
      if (!id) throw new Error("ID is missing");
      
      if (itemToDelete.type === 'hotels') await deleteHotel(id);
      else if (itemToDelete.type === 'drivers') await deleteDriver(id);
      else if (itemToDelete.type === 'activities') await deleteActivity(id);
      else if (itemToDelete.type === 'guides') await deleteGuide(id);
      else if (itemToDelete.type === 'flights') await deleteFlight(id);

      toast({ title: "Eliminado", description: "El registro ha sido eliminado.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
      await fetchData(); // Refresh data
    } catch (error) {
       toast({ title: "Error", description: `No se pudo eliminar el registro.`, variant: "destructive" });
    } finally {
      setItemToDelete(null);
    }
  };


  const handleTabChange = (tabValue: string) => {
    router.push(`/admin/contribute?tab=${tabValue}`, { scroll: false });
  };

  const getTitleForType = (type: DataType): string => {
    switch (type) {
        case 'guides': return 'Añadir Nuevo Guía';
        case 'hotels': return 'Añadir Nuevo Hotel';
        case 'drivers': return 'Añadir Nuevo Chofer';
        case 'activities': return 'Añadir Nueva Actividad';
        case 'flights': return 'Añadir Nuevo Vuelo';
        default: return 'Añadir Nuevo';
    }
  }

  const renderAddForm = (type: DataType) => (
    <Card className="mt-4">
      <CardHeader><CardTitle className="text-lg">{getTitleForType(type)}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {type === 'flights' ? (
             <div className="flex gap-2 items-center flex-col sm:flex-row">
                <Input value={newFlightNumber} onChange={(e) => setNewFlightNumber(e.target.value)} placeholder="Número de Vuelo (ej: OB305)"/>
                <Input value={newFlightTime} onChange={(e) => setNewFlightTime(e.target.value)} placeholder="Hora (ej: 08:30)"/>
                <Input value={newFlightObs} onChange={(e) => setNewFlightObs(e.target.value)} placeholder="Observaciones (opcional)"/>
             </div>
        ) : type === 'drivers' && (
           <RadioGroup defaultValue="propio" onValueChange={(val: 'propio' | 'externo') => setDriverType(val)} className="flex items-center space-x-4">
              <div className="flex items-center space-x-2"><RadioGroupItem value="propio" id="r-propio" /><Label htmlFor="r-propio">Propio</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="externo" id="r-externo" /><Label htmlFor="r-externo">Externo (se añade 'CONT ')</Label></div>
            </RadioGroup>
        )}
        {type !== 'flights' && (
            <div className={`flex gap-2 items-center ${type === 'guides' ? 'flex-col sm:flex-row' : ''}`}>
              <div className="flex-grow flex gap-2">
                <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder={type === 'guides' ? 'Nombre del guía...' : `Nombre del nuevo ${type.slice(0, -1)}...`} onKeyDown={(e) => e.key === 'Enter' && handleAddItem(type)} />
                {type === 'guides' && (
                    <Input value={newItemLastName} onChange={(e) => setNewItemLastName(e.target.value)} placeholder="Apellido del guía..." onKeyDown={(e) => e.key === 'Enter' && handleAddItem(type)} />
                )}
              </div>
            </div>
        )}
        <div className="flex justify-end gap-2">
           <Button onClick={() => handleAddItem(type)} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            Añadir
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderTable = (data: any[], type: DataType) => {
    const displayName = (item: any) => {
        if ('fullName' in item) return item.fullName;
        if ('flightNumber' in item) return item.flightNumber;
        if ('name' in item) return item.name;
        return '';
    };

    return (
    <div className="border rounded-lg mt-4 overflow-hidden">
      <div className="max-h-96 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              {type === 'flights' ? (
                <>
                  <TableHead>Número de Vuelo</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Observaciones</TableHead>
                </>
              ) : (
                <TableHead>{type === 'guides' ? 'Nombre Completo' : 'Nombre'}</TableHead>
              )}
               <TableHead className="text-right w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={type === 'flights' ? 4 : 2} className="text-center h-24">No hay datos.</TableCell></TableRow>
            ) : (
              data.map(item => (
                <TableRow key={item.id || item.uid}>
                  <TableCell className="font-medium">
                    {displayName(item)}
                  </TableCell>
                  {type === 'flights' && 'time' in item && (
                    <>
                      <TableCell>{item.time}</TableCell>
                      <TableCell>{'observations' in item ? item.observations : ''}</TableCell>
                    </>
                  )}
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" title={`Eliminar ${type.slice(0, -1)}`} onClick={() => setItemToDelete({ ...item, type })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      {itemToDelete && ('uid' in itemToDelete ? itemToDelete.uid : itemToDelete.id) === (item.uid || item.id) && (
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará permanentemente "{displayName(itemToDelete)}". Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive hover:bg-destructive/90">
                              Sí, eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      )}
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
  };


  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-4xl mb-4 flex justify-between items-center">
        <Button variant="default" size="icon" onClick={() => router.push('/')} aria-label="Go to Home">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center text-primary">Aportar Datos</CardTitle>
          <CardDescription className="text-center">
            Añade nuevos registros a la base de datos maestra. Tu contribución ayuda a todos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="guides"><UserSquare className="mr-2 h-4 w-4" />Guías</TabsTrigger>
              <TabsTrigger value="hotels"><HotelIcon className="mr-2 h-4 w-4" />Hoteles</TabsTrigger>
              <TabsTrigger value="drivers"><Car className="mr-2 h-4 w-4" />Choferes</TabsTrigger>
              <TabsTrigger value="activities"><ListChecks className="mr-2 h-4 w-4" />Actividades</TabsTrigger>
              <TabsTrigger value="flights"><Plane className="mr-2 h-4 w-4" />Vuelos</TabsTrigger>
            </TabsList>
            <TabsContent value="guides">{renderAddForm('guides')}{renderTable(guides, 'guides')}</TabsContent>
            <TabsContent value="hotels">{renderAddForm('hotels')}{renderTable(hotels, 'hotels')}</TabsContent>
            <TabsContent value="drivers">{renderAddForm('drivers')}{renderTable(drivers, 'drivers')}</TabsContent>
            <TabsContent value="activities">{renderAddForm('activities')}{renderTable(activities, 'activities')}</TabsContent>
            <TabsContent value="flights">{renderAddForm('flights')}{renderTable(flights, 'flights')}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

