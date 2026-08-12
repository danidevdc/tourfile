
"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  createHotel, getHotelsFromFirestore, updateHotel,
  createDriver, getDriversFromFirestore, updateDriver,
  createActivity, getActivitiesFromFirestore, updateActivity,
  createGuide, getGuidesFromFirestore, updateGuide,
  createFlight, getFlightsFromFirestore, updateFlight,
  createBus, getBusesFromFirestore, updateBus, deleteBus,
  checkIfGuideExists, checkIfHotelExists, checkIfDriverExists, checkIfActivityExists, checkIfFlightExists, checkIfBusExists,
  deleteGuide, deleteHotel, deleteDriver, deleteActivity, deleteFlight, initializeDefaultBuses,
  type Hotel, type Driver, type Activity, type ServiceOrderGuide, type PredefinedFlight, type Bus
} from '@/lib/serviceOrderService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, PlusCircle, Hotel as HotelIcon, Car, ListChecks, UserSquare, Plane, Trash2, Search, Edit, Save, Bus as BusIcon, XCircle } from 'lucide-react';
import { PlaneSpinner } from '@/components/ui/plane-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

type DataType = 'guides' | 'hotels' | 'drivers' | 'activities' | 'flights' | 'buses';
const VALID_TABS: DataType[] = ['guides', 'hotels', 'drivers', 'activities', 'flights', 'buses'];
type ItemToDelete = (Hotel | Driver | Activity | ServiceOrderGuide | PredefinedFlight | Bus) & { type: DataType; name?: string; fullName?: string; flightNumber?: string; };

export default function ContributeDataPage() {
  const { isCurrentUserAdmin, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for data
  const [guides, setGuides] = useState<ServiceOrderGuide[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [flights, setFlights] = useState<PredefinedFlight[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);

  // States for adding new items
  const [newItemName, setNewItemName] = useState('');
  const [newItemLastName, setNewItemLastName] = useState('');
  const [driverType, setDriverType] = useState<'propio' | 'externo'>('propio');
  const [newFlightNumber, setNewFlightNumber] = useState('');
  const [newFlightTime, setNewFlightTime] = useState('');
  const [newFlightObs, setNewFlightObs] = useState('');

  // States for editing and deleting
  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});

  const [searchTerm, setSearchTerm] = useState('');

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
        await initializeDefaultBuses();
        const [fetchedHotels, fetchedDrivers, fetchedActivities, fetchedGuides, fetchedFlights, fetchedBuses] = await Promise.all([
          getHotelsFromFirestore(),
          getDriversFromFirestore(),
          getActivitiesFromFirestore(),
          getGuidesFromFirestore(),
          getFlightsFromFirestore(),
          getBusesFromFirestore(),
        ]);
        setHotels(fetchedHotels);
        setDrivers(fetchedDrivers);
        setActivities(fetchedActivities);
        setGuides(fetchedGuides);
        setFlights(fetchedFlights);
        setBuses(fetchedBuses);
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
        toast({ title: "¡Gracias!", description: `Vuelo añadido correctamente.`, variant: "success" as any });
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

        if (type === 'guides') exists = await checkIfGuideExists(name, lastName);
        else if (type === 'hotels') exists = await checkIfHotelExists(name);
        else if (type === 'activities') exists = await checkIfActivityExists(name);
        else if (type === 'buses') exists = await checkIfBusExists(name);
        else if (type === 'drivers') {
          finalNameToSave = driverType === 'externo' && !name.startsWith('CONT ') ? `CONT ${name}` : name;
          exists = await checkIfDriverExists(finalNameToSave);
        }

        if (exists) {
          toast({ title: "Registro Duplicado", description: `El registro "${type === 'guides' ? `${name} ${lastName}` : finalNameToSave}" ya existe.`, variant: "destructive" });
          return;
        }

        if (type === 'guides') await createGuide({ firstName: name, lastName: lastName });
        else if (type === 'hotels') await createHotel(name);
        else if (type === 'activities') await createActivity(name);
        else if (type === 'buses') await createBus(name);
        else if (type === 'drivers') await createDriver(finalNameToSave);

        toast({ title: "¡Gracias!", description: `Tu contribución ha sido añadida.`, variant: "success" as any });
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
      else if (itemToDelete.type === 'buses') await deleteBus(id);


      toast({ title: "Eliminado", description: "El registro ha sido eliminado.", variant: "success" as any });
      await fetchData();
    } catch (error) {
      toast({ title: "Error", description: `No se pudo eliminar el registro.`, variant: "destructive" });
    } finally {
      setItemToDelete(null);
    }
  };

  const handleEditClick = (item: any, type: DataType) => {
    const id = item.uid || item.id;
    setEditingItemId(id);
    if (type === 'guides') {
      setEditingValues({ [id]: { firstName: item.firstName, lastName: item.lastName } });
    } else if (type === 'flights') {
      setEditingValues({ [id]: { flightNumber: item.flightNumber, time: item.time, observations: item.observations } });
    } else {
      setEditingValues({ [id]: { name: item.name } });
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingValues({});
  };

  const handleSaveEdit = async (id: string, type: DataType) => {
    const newValues = editingValues[id];
    if (!newValues) return;
    try {
      if (type === 'guides') await updateGuide(id, { firstName: newValues.firstName, lastName: newValues.lastName });
      else if (type === 'hotels') await updateHotel(id, newValues.name);
      else if (type === 'drivers') await updateDriver(id, newValues.name);
      else if (type === 'activities') await updateActivity(id, newValues.name);
      else if (type === 'flights') await updateFlight(id, { flightNumber: newValues.flightNumber, time: newValues.time, observations: newValues.observations });
      else if (type === 'buses') await updateBus(id, newValues.name);

      toast({ title: "Guardado", description: "El registro ha sido actualizado.", variant: "success" as any });
      await fetchData();
    } catch (error) {
      toast({ title: "Error", description: `No se pudo guardar el registro.`, variant: "destructive" });
    } finally {
      handleCancelEdit();
    }
  };

  const handleEditingChange = (id: string, field: string, value: string) => {
    setEditingValues(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleTabChange = (tabValue: string) => {
    router.push(`/admin/contribute?tab=${tabValue}`, { scroll: false });
    setSearchTerm('');
  };

  const getTitleForType = (type: DataType): string => {
    switch (type) {
      case 'guides': return 'Añadir Nuevo Guía';
      case 'hotels': return 'Añadir Nuevo Hotel';
      case 'drivers': return 'Añadir Nuevo Chofer';
      case 'activities': return 'Añadir Nueva Actividad';
      case 'flights': return 'Añadir Nuevo Vuelo';
      case 'buses': return 'Añadir Nuevo Bus';
      default: return 'Añadir Nuevo';
    }
  }

  const renderSearchInput = () => (
    <div className="relative w-full mb-6 mt-2 px-1">
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
        <div className="relative flex items-center bg-background rounded-lg border border-slate-200 dark:border-slate-800">
          <Search className="absolute left-3 h-5 w-5 text-sky-500" />
          <Input
            placeholder={`Buscar en ${activeTab === 'guides' ? 'guías' :
              activeTab === 'hotels' ? 'hoteles' :
                activeTab === 'drivers' ? 'choferes' :
                  activeTab === 'buses' ? 'buses' :
                    activeTab === 'activities' ? 'actividades' : 'vuelos'}... para verificar duplicados`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 border-none focus-visible:ring-0 shadow-none bg-transparent"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2 ml-1 flex items-center gap-1">
        <span className="inline-block w-2 h-2 rounded-full bg-red-400"></span>
        Si el registro ya existe, aparecerá resaltado en rojo en la lista.
      </p>
    </div>
  );

  const renderAddForm = (type: DataType) => (
    <Card className="mt-4 mb-6">
      <CardHeader><CardTitle className="text-lg">{getTitleForType(type)}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {type === 'flights' ? ( /* Flight Form */
          <div className="flex gap-2 items-center flex-col sm:flex-row">
            <Input value={newFlightNumber} onChange={(e) => setNewFlightNumber(e.target.value)} placeholder="Número de Vuelo (ej: OB305)" />
            <Input value={newFlightTime} onChange={(e) => setNewFlightTime(e.target.value)} placeholder="Hora (ej: 08:30)" />
            <Input value={newFlightObs} onChange={(e) => setNewFlightObs(e.target.value)} placeholder="Observaciones (opcional)" />
          </div>
        ) : type === 'drivers' ? ( /* Driver Form */
          <>
            <RadioGroup defaultValue="propio" onValueChange={(val: 'propio' | 'externo') => setDriverType(val)} className="flex items-center space-x-4">
              <div className="flex items-center space-x-2"><RadioGroupItem value="propio" id="r-propio" /><Label htmlFor="r-propio">Propio</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="externo" id="r-externo" /><Label htmlFor="r-externo">Externo (se añade &apos;CONT &apos;)</Label></div>
            </RadioGroup>
            <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Nombre del nuevo chofer..." onKeyDown={(e) => e.key === 'Enter' && handleAddItem(type)} />
          </>
        ) : type === 'guides' ? ( /* Guide Form */
          <div className="flex gap-2 items-center flex-col sm:flex-row">
            <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Nombre del guía..." onKeyDown={(e) => e.key === 'Enter' && handleAddItem(type)} />
            <Input value={newItemLastName} onChange={(e) => setNewItemLastName(e.target.value)} placeholder="Apellido del guía..." onKeyDown={(e) => e.key === 'Enter' && handleAddItem(type)} />
          </div>
        ) : ( /* Generic Form for Hotels, Activities, Buses */
          <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder={`Nombre del nuevo ${type.slice(0, -1)}...`} onKeyDown={(e) => e.key === 'Enter' && handleAddItem(type)} />
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

  const filteredData = (data: any[], type: DataType) => {
    if (!searchTerm) return data;
    const lowercasedFilter = searchTerm.toLowerCase();

    return data.filter(item => {
      if (type === 'guides') return item.fullName.toLowerCase().includes(lowercasedFilter);
      if (type === 'flights') return item.flightNumber.toLowerCase().includes(lowercasedFilter) || item.observations.toLowerCase().includes(lowercasedFilter);
      return item.name.toLowerCase().includes(lowercasedFilter);
    });
  };

  const renderTable = (data: any[], type: DataType) => {
    const isEditing = (item: any) => editingItemId === (item.uid || item.id);

    // Check for exact match with searchTerm to highlight
    const isExactMatch = (item: any) => {
      if (!searchTerm) return false;
      const lowerSearch = searchTerm.trim().toLowerCase();
      if (type === 'guides') return item.fullName.toLowerCase() === lowerSearch;
      if (type === 'flights') return item.flightNumber.toLowerCase() === lowerSearch;
      return item.name.toLowerCase() === lowerSearch;
    };

    return (
      <div className="border rounded-lg mt-4 overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                {type === 'guides' ? (<><TableHead>Nombre</TableHead><TableHead>Apellido</TableHead></>) :
                  type === 'flights' ? (<><TableHead>Vuelo</TableHead><TableHead>Hora</TableHead><TableHead>Obs.</TableHead></>) :
                    (<TableHead>Nombre</TableHead>)}
                <TableHead className="text-right w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow><TableCell colSpan={type === 'guides' || type === 'flights' ? 4 : 3} className="text-center h-24">No hay datos.</TableCell></TableRow>
              ) : (
                data.map(item => {
                  const id = item.uid || item.id;
                  const highlight = isExactMatch(item);
                  return (
                    <TableRow key={id} className={cn(
                      isEditing(item) ? "bg-muted/50" : "",
                      !isEditing(item) && highlight ? "bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/50" : ""
                    )}>
                      {isEditing(item) ? (
                        <>
                          {type === 'guides' ? (
                            <>
                              <TableCell><Input value={editingValues[id].firstName} onChange={(e) => handleEditingChange(id, 'firstName', e.target.value.toUpperCase())} /></TableCell>
                              <TableCell><Input value={editingValues[id].lastName} onChange={(e) => handleEditingChange(id, 'lastName', e.target.value.toUpperCase())} /></TableCell>
                            </>
                          ) : type === 'flights' ? (
                            <>
                              <TableCell><Input value={editingValues[id].flightNumber} onChange={(e) => handleEditingChange(id, 'flightNumber', e.target.value.toUpperCase())} /></TableCell>
                              <TableCell><Input value={editingValues[id].time} onChange={(e) => handleEditingChange(id, 'time', e.target.value)} /></TableCell>
                              <TableCell><Input value={editingValues[id].observations} onChange={(e) => handleEditingChange(id, 'observations', e.target.value)} /></TableCell>
                            </>
                          ) : (
                            <TableCell colSpan={1}>
                              <Input value={editingValues[id].name} onChange={(e) => handleEditingChange(id, 'name', e.target.value.toUpperCase())} />
                            </TableCell>
                          )}
                        </>
                      ) : (
                        <>
                          {type === 'guides' ? (
                            <>
                              <TableCell>{item.firstName}</TableCell>
                              <TableCell>{item.lastName}</TableCell>
                            </>
                          ) : type === 'flights' ? (
                            <>
                              <TableCell>{item.flightNumber}</TableCell>
                              <TableCell>{item.time}</TableCell>
                              <TableCell>{item.observations}</TableCell>
                            </>
                          ) : (
                            <TableCell>{item.name}</TableCell>
                          )}
                        </>
                      )}
                      <TableCell className="text-right space-x-1">
                        {isEditing(item) ? (
                          <>
                            <Button variant="default" size="icon" title="Guardar Cambios" onClick={() => handleSaveEdit(id, type)}><Save className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" title="Cancelar" onClick={handleCancelEdit}><XCircle className="h-4 w-4" /></Button>
                          </>
                        ) : (
                          <Button variant="outline" size="icon" title={`Editar ${type.slice(0, -1)}`} onClick={() => handleEditClick(item, type)}><Edit className="h-4 w-4" /></Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" title={`Eliminar ${type.slice(0, -1)}`} onClick={() => setItemToDelete({ ...item, type })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          {itemToDelete && id === ((itemToDelete as any).uid || (itemToDelete as any).id) && (
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se eliminará permanentemente &quot;{type === 'guides' ? item.fullName : type === 'flights' ? item.flightNumber : item.name}&quot;. Esta acción no se puede deshacer.
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
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><PlaneSpinner className="w-16 h-16" /></div>;
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-5xl mb-4 flex justify-between items-center">
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {/* Search Input Moved Inside Tabs */}
      </div>
      <Card className="w-full max-w-5xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center text-primary">Aportar Datos</CardTitle>
          <CardDescription className="text-center">
            Añade nuevos registros a la base de datos maestra. Tu contribución ayuda a todos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-6 mb-4">
              <TabsTrigger value="guides"><UserSquare className="mr-2 h-4 w-4" />Guías</TabsTrigger>
              <TabsTrigger value="hotels"><HotelIcon className="mr-2 h-4 w-4" />Hoteles</TabsTrigger>
              <TabsTrigger value="drivers"><Car className="mr-2 h-4 w-4" />Choferes</TabsTrigger>
              <TabsTrigger value="buses"><BusIcon className="mr-2 h-4 w-4" />Buses</TabsTrigger>
              <TabsTrigger value="activities"><ListChecks className="mr-2 h-4 w-4" />Actividades</TabsTrigger>
              <TabsTrigger value="flights"><Plane className="mr-2 h-4 w-4" />Vuelos</TabsTrigger>
            </TabsList>

            <TabsContent value="guides">
              {renderAddForm('guides')}
              {renderSearchInput()}
              {renderTable(filteredData(guides, 'guides'), 'guides')}
            </TabsContent>
            <TabsContent value="hotels">
              {renderAddForm('hotels')}
              {renderSearchInput()}
              {renderTable(filteredData(hotels, 'hotels'), 'hotels')}
            </TabsContent>
            <TabsContent value="drivers">
              {renderAddForm('drivers')}
              {renderSearchInput()}
              {renderTable(filteredData(drivers, 'drivers'), 'drivers')}
            </TabsContent>
            <TabsContent value="buses">
              {renderAddForm('buses')}
              {renderSearchInput()}
              {renderTable(filteredData(buses, 'buses'), 'buses')}
            </TabsContent>
            <TabsContent value="activities">
              {renderAddForm('activities')}
              {renderSearchInput()}
              {renderTable(filteredData(activities, 'activities'), 'activities')}
            </TabsContent>
            <TabsContent value="flights">
              {renderAddForm('flights')}
              {renderSearchInput()}
              {renderTable(filteredData(flights, 'flights'), 'flights')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

