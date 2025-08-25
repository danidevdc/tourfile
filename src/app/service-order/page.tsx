
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
  getActivitiesFromFirestore,
  type Activity,
} from "@/lib/serviceOrderService";
import { generateServiceOrderExcel, type ServiceOrderData, type ServiceItem } from '@/lib/serviceOrderGenerator';
import { type FileDataProps, type FileSearchStatus } from "@/lib/report-generator";
import { ItineraryEditModal } from '@/components/service-order/ItineraryEditModal';


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, FileDown, PlusCircle, Upload, Search, CheckCircle2, XCircle, CalendarIcon, Edit } from "lucide-react";
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
  services: [], // Start with empty services, will be built from the form
  observations: defaultObsText,
  nota: defaultNotaText
};

const initialNewServiceState: ServiceItem = {
    fecha: '', hora: '09:00', servicio: '', vuelo: '', guia: '', bus: '', chofer: '', observaciones: ''
};

const BUS_TYPES = [ { value: '8', label: 'Bus 8' }, { value: '9', label: 'Bus 9' }, { value: '10', label: 'Bus 10' }, { value: 'CONT.', label: 'Contratado (Externo)' } ];
const SESSION_STORAGE_FILE_KEY = 'serviceOrderProgramFile_v2';
const SESSION_STORAGE_FILENAME_KEY = 'serviceOrderProgramFileName_v2';

export default function ServiceOrderPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [guides, setGuides] = useState<ServiceOrderGuide[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [ownDrivers, setOwnDrivers] = useState<Driver[]>([]);
  const [externalDrivers, setExternalDrivers] = useState<Driver[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [orderData, setOrderData] = useState<ServiceOrderData>(initialServiceOrderState);
  const [newService, setNewService] = useState<ServiceItem>(initialNewServiceState);

  const [busTypeSelection, setBusTypeSelection] = useState('');
  const [choferSelection, setChoferSelection] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<{name: string} | null>(null);
  const [excelData, setExcelData] = useState<any[][] | null>(null);
  const [fileDataProps, setFileDataProps] = useState<FileDataProps>({ fileIdRowIndex: null, columnIndex: null });
  const [fileSearchStatus, setFileSearchStatus] = useState<FileSearchStatus>("idle");
  const [isProcessingSearch, setIsProcessingSearch] = useState(false);


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
  
  const handleSelectChange = (type: 'guide' | 'hotel', value: string) => {
    const upperValue = value.toUpperCase();
    if (type === 'guide') setOrderData(prev => ({ ...prev, guia: upperValue }));
    else if (type === 'hotel') setOrderData(prev => ({ ...prev, hotel: upperValue }));
  };

  const handleBusTypeChange = (value: string) => {
    setBusTypeSelection(value);
    setChoferSelection(''); // Reset chofer when bus type changes
  }

  const handleDateInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numbersOnly = rawValue.replace(/[^0-9]/g, '');
    let formatted = '';

    if (numbersOnly.length > 0) formatted = numbersOnly.slice(0, 2);
    if (numbersOnly.length > 2) formatted += '/' + numbersOnly.slice(2, 4);
    if (numbersOnly.length > 4) formatted += '/' + numbersOnly.slice(4, 8);
    
    setNewService(prev => ({...prev, fecha: formatted}));
  };
  
  const handleTimeInputChange = (e: ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const numbersOnly = rawValue.replace(/[^0-9]/g, '');
      let formatted = '';

      if (numbersOnly.length > 0) formatted = numbersOnly.slice(0, 2);
      if (numbersOnly.length > 2) formatted += ':' + numbersOnly.slice(2, 4);

      setNewService(prev => ({...prev, hora: formatted}));
  };

  const handleTimeInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/[^\d]/g, '');
      if (rawValue.length >= 2) {
          const hours = rawValue.slice(0, 2);
          const minutes = rawValue.slice(2, 4) || '00';
          setNewService(prev => ({...prev, hora: `${hours}:${minutes}`}));
      }
  };

  const handleNewServiceChange = (field: keyof ServiceItem, value: string) => {
    setNewService(prev => ({ ...prev, [field]: value.toUpperCase() }));
  };

  const addNewServiceRow = () => {
    const selectedGuide = guides.find(g => g.fullName.toUpperCase() === orderData.guia.toUpperCase());
    const serviceToAdd: ServiceItem = {
      ...newService,
      guia: selectedGuide ? selectedGuide.firstName.toUpperCase() : '',
      bus: busTypeSelection === 'CONT.' ? 'CONT.' : busTypeSelection,
      chofer: choferSelection,
    };
    setOrderData(prev => ({ ...prev, services: [...prev.services, serviceToAdd]}));
    // Reset form for next entry
    setNewService({ ...initialNewServiceState, fecha: newService.fecha });
  }
  
  const handleSaveFromModal = (updatedServices: ServiceItem[]) => {
      setOrderData(prev => ({...prev, services: updatedServices}));
      setIsModalOpen(false);
      toast({ title: "Itinerario Actualizado", className: "bg-green-100 dark:bg-green-900 border-green-500"});
  }

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
  
  const guideOptions = guides.map(g => ({ value: g.fullName.toUpperCase(), label: g.fullName }));
  const hotelOptions = hotels.map(h => ({ value: h.name.toUpperCase(), label: h.name }));
  const driverOptions = (busTypeSelection === 'CONT.' ? externalDrivers : ownDrivers).map(d => ({ value: d.name.toUpperCase(), label: d.name.replace(/^CONT\s/i, '') }));
  const activityOptions = (activities || []).filter(a => a && a.name).map(a => ({ value: a.name.toUpperCase(), label: a.name }));
  
  const isAddServiceDisabled =
    !orderData.file.trim() ||
    !orderData.ref.trim() ||
    !orderData.nPax.trim() ||
    !orderData.guia.trim() ||
    !busTypeSelection.trim() ||
    !choferSelection.trim();


  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8 bg-background space-y-6">
      <div className="w-full max-w-7xl"><Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back"><ArrowLeft className="h-5 w-5" /></Button></div>

       <Card className="w-full max-w-7xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-primary">Generador de Órdenes de Servicio</CardTitle>
            <CardDescription>Completa los campos para generar la orden. Puedes añadir múltiples servicios.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              {/* --- FILE UPLOAD AND SEARCH --- */}
              <div className="space-y-4 p-4 border rounded-lg bg-card">
                  <div className="flex items-center gap-2">
                      <Label className="font-semibold shrink-0">Programa:</Label>
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className={cn("flex-grow justify-start text-left font-normal", selectedFile && "border-green-500")}>
                          <Upload className="mr-2 h-4 w-4" />{selectedFile ? selectedFile.name : "Seleccionar archivo .xlsx"}
                      </Button>
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx,.xls"/>
                      {selectedFile && <Button type="button" variant="destructive" size="icon" onClick={clearFile} title="Limpiar archivo"><PlusCircle className="h-4 w-4 rotate-45"/></Button>}
                  </div>
                   <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-3">
                            <Label htmlFor="file">Buscar File:</Label>
                            <div className="flex items-center gap-2 mt-1">
                                <Input id="file" value={orderData.file} onChange={e => handleInputChange('file', e.target.value)} placeholder="Número de file..." className={cn(fileSearchStatus === "found" && "border-green-500 bg-green-50 dark:bg-green-900/20")} />
                                <Button type="button" onClick={handleSearchFile} variant="default" size="icon" disabled={!selectedFile || !orderData.file || isProcessingSearch}>
                                  {isProcessingSearch ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="md:col-span-7"><Label htmlFor="ref">Ref (Nombre Grupo):</Label><Input id="ref" value={orderData.ref} onChange={e => handleInputChange('ref', e.target.value)} className={cn("mt-1", fileSearchStatus === "found" && "border-green-500 bg-green-50 dark:bg-green-900/20")} /></div>
                        <div className="md:col-span-2"><Label htmlFor="nPax">Nº Pax:</Label><Input id="nPax" value={orderData.nPax} onChange={e => handleInputChange('nPax', e.target.value)} className={cn("mt-1", fileSearchStatus === "found" && "border-green-500 bg-green-50 dark:bg-green-900/20")} /></div>
                  </div>
                  {fileSearchStatus === "not_found" && (<div className="flex items-center gap-2 text-destructive text-sm"><XCircle className="h-4 w-4" /> File no encontrado.</div>)}
              </div>

               {/* --- MAIN DETAILS --- */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
                  <div><Label>Guía Principal</Label><Combobox options={guideOptions} value={orderData.guia.toUpperCase()} onSelect={(val) => handleSelectChange('guide', val)} placeholder="Buscar guía..." className="mt-1" /></div>
                  <div><Label>Hotel</Label><Combobox options={hotelOptions} value={orderData.hotel.toUpperCase()} onSelect={(val) => handleSelectChange('hotel', val)} placeholder="Buscar hotel..." className="mt-1" /></div>
                  <div><Label>Bus/Tipo Chofer</Label><Select value={busTypeSelection} onValueChange={handleBusTypeChange}><SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{BUS_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                   <div><Label>Chofer</Label><Combobox options={driverOptions} value={choferSelection.toUpperCase()} onSelect={(val) => setChoferSelection(val)} placeholder="Seleccionar chofer..." className="mt-1" /></div>
              </div>
              
                {/* --- Add Itinerary Item Form --- */}
                <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="text-lg font-medium">Añadir Servicio al Itinerario</h3>
                    <div className="grid grid-cols-1 md:grid-cols-12 items-end gap-2 p-2">
                        <div className="md:col-span-3">
                            <Label>Fecha</Label>
                            <div className="relative mt-1">
                                <Input 
                                    value={newService.fecha} 
                                    onChange={(e) => handleDateInputChange(e)} 
                                    placeholder="dd/MM/yyyy" 
                                    maxLength={10} 
                                />
                                <Popover>
                                    <PopoverTrigger asChild><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"><CalendarIcon className="h-4 w-4 text-muted-foreground" /></button></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newService.fecha ? parse(newService.fecha, "dd/MM/yyyy", new Date()) : undefined} onSelect={(date) => date && handleNewServiceChange('fecha', format(date, "dd/MM/yyyy"))} disabled={(date) => isBefore(date, startOfToday())} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <div className="md:col-span-6"><Label>Actividad</Label><Combobox options={activityOptions} value={newService.servicio.toUpperCase()} onSelect={(val) => handleNewServiceChange('servicio', val)} placeholder="Buscar actividad..." className="w-full mt-1"/></div>
                        <div className="md:col-span-2"><Label>Hora</Label><Input value={newService.hora} onChange={(e) => handleTimeInputChange(e)} onBlur={(e) => handleTimeInputBlur(e)} placeholder="HH:mm" maxLength={5} className="mt-1"/></div>
                        <div className="md:col-span-1">
                            <Button onClick={addNewServiceRow} variant="outline" size="icon" className="bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-800 w-full" disabled={isAddServiceDisabled}>
                                <PlusCircle className="h-5 w-5"/>
                            </Button>
                        </div>
                    </div>
                </div>

              {/* --- SUMMARY & EDIT --- */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Resumen del Itinerario</CardTitle>
                        <CardDescription>Previsualización de la orden de servicio.</CardDescription>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Edit className="mr-2 h-4 w-4" />
                        Editar Itinerario Completo
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="bg-muted/50 min-w-[120px]">Fecha</TableHead>
                                    <TableHead className="bg-muted/50 min-w-[100px]">Hora</TableHead>
                                    <TableHead className="bg-muted/50">Servicio</TableHead>
                                    <TableHead className="bg-muted/50 min-w-[180px]">Guía</TableHead>
                                    <TableHead className="bg-muted/50 min-w-[80px]">Bus</TableHead>
                                    <TableHead className="bg-muted/50 min-w-[180px]">Chofer</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orderData.services.length > 0 ? orderData.services.map((service, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{service.fecha}</TableCell>
                                        <TableCell>{service.hora}</TableCell>
                                        <TableCell>{service.servicio}</TableCell>
                                        <TableCell>{service.guia}</TableCell>
                                        <TableCell>{service.bus}</TableCell>
                                        <TableCell>{service.chofer?.replace(/^CONT\s/i, '')}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">El itinerario está vacío.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
              </Card>

              {isModalOpen && (
                  <ItineraryEditModal 
                      services={orderData.services}
                      guides={guides}
                      drivers={allDrivers}
                      onSave={handleSaveFromModal}
                      onClose={() => setIsModalOpen(false)}
                   />
              )}

              <Card>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger className="text-lg font-medium p-6">Observaciones y Notas Finales</AccordionTrigger>
                      <AccordionContent className="space-y-4 px-6 pb-6">
                        <div><Label htmlFor="observaciones">Observaciones Generales</Label><Textarea id="observaciones" value={orderData.observations} onChange={e => handleInputChange('observations', e.target.value)} className="mt-1" rows={3}/></div>
                        <div><Label htmlFor="nota">Nota (Pie de página)</Label><Textarea id="nota" value={orderData.nota} onChange={e => handleInputChange('nota', e.target.value)} className="mt-1" rows={5}/></div>
                      </AccordionContent>
                    </AccordionItem>
                </Accordion>
              </Card>

              {/* --- DOWNLOAD --- */}
              <Card>
                <CardHeader><CardTitle className="text-xl">Finalizar</CardTitle><CardDescription>Genera y descarga el archivo final.</CardDescription></CardHeader>
                <CardContent><Button onClick={handleDownloadExcel} className="w-full sm:w-auto" disabled={isGenerating}>{isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileDown className="mr-2 h-4 w-4"/>} Generar y Descargar Excel</Button></CardContent>
              </Card>

          </CardContent>
        </Card>
    </div>
  );
}
