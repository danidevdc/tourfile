
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  createHotel, deleteHotel, getHotelsFromFirestore,
  createDriver, deleteDriver, getDriversFromFirestore,
  createActivity, deleteActivity, getActivitiesFromFirestore,
  createGuide, deleteGuide, getGuidesFromFirestore,
  initializeDefaultServiceOrderData,
  type Hotel, type Driver, type Activity, type ServiceOrderGuide
} from '@/lib/serviceOrderService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Trash2, PlusCircle, Hotel as HotelIcon, Car, ListChecks, UserSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


type DataType = 'hotel' | 'driver' | 'activity' | 'guide';
type ItemToDelete = (Hotel | Driver | Activity | ServiceOrderGuide) & { type: DataType; name?: string; fullName?: string };

export default function DataManagementPage() {
  const { isCurrentUserAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [guides, setGuides] = useState<ServiceOrderGuide[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  
  const [newItemName, setNewItemName] = useState('');
  const [newItemLastName, setNewItemLastName] = useState('');
  const [driverType, setDriverType] = useState<'propio' | 'externo'>('propio');
  
  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);

  useEffect(() => {
    if (!authLoading && !isCurrentUserAdmin) {
      toast({ title: "Acceso Denegado", description: "No tienes permisos para acceder.", variant: "destructive" });
      router.replace('/');
    }
  }, [authLoading, isCurrentUserAdmin, router, toast]);

  const fetchData = async () => {
    if (isCurrentUserAdmin) {
      setIsLoading(true);
      try {
        await initializeDefaultServiceOrderData();
        const [fetchedHotels, fetchedDrivers, fetchedActivities, fetchedGuides] = await Promise.all([
          getHotelsFromFirestore(),
          getDriversFromFirestore(),
          getActivitiesFromFirestore(),
          getGuidesFromFirestore(),
        ]);
        setHotels(fetchedHotels);
        setDrivers(fetchedDrivers);
        setActivities(fetchedActivities);
        setGuides(fetchedGuides);
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
  }, [isCurrentUserAdmin, authLoading, toast]);


  const handleAddItem = async (type: DataType) => {
    const name = newItemName.trim();
    const lastName = newItemLastName.trim();

    if (!name) {
      toast({ title: "Dato Requerido", description: "El nombre no puede estar vacío.", variant: "destructive" });
      return;
    }
    if (type === 'guide' && !lastName) {
       toast({ title: "Dato Requerido", description: "El apellido no puede estar vacío.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      if (type === 'hotel') await createHotel(name);
      else if (type === 'activity') await createActivity(name);
      else if (type === 'guide') await createGuide({ firstName: name, lastName: lastName });
      else if (type === 'driver') {
        const driverNameToSave = driverType === 'externo' && !name.toUpperCase().startsWith('CONT ') 
            ? `CONT ${name}`
            : name;
        await createDriver(driverNameToSave);
      }

      toast({ title: "Éxito", description: `${type.charAt(0).toUpperCase() + type.slice(1)} añadido correctamente.`, className: "bg-green-100 dark:bg-green-900 border-green-500" });
      setNewItemName('');
      setNewItemLastName('');
      await fetchData(); // Refresh data
    } catch (error) {
      console.error(`Error adding ${type}:`, error);
      toast({ title: "Error", description: `No se pudo añadir el ${type}.`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      const id = 'uid' in itemToDelete ? itemToDelete.uid : itemToDelete.id;
      if (!id) throw new Error("ID is missing");
      
      if (itemToDelete.type === 'hotel') await deleteHotel(id);
      else if (itemToDelete.type === 'driver') await deleteDriver(id);
      else if (itemToDelete.type === 'activity') await deleteActivity(id);
      else if (itemToDelete.type === 'guide') await deleteGuide(id);

      toast({ title: "Eliminado", description: "El registro ha sido eliminado.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
      await fetchData(); // Refresh data
    } catch (error) {
       toast({ title: "Error", description: `No se pudo eliminar el registro.`, variant: "destructive" });
    } finally {
      setItemToDelete(null);
    }
  };

  const renderAddForm = (type: DataType) => (
    <Card className="mt-4">
      <CardHeader><CardTitle className="text-lg">Añadir Nuevo {type.charAt(0).toUpperCase() + type.slice(1)}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {type === 'driver' && (
           <RadioGroup defaultValue="propio" onValueChange={(val: 'propio' | 'externo') => setDriverType(val)} className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="propio" id="r-propio" />
                <Label htmlFor="r-propio">Propio (Número. Ej: 8, 9, 10)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="externo" id="r-externo" />
                <Label htmlFor="r-externo">Externo (Nombre. Se añadirá 'CONT ')</Label>
              </div>
            </RadioGroup>
        )}
        <div className={`flex gap-2 ${type === 'guide' ? 'flex-col sm:flex-row' : ''}`}>
          <Input 
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder={type === 'guide' ? 'Nombre del guía...' : `Nombre del nuevo ${type}...`}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem(type)}
          />
           {type === 'guide' && (
               <Input 
                value={newItemLastName}
                onChange={(e) => setNewItemLastName(e.target.value)}
                placeholder="Apellido del guía..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem(type)}
              />
           )}
          <Button onClick={() => handleAddItem(type)} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            Añadir
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderTable = <T extends { id?: string; uid?: string; name?: string; fullName?: string; firstName?: string; lastName?: string }>(data: T[], type: DataType) => {
    const displayName = (item: T) => {
        if (type === 'guide') return `${item.firstName} ${item.lastName}`;
        return item.name || '';
    };
    
    return (
      <div className="border rounded-lg mt-4 overflow-hidden max-h-96 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{type === 'guide' ? 'Nombre Completo' : 'Nombre'}</TableHead>
              <TableHead className="text-right w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={2} className="text-center h-24">No hay datos.</TableCell></TableRow>
            ) : (
              data.map(item => {
                const itemId = item.id || item.uid;
                if (!itemId) return null;
                return (
                  <TableRow key={itemId}>
                    <TableCell className="font-medium">{displayName(item)}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                         <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" title={`Eliminar ${type}`} onClick={() => setItemToDelete({ ...item, type })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                         </AlertDialogTrigger>
                         {itemToDelete && (itemToDelete.id || itemToDelete.uid) === itemId && (
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
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-4xl mb-4 flex justify-between items-center">
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center text-primary">Administrar Datos</CardTitle>
          <CardDescription className="text-center">
            Añade o elimina datos para los generadores de la aplicación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="guides" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="guides"><UserSquare className="mr-2 h-4 w-4" />Guías</TabsTrigger>
              <TabsTrigger value="hotels"><HotelIcon className="mr-2 h-4 w-4" />Hoteles</TabsTrigger>
              <TabsTrigger value="drivers"><Car className="mr-2 h-4 w-4" />Choferes</TabsTrigger>
              <TabsTrigger value="activities"><ListChecks className="mr-2 h-4 w-4" />Actividades</TabsTrigger>
            </TabsList>
            <TabsContent value="guides">
              {renderTable(guides, 'guide')}
              {renderAddForm('guide')}
            </TabsContent>
            <TabsContent value="hotels">
              {renderTable(hotels, 'hotel')}
              {renderAddForm('hotel')}
            </TabsContent>
            <TabsContent value="drivers">
              {renderTable(drivers, 'driver')}
              {renderAddForm('driver')}
            </TabsContent>
            <TabsContent value="activities">
              {renderTable(activities, 'activity')}
              {renderAddForm('activity')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
