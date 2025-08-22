
"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from 'xlsx';
import { format, isBefore, startOfToday, parse } from 'date-fns';

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  getGuidesFromFirestore,
  getHotelsFromFirestore,
  getDriversFromFirestore,
  type ServiceOrderGuide,
  type Hotel,
  type Driver,
} from "@/lib/serviceOrderService";
import { getActivitiesFromFirestore, type Activity } from "@/lib/activityService";
import { generateServiceOrderExcel, type ServiceOrderData, type ServiceItem } from '@/lib/serviceOrderGenerator';
import { type FileDataProps, type FileSearchStatus } from "@/lib/report-generator";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, FileDown, Trash2, PlusCircle, Upload, Search, CheckCircle2, XCircle, CalendarIcon, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const defaultObsText = 'LA CAJA CHICA CUBRE 1 BOTELLA DE AGUA POR DÍA PARA CADA PAX, GUÍA Y CHOFER. NO INCLUYE TRANSFERS NI SERVICIOS EN EL LAGO.';
const defaultNotaText = 'TODOS LOS GUÍAS DEBEN ENVIAR UN INFORME DIARIO POR WHATSAPP A LA SEÑORA JUDITH SOBRE LOS SERVICIOS REALIZADOS.\nGUIA DEBE PRESENTAR COPIA DE PASAPORTE DE PAX DESPUES DE CADA SERVICIO JUNTO A SU LIQUIDACION Y CAJA CHICA';

const initialServiceOrderState: ServiceOrderData = {
  guia: '', file: '', ref: '', nPax: '', hotel: '',
  services: [],
  observations: defaultObsText,
  nota: defaultNotaText
};

const BUS_TYPES = [ { value: '8', label: 'Bus 8' }, { value: '9', label: 'Bus 9' }, { value: '10', label: 'Bus 10' }, { value: 'CONT.', label: 'Contratado (Externo)' } ];
const SESSION_STORAGE_FILE_KEY = 'serviceOrderProgramFile_v2';
const SESSION_STORAGE_FILENAME_KEY = 'serviceOrderProgramFileName_v2';

export default function ServiceOrderPage() {
  const router = useRouter();
  const { isLoading: authLoading, logout } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [guides, setGuides] = useState<ServiceOrderGuide[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [ownDrivers, setOwnDrivers] = useState<Driver[]>([]);
  const [externalDrivers, setExternalDrivers] = useState<Driver[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [orderData, setOrderData] = useState<ServiceOrderData>(initialServiceOrderState);

  const [busTypeSelection, setBusTypeSelection] = useState('');
  const [driverSelection, setDriverSelection] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<{name: string} | null>(null);
  const [excelData, setExcelData] = useState<any[][] | null>(null);
  const [fileDataProps, setFileDataProps] = useState<FileDataProps>({ fileIdRowIndex: null, columnIndex: null });
  const [fileSearchStatus, setFileSearchStatus] = useState<FileSearchStatus>("idle");
  const [isProcessingSearch, setIsProcessingSearch] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedActivity, setSelectedActivity] = useState<string>("");

   const processAndStoreFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
        setExcelData(jsonData);

        const base64 = btoa(new Uint8Array(data).reduce((res, byte) => res + String.fromCharCode(byte), ''));
        sessionStorage.setItem(SESSION_STORAGE_FILE_KEY, base64);
        sessionStorage.setItem(SESSION_STORAGE_FILENAME_KEY, file.name);

      } catch (error) {
         toast({ title: "Error", description: "No se pudo procesar el archivo. Límite de tamaño excedido.", variant: "destructive" });
         clearFile();
      }
    };
    reader.onerror = () => {
        toast({ title: "Error", description: "No se pudo leer el archivo.", variant: "destructive" });
        clearFile();
    };
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const storedFile = sessionStorage.getItem(SESSION_STORAGE_FILE_KEY);
        const storedFileName = sessionStorage.getItem(SESSION_STORAGE_FILENAME_KEY);
        if (storedFile && storedFileName) {
            try {
                const byteString = atob(storedFile);
                const byteNumbers = new Array(byteString.length);
                for (let i = 0; i < byteString.length; i++) byteNumbers[i] = byteString.charCodeAt(i);
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                const file = new File([blob], storedFileName);
                
                setSelectedFile({ name: file.name });
                const workbook = XLSX.read(byteArray, { type: 'array' });
                const ws = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
                setExcelData(jsonData);
            } catch (e) {
                console.error("Failed to load file from session storage:", e);
                clearFile(); 
            }
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    async function loadInitialData() {
        setIsLoading(true);
        try {
          const [fetchedGuides, fetchedHotels, fetchedDrivers, fetchedActivities] = await Promise.all([
            getGuidesFromFirestore(), getHotelsFromFirestore(), getDriversFromFirestore(), getActivitiesFromFirestore()
          ]);
          setGuides(fetchedGuides);
          setHotels(fetchedHotels);
          setAllDrivers(fetchedDrivers);
          setActivities(fetchedActivities);
          setOwnDrivers(fetchedDrivers.filter(d => !d.name.startsWith('CONT ')));
          setExternalDrivers(fetchedDrivers.filter(d => d.name.startsWith('CONT ')));
        } catch (error) {
          toast({ title: "Error", description: "No se pudieron cargar los datos iniciales.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
    }
    if(!authLoading) loadInitialData();
  }, [authLoading, toast]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile({ name: file.name });
      toast({ title: "Archivo Seleccionado", description: file.name, className: "bg-green-100 dark:bg-green-900 border-green-500" });
      processAndStoreFile(file);
    }
    if (event.target) event.target.value = "";
  };

  const clearFile = () => {
    setSelectedFile(null);
    setExcelData(null);
    setFileSearchStatus("idle");
    setOrderData(prev => ({...prev, file: '', ref: '', nPax: ''}));
    if (fileInputRef.current) fileInputRef.current.value = "";
    sessionStorage.removeItem(SESSION_STORAGE_FILE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_FILENAME_KEY);
    toast({ title: "Archivo Limpiado", description: "Se ha quitado el programa." });
  }

  const handleSearchFile = async () => {
    if (!selectedFile || !excelData || !orderData.file) {
      toast({ title: "Datos incompletos", description: "Sube un archivo y escribe un número de file para buscar.", variant: "destructive" });
      return;
    }
    setIsProcessingSearch(true);
    setFileSearchStatus("searching");
    await new Promise(resolve => setTimeout(resolve, 300));
    
    let found = false, colIdx = -1, rowIdx = -1;
    for (let j = 0; j < excelData[0].length; j++) {
      for (let i = 0; i < excelData.length; i++) {
        if (String(excelData[i][j]).trim().toUpperCase() === orderData.file.trim().toUpperCase()) {
          found = true; colIdx = j; rowIdx = i; break;
        }
      }
      if (found) break;
    }
    
    if (found) {
        setFileSearchStatus("found");
        const groupName = String(excelData[rowIdx + 1]?.[colIdx] || "No encontrado").toUpperCase();
        let pax = "N/A";
        for (let i = rowIdx + 2; i < excelData.length; i++) {
             const paxRaw = excelData[i]?.[colIdx];
             if (paxRaw !== null && paxRaw !== undefined) {
                 const paxValue = String(paxRaw).trim();
                 if (/^\d{1,2}$/.test(paxValue) || /^\d+\s*\+\s*\d+$/.test(paxValue)) {
                     pax = paxValue; break;
                 }
             }
        }
        setOrderData(prev => ({ ...prev, ref: groupName, nPax: pax }));
        setFileDataProps({ fileIdRowIndex: rowIdx, columnIndex: colIdx });
        toast({ title: "Búsqueda Exitosa", className: "bg-green-100 dark:bg-green-900 border-green-500" });
    } else {
        setFileSearchStatus("not_found");
        setOrderData(prev => ({ ...prev, ref: '', nPax: '' }));
        toast({ title: "Búsqueda Fallida", description: "File no encontrado.", variant: "destructive" });
    }
    setIsProcessingSearch(false);
  };
  
  const handleInputChange = (field: keyof ServiceOrderData | 'file' | 'ref' | 'nPax', value: string) => {
    setOrderData(prev => ({ ...prev, [field]: value.toUpperCase() }));
  };
  
  const handleSelectChange = (type: 'guide' | 'hotel' | 'driver', value: string) => {
    const upperValue = value.toUpperCase();
    if (type === 'guide') setOrderData(prev => ({ ...prev, guia: upperValue }));
    else if (type === 'hotel') setOrderData(prev => ({ ...prev, hotel: upperValue }));
    else if (type === 'driver') setDriverSelection(upperValue);
  };

  const handleBusTypeChange = (value: string) => {
    setBusTypeSelection(value);
    setDriverSelection('');
  }

  const addActivityToItinerary = () => {
      if (!selectedDate || !selectedActivity) {
          toast({ title: "Datos incompletos", description: "Selecciona una fecha y una actividad.", variant: "destructive" });
          return;
      }
      const activityData = activities.find(a => a.name === selectedActivity);
      const newService: ServiceItem = {
          fecha: format(selectedDate, "dd/MM/yy"),
          hora: activityData?.defaultTime || "09:00",
          servicio: activityData?.name || selectedActivity,
          vuelo: '',
          guia: guides.find(g => g.fullName.toUpperCase() === orderData.guia.toUpperCase())?.firstName || '',
          bus: busTypeSelection === 'CONT.' ? 'CONT.' : busTypeSelection,
          chofer: driverSelection,
          observaciones: ''
      };
      setOrderData(prev => ({ ...prev, services: [...prev.services, newService] }));
      setSelectedActivity("");
  }

  const handleServiceChange = (index: number, field: keyof ServiceItem, value: string) => {
    const updatedServices = [...orderData.services];
    updatedServices[index] = { ...updatedServices[index], [field]: value.toUpperCase() };
    setOrderData(prev => ({ ...prev, services: updatedServices }));
  };

  const handleTimeBlur = (index: number, value: string) => {
    const timeValue = value.replace(/[^0-9]/g, '');
    let formattedTime = value;
    if (timeValue.length === 4) {
      formattedTime = `${timeValue.substring(0, 2)}:${timeValue.substring(2, 4)}`;
    }
    const updatedServices = [...orderData.services];
    updatedServices[index] = { ...updatedServices[index], hora: formattedTime };
    setOrderData(prev => ({ ...prev, services: updatedServices }));
  }


  const removeService = (index: number) => {
    setOrderData(prev => ({ ...prev, services: prev.services.filter((_, i) => i !== index) }));
  };

  const handleDownloadExcel = async () => {
    setIsGenerating(true);
    try {
      if (!orderData.guia || !orderData.file) {
        toast({ title: "Datos incompletos", description: "El nombre del guía y el file son obligatorios.", variant: "destructive" });
        return;
      }
      const buffer = await generateServiceOrderExcel(orderData);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Orden_Servicio_${orderData.file.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Descarga Exitosa", className: "bg-green-100 dark:bg-green-900 border-green-500"});
    } catch(error) {
      toast({ title: "Error", description: "No se pudo generar el archivo Excel.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const guideOptions = guides.map(g => ({ value: g.fullName.toUpperCase(), label: g.fullName }));
  const hotelOptions = hotels.map(h => ({ value: h.name.toUpperCase(), label: h.name }));
  const activityOptions = activities.map(a => ({ value: a.name.toUpperCase(), label: a.name }));
  const driverOptions = (busTypeSelection === 'CONT.' ? externalDrivers : ownDrivers).map(d => ({ value: d.name.toUpperCase(), label: d.name.replace(/^CONT\s/i, '') }));

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8 bg-background">
      <div className="w-full max-w-7xl mb-4"><Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back"><ArrowLeft className="h-5 w-5" /></Button></div>

      <div className="w-full max-w-7xl space-y-6">
        <Card className="shadow-lg">
          <CardHeader><CardTitle className="text-2xl font-headline text-primary">Generador de Órdenes de Servicio</CardTitle><CardDescription>Sube, busca y completa los campos para generar la orden.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-4 p-4 border rounded-lg bg-card">
                  <div className="flex items-center gap-2">
                      <Label className="font-semibold shrink-0">Programa:</Label>
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className={cn("flex-grow justify-start text-left font-normal", selectedFile && "border-green-500")}>
                          <Upload className="mr-2 h-4 w-4" />{selectedFile ? selectedFile.name : "Seleccionar archivo .xlsx"}
                      </Button>
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx,.xls"/>
                      {selectedFile && <Button type="button" variant="destructive" size="icon" onClick={clearFile} title="Limpiar archivo"><Trash2 className="h-4 w-4"/></Button>}
                  </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="md:col-span-1">
                            <Label htmlFor="file">Buscar File:</Label>
                            <div className="flex items-center gap-2 mt-1">
                                <Input id="file" value={orderData.file} onChange={e => handleInputChange('file', e.target.value)} placeholder="Número de file..." className={cn(fileSearchStatus === "found" && "border-green-500")} />
                                <Button type="button" onClick={handleSearchFile} variant="default" size="icon" disabled={!selectedFile || !orderData.file || isProcessingSearch}>
                                  {isProcessingSearch ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="md:col-span-1"><Label htmlFor="ref">Ref (Nombre Grupo):</Label><Input id="ref" value={orderData.ref} onChange={e => handleInputChange('ref', e.target.value)} className={cn("mt-1", fileSearchStatus === "found" && "border-green-500")} /></div>
                        <div className="md:col-span-1"><Label htmlFor="nPax">Nº Pax:</Label><Input id="nPax" value={orderData.nPax} onChange={e => handleInputChange('nPax', e.target.value)} className={cn("mt-1", fileSearchStatus === "found" && "border-green-500")} /></div>
                  </div>
                  {fileSearchStatus === "not_found" && (<div className="flex items-center gap-2 text-destructive text-sm"><XCircle className="h-4 w-4" /> File no encontrado.</div>)}
              </div>
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
                  <div><Label>Guía</Label><Combobox options={guideOptions} value={orderData.guia.toUpperCase()} onSelect={(val) => handleSelectChange('guide', val)} placeholder="Buscar guía..." className="mt-1" /></div>
                  <div><Label>Hotel</Label><Combobox options={hotelOptions} value={orderData.hotel.toUpperCase()} onSelect={(val) => handleSelectChange('hotel', val)} placeholder="Buscar hotel..." className="mt-1" /></div>
                  <div><Label>Bus/Tipo Chofer</Label><Select value={busTypeSelection} onValueChange={handleBusTypeChange}><SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{BUS_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Chofer</Label><Combobox options={driverOptions} value={driverSelection.toUpperCase()} onSelect={(val) => handleSelectChange('driver', val)} placeholder="Seleccionar chofer..." className="mt-1" /></div>
              </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
            <CardHeader><CardTitle>Añadir Actividad al Itinerario</CardTitle></CardHeader>
            <CardContent className="flex flex-col md:flex-row items-end gap-4">
                <div className="w-full md:w-auto"><Label>Fecha</Label>
                    <Popover><PopoverTrigger asChild>
                       <div className="relative mt-1 md:w-[150px]">
                          <Input
                              value={selectedDate ? format(selectedDate, "dd/MM/yy") : ''}
                              onChange={(e) => {
                                const parsedDate = parse(e.target.value, "dd/MM/yy", new Date());
                                if (!isNaN(parsedDate.getTime())) {
                                  setSelectedDate(parsedDate);
                                }
                              }}
                              placeholder="dd/MM/yy" className="pr-8" />
                          <CalendarIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer" />
                       </div>
                    </PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} disabled={(date) => isBefore(date, startOfToday())} initialFocus /></PopoverContent></Popover>
                </div>
                <div className="flex-1 w-full md:max-w-lg"><Label>Actividad</Label><Combobox options={activityOptions} value={selectedActivity} onSelect={setSelectedActivity} placeholder="Buscar actividad..." className="mt-1" /></div>
                <div><Button onClick={addActivityToItinerary} className="w-full md:w-auto"><PlusCircle className="mr-2 h-4 w-4"/>Añadir</Button></div>
            </CardContent>
        </Card>
        
        <Card className="shadow-lg">
          <CardHeader><CardTitle>Tabla Resumen del Itinerario</CardTitle></CardHeader>
          <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow>
            <TableHead className="w-[140px] bg-muted/50">Fecha</TableHead>
            <TableHead className="w-[100px] bg-muted/50">Hora</TableHead>
            <TableHead className="w-[400px] bg-muted/50">Servicio</TableHead>
            <TableHead className="w-[180px] bg-muted/50">Guía</TableHead>
            <TableHead className="w-[80px] bg-muted/50">Bus</TableHead>
            <TableHead className="w-[180px] bg-muted/50">Chofer</TableHead>
            <TableHead className="w-[300px] bg-muted/50">Observaciones</TableHead>
            <TableHead className="text-right w-[80px] bg-muted/50">Acción</TableHead>
          </TableRow></TableHeader><TableBody>
            {orderData.services.length > 0 ? orderData.services.map((service, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Input 
                    value={service.fecha} 
                    onChange={e => handleServiceChange(index, 'fecha', e.target.value)} 
                    placeholder="dd/MM/yy"
                    className="min-w-[120px]"
                  />
                </TableCell>
                <TableCell>
                  <Input 
                    value={service.hora} 
                    onChange={e => handleServiceChange(index, 'hora', e.target.value)}
                    onBlur={e => handleTimeBlur(index, e.target.value)}
                    placeholder="HH:mm" 
                    className="min-w-[80px]"
                  />
                </TableCell>
                <TableCell><Input className="min-w-[300px]" value={service.servicio} onChange={e => handleServiceChange(index, 'servicio', e.target.value)} /></TableCell>
                <TableCell><Input className="min-w-[120px]" value={service.guia} onChange={e => handleServiceChange(index, 'guia', e.target.value)} /></TableCell>
                <TableCell><Input className="min-w-[70px]" value={service.bus} onChange={e => handleServiceChange(index, 'bus', e.target.value)} /></TableCell>
                <TableCell><Input className="min-w-[120px]" value={service.chofer?.replace(/^CONT\s/i, '')} onChange={e => handleServiceChange(index, 'chofer', e.target.value)} /></TableCell>
                <TableCell><Input className="min-w-[200px]" value={service.observaciones} onChange={e => handleServiceChange(index, 'observaciones', e.target.value)} /></TableCell>
                <TableCell className="text-right"><Button variant="destructive" size="icon" onClick={() => removeService(index)}><Trash2 className="h-4 w-4"/></Button></TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">Añade actividades para construir el itinerario.</TableCell></TableRow>
            )}
          </TableBody></Table></div></CardContent>
        </Card>
        
         <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-medium">Observaciones y Notas Finales</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div><Label htmlFor="observaciones">Observaciones Generales</Label><Textarea id="observaciones" value={orderData.observations} onChange={e => handleInputChange('observations', e.target.value)} className="mt-1" rows={3}/></div>
                <div><Label htmlFor="nota">Nota (Pie de página)</Label><Textarea id="nota" value={orderData.nota} onChange={e => handleInputChange('nota', e.target.value)} className="mt-1" rows={5}/></div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

        <Card className="shadow-lg">
          <CardHeader><CardTitle className="text-xl">Finalizar</CardTitle><CardDescription>Genera y descarga el archivo final.</CardDescription></CardHeader>
          <CardContent><Button onClick={handleDownloadExcel} className="w-full sm:w-auto" disabled={isGenerating}>{isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileDown className="mr-2 h-4 w-4"/>} Generar y Descargar Excel</Button></CardContent>
        </Card>
      </div>
    </div>
  );
}
