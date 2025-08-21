
"use client";

import { useEffect, useState, useRef, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  createHotel, deleteHotel, getHotelsFromFirestore,
  createDriver, deleteDriver, getDriversFromFirestore,
  createActivity, deleteActivity, getActivitiesFromFirestore,
  createGuide, deleteGuide, getGuidesFromFirestore,
  createBulkGuides, createBulkHotels, createBulkDrivers, createBulkActivities,
  type Hotel, type Driver, type Activity, type ServiceOrderGuide
} from '@/lib/serviceOrderService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Trash2, PlusCircle, Hotel as HotelIcon, Car, ListChecks, UserSquare, Upload, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';


type DataType = 'guides' | 'hotels' | 'drivers' | 'activities';
const VALID_TABS: DataType[] = ['guides', 'hotels', 'drivers', 'activities'];

type ItemToDelete = (Hotel | Driver | Activity | ServiceOrderGuide) & { type: DataType; name?: string; fullName?: string };
type Item = Hotel | Driver | Activity | ServiceOrderGuide;


interface BulkUploadButtonProps {
  dataType: DataType;
  onUpload: (file: File) => Promise<void>;
  isSubmitting: boolean;
}

const BulkUploadButton: React.FC<BulkUploadButtonProps> = ({ dataType, onUpload, isSubmitting }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    // Reset file input to allow uploading the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".xlsx, .xls"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={isSubmitting}
        className="ml-2"
      >
        {isSubmitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Subir Lista
      </Button>
    </>
  );
};


export default function DataManagementPage() {
  const { isCurrentUserAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [guides, setGuides] = useState<ServiceOrderGuide[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  
  const [newItemName, setNewItemName] = useState('');
  const [newItemLastName, setNewItemLastName] = useState('');
  const [driverType, setDriverType] = useState<'propio' | 'externo'>('propio');
  
  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);

  const initialTab = searchParams.get('tab') as DataType | null;
  const activeTab = initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'guides';


  useEffect(() => {
    if (!authLoading && !isCurrentUserAdmin) {
      toast({ title: "Acceso Denegado", description: "No tienes permisos para acceder.", variant: "destructive" });
      router.replace('/');
    }
  }, [authLoading, isCurrentUserAdmin, router, toast]);

  const findDuplicates = (items: Item[], type: DataType): Set<string> => {
    const nameCounts: { [key: string]: string[] } = {};
    const duplicates = new Set<string>();

    items.forEach(item => {
      const id = 'uid' in item ? item.uid : item.id;
      if (!id) return;
      
      let nameKey: string;
      if (type === 'guides' && 'fullName' in item) {
        nameKey = item.fullName.trim().toLowerCase();
      } else if ('name' in item) {
        nameKey = item.name.trim().toLowerCase();
      } else {
        return;
      }
      
      if (!nameCounts[nameKey]) {
        nameCounts[nameKey] = [];
      }
      nameCounts[nameKey].push(id);
    });

    for (const nameKey in nameCounts) {
      if (nameCounts[nameKey].length > 1) {
        nameCounts[nameKey].forEach(id => duplicates.add(id));
      }
    }
    return duplicates;
  };


  const fetchData = async () => {
    if (isCurrentUserAdmin) {
      setIsLoading(true);
      try {
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

        const allDuplicates = new Set([
            ...findDuplicates(fetchedHotels, 'hotels'),
            ...findDuplicates(fetchedDrivers, 'drivers'),
            ...findDuplicates(fetchedActivities, 'activities'),
            ...findDuplicates(fetchedGuides, 'guides'),
        ]);
        setDuplicateIds(allDuplicates);

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
  }, [isCurrentUserAdmin, authLoading]);


  const handleAddItem = async (type: DataType) => {
    const name = newItemName.trim();
    const lastName = newItemLastName.trim();

    if (!name) {
      toast({ title: "Dato Requerido", description: "El nombre no puede estar vacío.", variant: "destructive" });
      return;
    }
    if (type === 'guides' && !lastName) {
       toast({ title: "Dato Requerido", description: "El apellido no puede estar vacío.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      if (type === 'hotels') await createHotel(name);
      else if (type === 'activities') await createActivity(name);
      else if (type === 'guides') await createGuide({ firstName: name, lastName: lastName });
      else if (type === 'drivers') {
        const driverNameToSave = driverType === 'externo' && !name.toUpperCase().startsWith('CONT ') 
            ? `CONT ${name}`
            : name;
        await createDriver(driverNameToSave);
      }

      toast({ title: "Éxito", description: `${type.charAt(0).toUpperCase() + type.slice(1, -1)} añadido correctamente.`, className: "bg-green-100 dark:bg-green-900 border-green-500" });
      setNewItemName('');
      setNewItemLastName('');
      await fetchData(); // Refresh data
    } catch (error) {
      console.error(`Error adding ${type}:`, error);
      toast({ title: "Error", description: `No se pudo añadir el ${type.slice(0, -1)}.`, variant: "destructive" });
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

      toast({ title: "Eliminado", description: "El registro ha sido eliminado.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
      await fetchData(); // Refresh data
    } catch (error) {
       toast({ title: "Error", description: `No se pudo eliminar el registro.`, variant: "destructive" });
    } finally {
      setItemToDelete(null);
    }
  };


  const handleBulkUpload = async (file: File, type: DataType) => {
    setIsSubmitting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet);

          let records: any[] = [];
          if (type === 'guides') {
            records = json.map(row => ({ firstName: row.nombre, lastName: row.apellido })).filter(g => g.firstName && g.lastName);
            if(records.length > 0) await createBulkGuides(records);
          } else {
            records = json.map(row => ({ name: row.nombre })).filter(item => item.name);
            if (records.length > 0) {
              if (type === 'hotels') await createBulkHotels(records);
              else if (type === 'drivers') await createBulkDrivers(records);
              else if (type === 'activities') await createBulkActivities(records);
            }
          }
          
          if (records.length === 0) {
            toast({ title: "Archivo Vacío o Formato Incorrecto", description: "Asegúrate que el archivo Excel tenga las columnas correctas ('nombre' y 'apellido' para guías, 'nombre' para los demás).", variant: "destructive", duration: 7000 });
          } else {
            toast({ title: "Carga Exitosa", description: `Se procesaron ${records.length} registros desde el archivo.`, className: "bg-green-100 dark:bg-green-900 border-green-500" });
            await fetchData();
          }

        } catch (err) {
          console.error("Error processing file:", err);
          toast({ title: "Error al procesar archivo", description: "Hubo un problema al leer el contenido del archivo Excel.", variant: "destructive" });
        } finally {
          setIsSubmitting(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error reading file:", error);
      toast({ title: "Error de carga", description: "No se pudo cargar el archivo.", variant: "destructive" });
      setIsSubmitting(false);
    }
  };


  const renderAddForm = (type: DataType) => (
    <Card className="mt-4">
      <CardHeader><CardTitle className="text-lg">Añadir Nuevo {type.slice(0, -1)}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {type === 'drivers' && (
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
        <div className={`flex gap-2 items-center ${type === 'guides' ? 'flex-col sm:flex-row' : ''}`}>
          <div className="flex-grow flex gap-2">
            <Input 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={type === 'guides' ? 'Nombre del guía...' : `Nombre del nuevo ${type.slice(0, -1)}...`}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem(type)}
            />
            {type === 'guides' && (
                <Input 
                  value={newItemLastName}
                  onChange={(e) => setNewItemLastName(e.target.value)}
                  placeholder="Apellido del guía..."
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem(type)}
                />
            )}
          </div>
          <div className="flex gap-2 shrink-0">
             <Button onClick={() => handleAddItem(type)} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Añadir
            </Button>
            <BulkUploadButton dataType={type} onUpload={(file) => handleBulkUpload(file, type)} isSubmitting={isSubmitting} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderTable = <T extends { id?: string; uid?: string; name?: string; fullName?: string; firstName?: string; lastName?: string }>(data: T[], type: DataType) => {
    const displayName = (item: T) => {
        if (type === 'guides') return `${item.firstName} ${item.lastName}`;
        return item.name || '';
    };
    
    return (
      <div className="border rounded-lg mt-4 overflow-hidden max-h-96 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{type === 'guides' ? 'Nombre Completo' : 'Nombre'}</TableHead>
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
                const isDuplicate = duplicateIds.has(itemId);

                return (
                  <TableRow 
                    key={itemId}
                    className={cn(isDuplicate && "bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200/80 dark:hover:bg-yellow-900/50")}
                  >
                    <TableCell className="font-medium flex items-center gap-2">
                      {isDuplicate && <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" title="Registro duplicado"/>}
                      {displayName(item)}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                         <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" title={`Eliminar ${type.slice(0, -1)}`} onClick={() => setItemToDelete({ ...item, type })}>
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
            Añade, elimina o sube listas de datos para los generadores. Los registros duplicados se marcarán en amarillo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={activeTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="guides"><UserSquare className="mr-2 h-4 w-4" />Guías</TabsTrigger>
              <TabsTrigger value="hotels"><HotelIcon className="mr-2 h-4 w-4" />Hoteles</TabsTrigger>
              <TabsTrigger value="drivers"><Car className="mr-2 h-4 w-4" />Choferes</TabsTrigger>
              <TabsTrigger value="activities"><ListChecks className="mr-2 h-4 w-4" />Actividades</TabsTrigger>
            </TabsList>
            <TabsContent value="guides">
              {renderTable(guides, 'guides')}
              {renderAddForm('guides')}
            </TabsContent>
            <TabsContent value="hotels">
              {renderTable(hotels, 'hotels')}
              {renderAddForm('hotels')}
            </TabsContent>
            <TabsContent value="drivers">
              {renderTable(drivers, 'drivers')}
              {renderAddForm('drivers')}
            </TabsContent>
            <TabsContent value="activities">
              {renderTable(activities, 'activities')}
              {renderAddForm('activities')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
