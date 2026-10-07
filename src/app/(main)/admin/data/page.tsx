
"use client";

import { useEffect, useState, useRef, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import type { DocumentReference } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  createHotel, deleteHotel, getHotelsFromFirestore,
  createDriver, deleteDriver, getDriversFromFirestore,
  createActivity, deleteActivity, getActivitiesFromFirestore,
  createGuide, deleteGuide, getGuidesFromFirestore,
  createFlight, deleteFlight, getFlightsFromFirestore,
  createBulkGuides, createBulkHotels, createBulkDrivers, createBulkActivities, createBulkFlights,
  deleteBulkGuides, deleteBulkHotels, deleteBulkDrivers, deleteBulkActivities, deleteBulkFlights,
  type Hotel, type Driver, type Activity, type ServiceOrderGuide, type PredefinedFlight
} from '@/lib/serviceOrderService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Trash2, PlusCircle, Hotel as HotelIcon, Car, ListChecks, UserSquare, Upload, AlertTriangle, Plane } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';


type DataType = 'guides' | 'hotels' | 'drivers' | 'activities' | 'flights';
const VALID_TABS: DataType[] = ['guides', 'hotels', 'drivers', 'activities', 'flights'];

type ItemToDelete = (Hotel | Driver | Activity | ServiceOrderGuide | PredefinedFlight) & { type: DataType; name?: string; fullName?: string; flightNumber?: string; };
type Item = Hotel | Driver | Activity | ServiceOrderGuide | PredefinedFlight;


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

// Helper function to correctly format time from various possible inputs
const formatFlightTime = (timeValue: any): string => {
    if (!timeValue) return '';
    if (typeof timeValue === 'string') {
        return timeValue.substring(0, 5);
    }
    if (typeof timeValue === 'number' && timeValue > 0 && timeValue < 1) {
        // Excel time serial number (fraction of a day)
        const totalSeconds = Math.round(timeValue * 86400);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return ''; // Return empty for invalid formats
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
  const [flights, setFlights] = useState<PredefinedFlight[]>([]);
  
  const [selectedItems, setSelectedItems] = useState<Record<DataType, Set<string>>>({
      guides: new Set(), hotels: new Set(), drivers: new Set(), activities: new Set(), flights: new Set()
  });

  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  
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
    if (!authLoading && !isCurrentUserAdmin) {
      toast({ title: "Acceso Denegado", description: "No tienes permisos para acceder.", variant: "destructive" });
      router.replace('/home');
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
      } else if (type === 'flights' && 'flightNumber' in item) {
        nameKey = item.flightNumber.trim().toLowerCase();
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

        const allDuplicates = new Set([
            ...findDuplicates(fetchedHotels, 'hotels'),
            ...findDuplicates(fetchedDrivers, 'drivers'),
            ...findDuplicates(fetchedActivities, 'activities'),
            ...findDuplicates(fetchedGuides, 'guides'),
            ...findDuplicates(fetchedFlights, 'flights'),
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
    if (type === 'flights') {
        if (!newFlightNumber.trim() || !newFlightTime.trim()) {
            toast({ title: "Datos Requeridos", description: "El número de vuelo y la hora son obligatorios.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const flightData = {
                flightNumber: newFlightNumber.trim().toUpperCase(),
                time: newFlightTime.trim(),
                observations: newFlightObs.trim()
            };
            const docRef = await createFlight(flightData);
            toast({ title: "Éxito", description: `Vuelo añadido correctamente.`, variant: "success" });
            setNewFlightNumber('');
            setNewFlightTime('');
            setNewFlightObs('');

            // Optimización: Actualizar estado local en lugar de recargar desde Firebase
            setFlights(prev => [...prev, { id: docRef.id, ...flightData }].sort((a, b) => a.flightNumber.localeCompare(b.flightNumber)));
        } catch (error) {
            console.error(`Error adding flight:`, error);
            toast({ title: "Error", description: `No se pudo añadir el vuelo.`, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
        return;
    }


    const name = newItemName.trim().toUpperCase();
    const lastName = newItemLastName.trim().toUpperCase();

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
      let docRef: DocumentReference | undefined;
      if (type === 'hotels') {
        const ref = await createHotel(name);
        docRef = ref;
        setHotels(prev => [...prev, { id: ref.id, name }].sort((a, b) => a.name.localeCompare(b.name)));
      }
      else if (type === 'activities') {
        const ref = await createActivity(name);
        docRef = ref;
        setActivities(prev => [...prev, { id: ref.id, name }].sort((a, b) => a.name.localeCompare(b.name)));
      }
      else if (type === 'guides') {
        const ref = await createGuide({ firstName: name, lastName: lastName });
        docRef = ref;
        const fullName = `${name} ${lastName}`.trim();
        setGuides(prev => [...prev, { uid: ref.id, firstName: name, lastName: lastName, fullName }].sort((a, b) => a.fullName.localeCompare(b.fullName)));
      }
      else if (type === 'drivers') {
        const driverNameToSave = driverType === 'externo' && !name.startsWith('CONT ')
            ? `CONT ${name}`
            : name;
        const ref = await createDriver(driverNameToSave);
        docRef = ref;
        setDrivers(prev => [...prev, { id: ref.id, name: driverNameToSave }].sort((a, b) => a.name.localeCompare(b.name)));
      }

      toast({ title: "Éxito", description: `${type.slice(0, -1)} añadido correctamente.`, variant: "success" });
      setNewItemName('');
      setNewItemLastName('');
      // Optimización: Ya no recargamos desde Firebase, actualizamos estado local arriba
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

      if (itemToDelete.type === 'hotels') {
        await deleteHotel(id);
        setHotels(prev => prev.filter(h => h.id !== id));
      }
      else if (itemToDelete.type === 'drivers') {
        await deleteDriver(id);
        setDrivers(prev => prev.filter(d => d.id !== id));
      }
      else if (itemToDelete.type === 'activities') {
        await deleteActivity(id);
        setActivities(prev => prev.filter(a => a.id !== id));
      }
      else if (itemToDelete.type === 'guides') {
        await deleteGuide(id);
        setGuides(prev => prev.filter(g => g.uid !== id));
      }
      else if (itemToDelete.type === 'flights') {
        await deleteFlight(id);
        setFlights(prev => prev.filter(f => f.id !== id));
      }

      toast({ title: "Eliminado", description: "El registro ha sido eliminado.", variant: "success" });
      // Optimización: Ya no recargamos desde Firebase, actualizamos estado local arriba
    } catch (error) {
       toast({ title: "Error", description: `No se pudo eliminar el registro.`, variant: "destructive" });
    } finally {
      setItemToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = Array.from(selectedItems[activeTab]);
    if (selectedIds.length === 0) return;

    setIsSubmitting(true);
    try {
      if (activeTab === 'guides') {
        await deleteBulkGuides(selectedIds);
        setGuides(prev => prev.filter(g => !selectedIds.includes(g.uid)));
      }
      else if (activeTab === 'hotels') {
        await deleteBulkHotels(selectedIds);
        setHotels(prev => prev.filter(h => !selectedIds.includes(h.id)));
      }
      else if (activeTab === 'drivers') {
        await deleteBulkDrivers(selectedIds);
        setDrivers(prev => prev.filter(d => !selectedIds.includes(d.id)));
      }
      else if (activeTab === 'activities') {
        await deleteBulkActivities(selectedIds);
        setActivities(prev => prev.filter(a => !selectedIds.includes(a.id)));
      }
      else if (activeTab === 'flights') {
        await deleteBulkFlights(selectedIds);
        setFlights(prev => prev.filter(f => !selectedIds.includes(f.id)));
      }

      toast({ title: "Eliminación Exitosa", description: `Se eliminaron ${selectedIds.length} registros.`, variant: "success" });
      setSelectedItems(prev => ({...prev, [activeTab]: new Set()})); // Clear selection
      // Optimización: Ya no recargamos desde Firebase, actualizamos estado local arriba
    } catch (error) {
      toast({ title: "Error de Eliminación", description: "No se pudieron eliminar los registros.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
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
          // Use sheet_to_json with raw:false to get formatted text for dates/times
          const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
          // Also get raw data to check for Excel's numeric date format
          const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

          // Get header row to find column indices
          const header = (json[0] || []).map((h: string) => h.toLowerCase());
          const flightNumIndex = header.indexOf('numero de vuelo');
          const timeIndex = header.indexOf('hora');
          const obsIndex = header.indexOf('observaciones');
          const nombreIndex = header.indexOf('nombre');
          const apellidoIndex = header.indexOf('apellido');


          let records: any[] = [];
          if (type === 'flights') {
              if (flightNumIndex === -1 || timeIndex === -1) {
                  throw new Error("El archivo de vuelos debe contener las columnas 'numero de vuelo' y 'hora'.");
              }
              // Skip header row by starting loop at 1
              records = json.slice(1).map((row, rowIndex) => {
                  const rawTimeValue = rawJson[rowIndex + 1] ? rawJson[rowIndex + 1][timeIndex] : undefined;
                  
                  return {
                      flightNumber: String(row[flightNumIndex] || '').trim().toUpperCase(),
                      time: formatFlightTime(rawTimeValue ?? row[timeIndex]),
                      observations: String(row[obsIndex] || '').trim()
                  };
              }).filter(f => f.flightNumber && f.time);

              if (records.length > 0) await createBulkFlights(records);

          } else if (type === 'guides') {
             if (nombreIndex === -1 || apellidoIndex === -1) {
                throw new Error("El archivo de guías debe tener las columnas 'nombre' y 'apellido'.");
            }
            records = json.slice(1).map(row => ({ 
              firstName: String(row[nombreIndex] || '').trim().toUpperCase(), 
              lastName: String(row[apellidoIndex] || '').trim().toUpperCase() 
            })).filter(g => g.firstName && g.lastName);
            if(records.length > 0) await createBulkGuides(records);

          } else {
             if (nombreIndex === -1) {
                throw new Error("El archivo debe tener una columna de 'nombre'.");
            }
            records = json.slice(1).map(row => ({ 
              name: String(row[nombreIndex] || '').trim().toUpperCase() 
            })).filter(item => item.name);
            if (records.length > 0) {
              if (type === 'hotels') await createBulkHotels(records);
              else if (type === 'drivers') await createBulkDrivers(records);
              else if (type === 'activities') await createBulkActivities(records);
            }
          }
          
          if (records.length === 0) {
            toast({ title: "Archivo Vacío o Formato Incorrecto", description: "Asegúrate que el archivo Excel tenga las columnas correctas ('nombre' y 'apellido' para guías, 'nombre' para los demás, 'numero de vuelo', 'hora', 'observaciones' para vuelos).", variant: "destructive", duration: 7000 });
          } else {
            toast({ title: "Carga Exitosa", description: `Se procesaron ${records.length} registros desde el archivo.`, variant: "success" });

            // Optimización: Solo recargar la colección específica que se subió
            if (type === 'guides') {
              const fetchedGuides = await getGuidesFromFirestore();
              setGuides(fetchedGuides);
            } else if (type === 'hotels') {
              const fetchedHotels = await getHotelsFromFirestore();
              setHotels(fetchedHotels);
            } else if (type === 'drivers') {
              const fetchedDrivers = await getDriversFromFirestore();
              setDrivers(fetchedDrivers);
            } else if (type === 'activities') {
              const fetchedActivities = await getActivitiesFromFirestore();
              setActivities(fetchedActivities);
            } else if (type === 'flights') {
              const fetchedFlights = await getFlightsFromFirestore();
              setFlights(fetchedFlights);
            }
          }

        } catch (err: any) {
          console.error("Error processing file:", err);
          toast({ title: "Error al procesar archivo", description: err.message || "Hubo un problema al leer el contenido del archivo Excel.", variant: "destructive" });
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


  const handleTabChange = (tabValue: string) => {
    router.push(`/admin/data?tab=${tabValue}`, { scroll: false });
  };
  
  const handleSelectAll = (type: DataType, items: Item[]) => {
      const allIds = items.map(item => 'uid' in item ? item.uid : item.id);
      setSelectedItems(prev => {
          const newSelection = new Set(prev[type]);
          if (newSelection.size === allIds.length) {
              // Deselect all if all are selected
              newSelection.clear();
          } else {
              // Select all
              allIds.forEach(id => newSelection.add(id));
          }
          return { ...prev, [type]: newSelection };
      });
  };

  const handleSelectItem = (type: DataType, id: string) => {
      setSelectedItems(prev => {
          const newSelection = new Set(prev[type]);
          if (newSelection.has(id)) {
              newSelection.delete(id);
          } else {
              newSelection.add(id);
          }
          return { ...prev, [type]: newSelection };
      });
  };


  const renderAddForm = (type: DataType) => (
    <Card className="mt-4">
      <CardHeader><CardTitle className="text-lg">Añadir Nuevo {type === 'flights' ? 'Vuelo' : type.slice(0, -1)}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {type === 'flights' ? (
             <div className="flex gap-2 items-center flex-col sm:flex-row">
                <Input value={newFlightNumber} onChange={(e) => setNewFlightNumber(e.target.value)} placeholder="Número de Vuelo (ej: OB305)"/>
                <Input value={newFlightTime} onChange={(e) => setNewFlightTime(e.target.value)} placeholder="Hora (ej: 08:30)"/>
                <Input value={newFlightObs} onChange={(e) => setNewFlightObs(e.target.value)} placeholder="Observaciones (opcional)"/>
             </div>
        ) : type === 'drivers' && (
           <RadioGroup defaultValue="propio" onValueChange={(val: 'propio' | 'externo') => setDriverType(val)} className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="propio" id="r-propio" />
                <Label htmlFor="r-propio">Propio (Nombre. Ej: MARIO, LUIS)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="externo" id="r-externo" />
                <Label htmlFor="r-externo">Externo (Nombre. Se añadirá prefijo &apos;CONT &apos;)</Label>
              </div>
            </RadioGroup>
        )}
        {type !== 'flights' && (
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
            </div>
        )}
        <div className="flex justify-end gap-2">
           <Button onClick={() => handleAddItem(type)} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            Añadir
          </Button>
          <BulkUploadButton dataType={type} onUpload={(file) => handleBulkUpload(file, type)} isSubmitting={isSubmitting} />
        </div>
      </CardContent>
    </Card>
  );

  const renderTable = <T extends Item>(data: T[], type: DataType) => {
    const displayName = (item: Item | ItemToDelete) => {
        if ('fullName' in item && item.fullName) return item.fullName;
        if ('flightNumber' in item && item.flightNumber) return item.flightNumber;
        if ('name' in item && item.name) return item.name;
        return '';
    };
    
    const isAllSelected = data.length > 0 && selectedItems[type].size === data.length;
    const selectedCount = selectedItems[type].size;

    return (
      <div className="border rounded-lg mt-4 overflow-hidden">
        {selectedCount > 0 && (
          <div className="p-2 bg-muted/50 flex justify-between items-center">
            <span className="text-sm font-medium">{selectedCount} de {data.length} seleccionado(s)</span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isSubmitting}>
                   {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                   Eliminar Seleccionados
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Estás seguro de que quieres eliminar {selectedCount} registro(s)? Esta acción es irreversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                    Sí, eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
        <div className="max-h-96 overflow-y-auto">
            <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                <TableHead className="w-12">
                    <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={() => handleSelectAll(type, data)}
                        aria-label="Select all"
                    />
                </TableHead>
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
                <TableRow><TableCell colSpan={type === 'flights' ? 5 : 3} className="text-center h-24">No hay datos.</TableCell></TableRow>
                ) : (
                data.map(item => {
                    const itemId = 'uid' in item ? item.uid : item.id;
                    if (!itemId) return null;
                    const isDuplicate = duplicateIds.has(itemId);

                    return (
                    <TableRow 
                        key={itemId}
                        className={cn(isDuplicate && "bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200/80 dark:hover:bg-yellow-900/50")}
                        data-state={selectedItems[type].has(itemId) ? "selected" : ""}
                    >
                        <TableCell>
                            <Checkbox
                                checked={selectedItems[type].has(itemId)}
                                onCheckedChange={() => handleSelectItem(type, itemId)}
                                aria-label={`Select item ${displayName(item)}`}
                            />
                        </TableCell>
                        <TableCell className="font-medium flex items-center gap-2">
                        {isDuplicate && <span title="Registro duplicado"><AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" /></span>}
                        {displayName(item)}
                        </TableCell>
                        {type === 'flights' && 'time' in item && (
                            <>
                                <TableCell>{formatFlightTime(item.time)}</TableCell>
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
                            {itemToDelete && ('uid' in itemToDelete ? itemToDelete.uid : itemToDelete.id) === itemId && (
                                <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    Se eliminará permanentemente &quot;{displayName(itemToDelete)}&quot;. Esta acción no se puede deshacer.
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
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-4xl mb-4 flex justify-between items-center">
        <Button variant="default" size="icon" onClick={() => router.push('/admin/dashboard')} aria-label="Go to Admin Dashboard">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center text-primary">Administrar Datos Maestros</CardTitle>
          <CardDescription className="text-center">
            Añade, elimina o sube listas de datos para los generadores. Los registros duplicados se marcarán en amarillo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="guides"><UserSquare className="mr-2 h-4 w-4" />Guías ({guides.length})</TabsTrigger>
              <TabsTrigger value="hotels"><HotelIcon className="mr-2 h-4 w-4" />Hoteles ({hotels.length})</TabsTrigger>
              <TabsTrigger value="drivers"><Car className="mr-2 h-4 w-4" />Choferes ({drivers.length})</TabsTrigger>
              <TabsTrigger value="activities"><ListChecks className="mr-2 h-4 w-4" />Actividades ({activities.length})</TabsTrigger>
              <TabsTrigger value="flights"><Plane className="mr-2 h-4 w-4" />Vuelos ({flights.length})</TabsTrigger>
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
             <TabsContent value="flights">
              {renderTable(flights, 'flights')}
              {renderAddForm('flights')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
