
"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { format, parse } from 'date-fns';

import {
  getGuidesFromFirestore, getHotelsFromFirestore, getDriversFromFirestore, getActivitiesFromFirestore,
  recordActivityTimeUsage, getSuggestedTimeForActivity,
  type ServiceOrderGuide, type Hotel, type Driver, type Activity, type ServiceItem,
} from '@/lib/serviceOrderService';
import { type ServiceOrderData } from '@/lib/serviceOrderGenerator';
import { saveServiceOrder, updateServiceOrder, type StoredServiceOrder } from '@/lib/serviceOrderStorage';
import { findFlight, type FindFlightInput } from "@/ai/flows/find-flight-flow";
import { incrementFlightSearchCount } from "@/lib/flightSearchCounterService";

import { ItineraryEditModal } from '@/components/service-order/ItineraryEditModal';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, PlusCircle, Upload, Search, Edit, Plane, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileSearchStatus } from "@/lib/report-generator";

const defaultObsText = 'LA CAJA CHICA CUBRE 1 BOTELLA DE AGUA POR DÍA PARA CADA PAX, GUÍA Y CHOFER. NO INCLUYE TRANSFERS NI SERVICIOS EN EL LAGO.';
const defaultNotaText = 'TODOS LOS GUÍAS DEBEN ENVIAR UN INFORME DIARIO POR WHATSAPP A LA SEÑORA JUDITH SOBRE LOS SERVICIOS REALIZADOS.\nGUIA DEBE PRESENTAR COPIA DE PASAPORTE DE PAX DESPUES DE CADA SERVICIO JUNTO A SU LIQUIDACION Y CAJA CHICA';

const SESSION_STORAGE_FILE_KEY = 'serviceOrderProgramFile_v2';
const SESSION_STORAGE_FILENAME_KEY = 'serviceOrderProgramFileName_v2';

interface ServiceOrderGeneratorSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    existingOrder: StoredServiceOrder | null;
}

export function ServiceOrderGeneratorSheet({ isOpen, onClose, onSave, existingOrder }: ServiceOrderGeneratorSheetProps) {
    const { currentUser } = useAuth();
    const { toast } = useToast();

    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const [guides, setGuides] = useState<ServiceOrderGuide[]>([]);
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
    const [ownDrivers, setOwnDrivers] = useState<Driver[]>([]);
    const [externalDrivers, setExternalDrivers] = useState<Driver[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSearchingFlight, setIsSearchingFlight] = useState(false);
    const [showFlightSearch, setShowFlightSearch] = useState(false);
    const [flightSearchNumber, setFlightSearchNumber] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<{name: string} | null>(null);
    const [excelData, setExcelData] = useState<any[][] | null>(null);
    const [fileSearchStatus, setFileSearchStatus] = useState<FileSearchStatus>("idle");
    const [isProcessingSearch, setIsProcessingSearch] = useState(false);

    const [orderData, setOrderData] = useState<ServiceOrderData>({
        guia: '', file: '', ref: '', nPax: '', hotel: '', services: [],
        observations: defaultObsText, nota: defaultNotaText
    });
    const [newService, setNewService] = useState<ServiceItem>({
        fecha: format(new Date(), 'yyyy-MM-dd'), hora: '09:00', servicio: '', vuelo: '', guia: '', bus: '', chofer: '', observaciones: ''
    });
    const [busTypeSelection, setBusTypeSelection] = useState('');
    const [choferSelection, setChoferSelection] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (existingOrder) {
                setOrderData(existingOrder.data);
            } else {
                setOrderData({
                    guia: '', file: '', ref: '', nPax: '', hotel: '', services: [],
                    observations: defaultObsText, nota: defaultNotaText
                });
            }
        }
    }, [isOpen, existingOrder]);


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
                    const file = new File([new Blob([byteArray])], storedFileName);
                    setSelectedFile({ name: file.name });
                    const workbook = XLSX.read(byteArray, { type: 'array' });
                    setExcelData(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, blankrows: false, defval: null }));
                } catch (e) {
                    clearFile();
                }
            }
        }
    }, []);

    useEffect(() => {
        async function loadInitialData() {
            setIsLoadingData(true);
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
                setIsLoadingData(false);
            }
        }
        loadInitialData();
    }, [toast]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile({ name: file.name });
            toast({ title: "Archivo Seleccionado", className: "bg-green-100 dark:bg-green-900 border-green-500" });
            processAndStoreFile(file);
        }
        if (event.target) event.target.value = "";
    };

    const clearFile = () => {
        setSelectedFile(null); setExcelData(null); setFileSearchStatus("idle");
        setOrderData(prev => ({ ...prev, file: '', ref: '', nPax: '' }));
        if (fileInputRef.current) fileInputRef.current.value = "";
        sessionStorage.removeItem(SESSION_STORAGE_FILE_KEY);
        sessionStorage.removeItem(SESSION_STORAGE_FILENAME_KEY);
        toast({ title: "Archivo Limpiado" });
    };

    const handleSearchFile = async () => {
        if (!selectedFile || !excelData || !orderData.file) {
            toast({ title: "Datos incompletos", variant: "destructive" }); return;
        }
        setIsProcessingSearch(true); setFileSearchStatus("searching");
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
                    if (/^\\d{1,2}$/.test(paxValue) || /^\\d+\\s*\\+\\s*\\d+$/.test(paxValue)) {
                        pax = paxValue; break;
                    }
                }
            }
            setOrderData(prev => ({ ...prev, ref: groupName, nPax: pax }));
            toast({ title: "Búsqueda Exitosa", className: "bg-green-100 dark:bg-green-900 border-green-500" });
        } else {
            setFileSearchStatus("not_found");
            setOrderData(prev => ({ ...prev, ref: '', nPax: '' }));
            toast({ title: "Búsqueda Fallida", variant: "destructive" });
        }
        setIsProcessingSearch(false);
    };

    const handleInputChange = (field: keyof ServiceOrderData, value: string) => {
        setOrderData(prev => ({ ...prev, [field]: value.toUpperCase() }));
    };

    const handleSelectChange = (type: 'guide' | 'hotel', value: string) => {
        const upperValue = value.toUpperCase();
        if (type === 'guide') setOrderData(prev => ({ ...prev, guia: upperValue }));
        else if (type === 'hotel') setOrderData(prev => ({ ...prev, hotel: upperValue }));
    };

    const handleNewServiceChange = (field: keyof ServiceItem, value: string) => {
        setNewService(prev => ({ ...prev, [field]: value.toUpperCase() }));
    };

    const handleActivitySelect = async (activityName: string) => {
        handleNewServiceChange('servicio', activityName);
        setShowFlightSearch(activityName === 'TRF IN' || activityName === 'TRF OUT');
        const suggestedTime = await getSuggestedTimeForActivity(activityName);
        if (suggestedTime) handleNewServiceChange('hora', suggestedTime);
    };
    
    const handleFlightSearch = async () => {
        const { servicio, fecha } = newService;
        const normalizedFlightNumber = flightSearchNumber.trim().toUpperCase();
        if (!normalizedFlightNumber || (servicio !== 'TRF IN' && servicio !== 'TRF OUT') || !fecha) {
            toast({ title: "Datos incompletos", variant: "destructive" }); return;
        }
        await incrementFlightSearchCount();
        setIsSearchingFlight(true);
        try {
            const flightDetails = await findFlight({ flightNumber: normalizedFlightNumber, date: fecha });
            if (flightDetails.flightFound && flightDetails.departure?.time.scheduled && flightDetails.arrival?.time.scheduled) {
                let newTime = '', newObservation = '';
                const flightSegment = flightDetails.flightSegment || 'N/A';
                if (servicio === 'TRF IN') {
                    const pickupTime = parse(flightDetails.arrival.time.scheduled, 'HH:mm', new Date());
                    newTime = format(new Date(pickupTime.getTime() - 60 * 60 * 1000), 'HH:mm'); // 1 hour before
                    newObservation = `VUELO LLEGA ${flightDetails.arrival.time.scheduled}. ${flightSegment}`;
                } else {
                    const departureTime = parse(flightDetails.departure.time.scheduled, 'HH:mm', new Date());
                    newTime = format(new Date(departureTime.getTime() - 2 * 60 * 60 * 1000), 'HH:mm'); // 2 hours before
                    newObservation = `VUELO SALE ${flightDetails.departure.time.scheduled}. ${flightSegment}`;
                }
                setNewService(prev => ({ ...prev, vuelo: normalizedFlightNumber, hora: newTime, observaciones: newObservation }));
                toast({ title: "Vuelo encontrado", className: "bg-green-100" });
            } else {
                setNewService(prev => ({ ...prev, vuelo: normalizedFlightNumber, observaciones: 'VUELO NO ENCONTRADO EN API' }));
                toast({ title: "Vuelo no encontrado", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error en búsqueda de vuelo", variant: "destructive" });
        } finally {
            setIsSearchingFlight(false);
        }
    };

    const addNewServiceRow = () => {
        const selectedGuide = guides.find(g => g.fullName.toUpperCase() === orderData.guia.toUpperCase());
        const serviceToAdd: ServiceItem = {
            ...newService,
            fecha: format(parse(newService.fecha, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy'),
            guia: selectedGuide?.firstName.toUpperCase() || '',
            bus: busTypeSelection === 'CONT.' ? 'CONT.' : busTypeSelection,
            chofer: choferSelection,
        };
        setOrderData(prev => ({ ...prev, services: [...prev.services, serviceToAdd] }));
        setNewService(prev => ({ ...initialNewServiceState, fecha: prev.fecha }));
        setShowFlightSearch(false); setFlightSearchNumber(''); setChoferSelection(''); setBusTypeSelection('');
    };

    const handleSaveFromModal = (updatedServices: ServiceItem[]) => {
        setOrderData(prev => ({...prev, services: updatedServices}));
        setIsModalOpen(false);
    };

    const handleSaveOrder = async () => {
        if (!orderData.guia || !orderData.file || !currentUser?.email) {
            toast({ title: "Datos Requeridos", description: "El guía y el número de file son obligatorios.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            if (existingOrder?.id) {
                await updateServiceOrder(existingOrder.id, orderData);
                toast({ title: "Éxito", description: "Orden de servicio actualizada.", className: "bg-green-100" });
            } else {
                for (const service of orderData.services) {
                    if (service.servicio && service.hora) {
                        await recordActivityTimeUsage(service.servicio, service.hora);
                    }
                }
                await saveServiceOrder(orderData, currentUser.email);
                toast({ title: "Éxito", description: "Orden de servicio guardada.", className: "bg-green-100" });
            }
            onSave();
        } catch (error) {
            toast({ title: "Error", description: "No se pudo guardar la orden de servicio.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const guideOptions = guides.map(g => ({ value: g.fullName.toUpperCase(), label: g.fullName }));
    const hotelOptions = hotels.map(h => ({ value: h.name.toUpperCase(), label: h.name }));
    const driverOptions = (busTypeSelection === 'CONT.' ? externalDrivers : ownDrivers).map(d => ({ value: d.name.toUpperCase(), label: d.name.replace(/^CONT\\s/i, '') }));
    const activityOptions = activities.map(a => ({ value: a.name.toUpperCase(), label: a.name }));
    const isAddServiceDisabled = !newService.fecha.trim() || !newService.servicio.trim() || !newService.hora.trim();

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-full sm:max-w-4xl flex flex-col">
                <SheetHeader>
                    <SheetTitle className="text-2xl font-headline text-primary">{existingOrder ? "Editar Orden de Servicio" : "Crear Nueva Orden de Servicio"}</SheetTitle>
                    <SheetDescription>{existingOrder ? `Editando la orden ${existingOrder.orderName}` : "Completa los campos para generar la orden. Puedes añadir múltiples servicios."}</SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-grow pr-6 -mr-6">
                    <div className="space-y-4 py-4">
                        <div className="space-y-2 p-4 border rounded-lg">
                            <div className="flex items-center gap-2">
                                <Label className="shrink-0">Programa:</Label>
                                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className={cn("flex-grow", selectedFile && "border-green-500")}>
                                    <Upload className="mr-2 h-4 w-4" />{selectedFile ? selectedFile.name : "Seleccionar .xlsx"}
                                </Button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx,.xls"/>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                                <div className="md:col-span-3">
                                    <Label htmlFor="file">File:</Label>
                                    <div className="flex items-center gap-1 mt-1">
                                        <Input id="file" value={orderData.file} onChange={e => handleInputChange('file', e.target.value)} />
                                        <Button type="button" onClick={handleSearchFile} size="icon" disabled={!selectedFile || !orderData.file || isProcessingSearch}>
                                            {isProcessingSearch ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                                <div className="md:col-span-6"><Label htmlFor="ref">Ref (Grupo):</Label><Input id="ref" value={orderData.ref} onChange={e => handleInputChange('ref', e.target.value)} className="mt-1" /></div>
                                <div className="md:col-span-3"><Label htmlFor="nPax">Nº Pax:</Label><Input id="nPax" value={orderData.nPax} onChange={e => handleInputChange('nPax', e.target.value)} className="mt-1" /></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg">
                            <div><Label>Guía Principal</Label><Combobox options={guideOptions} value={orderData.guia} onSelect={(val) => handleSelectChange('guide', val)} placeholder="Buscar guía..." className="mt-1"/></div>
                            <div><Label>Hotel</Label><Combobox options={hotelOptions} value={orderData.hotel} onSelect={(val) => handleSelectChange('hotel', val)} placeholder="Buscar hotel..." className="mt-1"/></div>
                            <div><Label>Bus/Tipo Chofer</Label><Select value={busTypeSelection} onValueChange={setBusTypeSelection}><SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{[{ value: '8', label: 'Bus 8' }, { value: '9', label: 'Bus 9' }, { value: '10', label: 'Bus 10' }, { value: 'CONT.', label: 'Contratado' }].map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                            <div><Label>Chofer</Label><Combobox options={driverOptions} value={choferSelection} onSelect={setChoferSelection} placeholder="Seleccionar chofer..." className="mt-1"/></div>
                        </div>
                        
                        <div className="p-4 border rounded-lg">
                            <h3 className="font-semibold mb-2">Añadir Servicio</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-12 items-end gap-2">
                                <div className="sm:col-span-2"><Label>Fecha</Label><Input type="date" value={newService.fecha} onChange={(e) => handleNewServiceChange('fecha', e.target.value)} className="mt-1"/></div>
                                <div className={cn("sm:col-span-4", showFlightSearch && "sm:col-span-2")}><Label>Actividad</Label><Combobox options={activityOptions} value={newService.servicio} onSelect={handleActivitySelect} placeholder="Buscar actividad..." className="mt-1"/></div>
                                {showFlightSearch && (<div className="sm:col-span-3"><Label>Buscar Vuelo</Label><div className="flex items-center gap-1 mt-1"><Input value={flightSearchNumber} onChange={(e) => setFlightSearchNumber(e.target.value)} placeholder="Ej: OB304" /><Button type="button" onClick={handleFlightSearch} disabled={isSearchingFlight} size="icon"><Plane className={cn("h-4 w-4", isSearchingFlight && "animate-pulse")} /></Button></div></div>)}
                                <div className="sm:col-span-2"><Label>Hora</Label><Input value={newService.hora} onChange={(e) => handleNewServiceChange('hora', e.target.value)} placeholder="HH:mm" maxLength={5} className="mt-1"/></div>
                                <div className="sm:col-span-1"><Button onClick={addNewServiceRow} variant="outline" size="icon" className="w-full" disabled={isAddServiceDisabled}><PlusCircle className="h-5 w-5"/></Button></div>
                            </div>
                        </div>

                        <div className="p-4 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-semibold">Itinerario ({orderData.services.length} servicios)</h3>
                                <Button onClick={() => setIsModalOpen(true)} variant="outline" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"><Edit className="mr-2 h-4 w-4" />Editar Completo</Button>
                            </div>
                            <p className="text-sm text-muted-foreground">Previsualización de los primeros 5 servicios. Usa "Editar Completo" para ver y modificar todo.</p>
                            <div className="mt-2 text-sm">
                                {orderData.services.slice(0, 5).map((s, i) => <div key={i} className="flex gap-2 p-1 border-b"><span className="font-mono">{s.fecha} {s.hora}</span><span>{s.servicio}</span></div>)}
                                {orderData.services.length > 5 && <div className="text-center p-1">... y {orderData.services.length - 5} más.</div>}
                                {orderData.services.length === 0 && <div className="text-center p-4 text-muted-foreground">El itinerario está vacío.</div>}
                            </div>
                        </div>

                        {isModalOpen && <ItineraryEditModal services={orderData.services} guides={guides} drivers={allDrivers} onSave={handleSaveFromModal} onClose={() => setIsModalOpen(false)} />}
                        
                        <Accordion type="single" collapsible className="w-full border rounded-lg">
                            <AccordionItem value="item-1">
                                <AccordionTrigger className="text-lg font-medium p-4">Observaciones y Notas</AccordionTrigger>
                                <AccordionContent className="space-y-4 px-4 pb-4">
                                    <div><Label htmlFor="observaciones">Observaciones Generales</Label><Textarea id="observaciones" value={orderData.observations} onChange={e => handleInputChange('observations', e.target.value)} className="mt-1" rows={3}/></div>
                                    <div><Label htmlFor="nota">Nota (Pie de página)</Label><Textarea id="nota" value={orderData.nota} onChange={e => handleInputChange('nota', e.target.value)} className="mt-1" rows={5}/></div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </ScrollArea>
                <SheetFooter className="pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSaveOrder} disabled={isSaving || isLoadingData}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        {existingOrder ? "Actualizar Orden" : "Guardar Orden"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

