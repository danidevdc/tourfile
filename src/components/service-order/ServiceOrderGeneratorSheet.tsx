
"use client";

import { useState, useEffect, useRef, type ChangeEvent, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

import {
  getGuidesFromFirestore, getHotelsFromFirestore, getDriversFromFirestore, getActivitiesFromFirestore, getFlightsFromFirestore,
  recordActivityTimeUsage, getSuggestedTimeForActivity,
  type ServiceOrderGuide, type Hotel, type Driver, type Activity, type ServiceItem, type PredefinedFlight,
} from '@/lib/serviceOrderService';
import { getServiceOrderRules, type ServiceOrderRule } from '@/lib/serviceOrderRuleService';
import { type ServiceOrderData } from '@/lib/serviceOrderGenerator';
import { generateServicesFromExcelColumn } from '@/lib/serviceOrderProcessor';
import { saveServiceOrder } from '@/lib/serviceOrderStorage';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, PlusCircle, Upload, Search, Plane, Save, Trash2, XCircle, Eraser, CheckCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FileSearchStatus } from "@/lib/report-generator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";

const initialNewServiceState: ServiceItem = {
    fecha: '', hora: '', servicio: '', vuelo: '', guia: '', bus: '', chofer: '', observaciones: ''
};

const SESSION_STORAGE_FILE_KEY = 'serviceOrderProgramFile_v2';
const SESSION_STORAGE_FILENAME_KEY = 'serviceOrderProgramFileName_v2';

interface ServiceOrderGeneratorSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    orderData: ServiceOrderData;
    setOrderData: (data: ServiceOrderData) => void;
    onClearAndNew: () => void;
    isAutomatedMode: boolean;
}

export function ServiceOrderGeneratorSheet({ isOpen, onClose, onSave, orderData, setOrderData, onClearAndNew, isAutomatedMode }: ServiceOrderGeneratorSheetProps) {
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
    const [flights, setFlights] = useState<PredefinedFlight[]>([]);
    const [serviceOrderRules, setServiceOrderRules] = useState<ServiceOrderRule[]>([]);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<{name: string} | null>(null);
    const [excelData, setExcelData] = useState<any[][] | null>(null);
    const [fileSearchStatus, setFileSearchStatus] = useState<FileSearchStatus>("idle");
    const [isProcessingSearch, setIsProcessingSearch] = useState(false);
    const [foundFileColumnIndex, setFoundFileColumnIndex] = useState<number | null>(null);
    
    const [newService, setNewService] = useState<ServiceItem>(initialNewServiceState);
    const [busTypeSelection, setBusTypeSelection] = useState('');
    const [choferSelection, setChoferSelection] = useState('');

    const [selectedServices, setSelectedServices] = useState<Set<number>>(new Set());
    const [masterDate, setMasterDate] = useState<string>('');
    
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

    const handleClearForm = () => {
        onClearAndNew(); // This resets the main order data object in the parent
        setBusTypeSelection('');
        setChoferSelection('');
        setNewService(initialNewServiceState);
        setFileSearchStatus("idle");
        setSelectedServices(new Set());
        setMasterDate('');
        toast({ title: "Formulario Limpiado" });
    }

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
            if (!isOpen) return;
            setIsLoadingData(true);
            try {
                const [fetchedGuides, fetchedHotels, fetchedDrivers, fetchedActivities, fetchedFlights, fetchedRules] = await Promise.all([
                    getGuidesFromFirestore(), getHotelsFromFirestore(), getDriversFromFirestore(), getActivitiesFromFirestore(), getFlightsFromFirestore(), getServiceOrderRules()
                ]);
                setGuides(fetchedGuides);
                setHotels(fetchedHotels);
                setAllDrivers(fetchedDrivers);
                setOwnDrivers(fetchedDrivers.filter(d => !d.name.startsWith('CONT ')));
                setExternalDrivers(fetchedDrivers.filter(d => d.name.startsWith('CONT ')));
                setActivities(fetchedActivities);
                setFlights(fetchedFlights);
                setServiceOrderRules(fetchedRules);
            } catch (error) {
                toast({ title: "Error", description: "No se pudieron cargar los datos iniciales.", variant: "destructive" });
            } finally {
                setIsLoadingData(false);
            }
        }
        loadInitialData();
    }, [isOpen, toast]);
    
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
        setOrderData({ ...orderData, file: '', ref: '', nPax: '', services: [] });
        if (fileInputRef.current) fileInputRef.current.value = "";
        sessionStorage.removeItem(SESSION_STORAGE_FILE_KEY);
        sessionStorage.removeItem(SESSION_STORAGE_FILENAME_KEY);
        toast({ title: "Archivo Limpiado" });
    };

    const handleSearchFile = async () => {
        if (!selectedFile || !excelData || !orderData.file) {
            toast({ title: "Datos incompletos", description: "Selecciona un archivo e ingresa un número de file.", variant: "destructive" }); return;
        }
        setIsProcessingSearch(true); setFileSearchStatus("searching");
        await new Promise(resolve => setTimeout(resolve, 300));
        
        let found = false, fileColumnIndex = -1, rowIdxWhereFileNumberFound = -1;
        const fileNumberToSearch = orderData.file.trim().toUpperCase();
        
        for (let j = 0; j < excelData[0].length; j++) {
            for (let i = 0; i < excelData.length; i++) {
                 if (excelData[i][j] && String(excelData[i][j]).trim().toUpperCase() === fileNumberToSearch) {
                    found = true; fileColumnIndex = j; rowIdxWhereFileNumberFound = i; break;
                }
            }
            if (found) break;
        }

        if (found) {
            setFileSearchStatus("found");
            setFoundFileColumnIndex(fileColumnIndex); 
            
            const groupName = String(excelData[rowIdxWhereFileNumberFound + 1]?.[fileColumnIndex] || "No encontrado").toUpperCase();
            
            let pax = "N/A";
            for (let i = rowIdxWhereFileNumberFound + 1; i < excelData.length && i < rowIdxWhereFileNumberFound + 10; i++) {
                const paxRaw = excelData[i]?.[fileColumnIndex];
                if (paxRaw !== null && paxRaw !== undefined) {
                    const paxValue = String(paxRaw).trim();
                    const paxRegex = /^\d{1,2}(\s*\+\s*\d{1,2})?$/;
                    if (paxRegex.test(paxValue)) { pax = paxValue; break; }
                }
            }
            
            let hotelName = "";
            const columnDataForHotelSearch = excelData.map(row => String(row[fileColumnIndex] || ""));
            const hotelCellText = columnDataForHotelSearch.find(cellText => cellText.toUpperCase().includes("HOTEL"));

            if (hotelCellText) {
                const foundHotel = hotels.find(h => hotelCellText.toUpperCase().includes(h.name.toUpperCase()));
                if(foundHotel) { hotelName = foundHotel.name; }
            }
            
            setOrderData(prev => ({ ...prev, ref: groupName, nPax: pax, hotel: hotelName, services: [] }));
            toast({ title: "Búsqueda Exitosa", description: `Grupo: ${groupName}, PAX: ${pax}, Hotel: ${hotelName || 'No encontrado'}`, className: "bg-green-100 dark:bg-green-900 border-green-500", duration: 5000 });
            
        } else {
            setFileSearchStatus("not_found");
            setOrderData({ ...orderData, ref: '', nPax: '', hotel: '', services: [] });
            setFoundFileColumnIndex(null);
            toast({ title: "Búsqueda Fallida", description: "Número de file no encontrado.", variant: "destructive" });
        }
        setIsProcessingSearch(false);
    };

    const handleGenerateServices = () => {
        if (fileSearchStatus !== "found" || foundFileColumnIndex === null) {
            toast({ title: "Búsqueda Requerida", description: "Primero busca y encuentra un file válido.", variant: "destructive" }); return;
        }

        const mainGuide = orderData.guia || '';
        const mainBus = busTypeSelection || '';
        const mainChofer = choferSelection || '';

        if (!mainGuide || !mainBus || !mainChofer) {
            toast({ title: "Información Requerida", description: "Por favor, selecciona Guía, Bus y Chofer antes de generar servicios.", variant: "destructive", duration: 5000 }); return;
        }

        const generatedServicesRaw = generateServicesFromExcelColumn(excelData, foundFileColumnIndex, serviceOrderRules, activities);
        const generatedServicesWithDetails = generatedServicesRaw.map(service => ({
            ...service,
            guia: mainGuide,
            bus: mainBus,
            chofer: mainChofer,
        }));
        
        setOrderData(prev => ({ ...prev, services: generatedServicesWithDetails }));
        toast({ title: "Generación Exitosa", description: `Se generaron ${generatedServicesRaw.length} servicios.`, className: "bg-green-100 dark:bg-green-900 border-green-500", duration: 5000 });
    };

    const handleInputChange = (field: keyof ServiceOrderData, value: string) => {
        setOrderData({ ...orderData, [field]: value.toUpperCase() });
    };

    const handleSelectChange = (type: 'guide' | 'hotel', value: string) => {
        const upperValue = value.toUpperCase();
        if (type === 'guide') setOrderData({ ...orderData, guia: upperValue });
        else if (type === 'hotel') setOrderData({ ...orderData, hotel: upperValue });
    };

    const handleNewServiceChange = (field: keyof ServiceItem, value: string) => {
        setNewService(prev => ({ ...prev, [field]: value.toUpperCase() }));
    };

    const handleServiceSummaryChange = (index: number, field: keyof ServiceItem, value: string) => {
        const updatedServices = [...orderData.services];
        updatedServices[index] = { ...updatedServices[index], [field]: value };
        
        if (field === 'vuelo') {
            const selectedFlight = flights.find(f => f.flightNumber.toUpperCase() === value.toUpperCase());
            if (selectedFlight) {
                updatedServices[index].hora = selectedFlight.time;
                updatedServices[index].observaciones = selectedFlight.observations;
            }
        }
        
        setOrderData(prev => ({ ...prev, services: updatedServices }));
    };
    
    const handleTimeInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const numbersOnly = rawValue.replace(/[^0-9]/g, '');
        let formatted = '';

        if (numbersOnly.length > 0) formatted = numbersOnly.slice(0, 2);
        if (numbersOnly.length > 2) formatted += ':' + numbersOnly.slice(2, 4);
        
        handleNewServiceChange('hora', formatted);
    };
    
    const handleTimeInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/[^0-9]/g, '');
        if (rawValue.length === 4) {
             handleNewServiceChange('hora', `${rawValue.slice(0,2)}:${rawValue.slice(2,4)}`);
        }
    };
    
    const handleSummaryTimeChange = (index: number, rawValue: string) => {
        const numbersOnly = rawValue.replace(/[^0-9]/g, '');
        let formatted = '';
        if (numbersOnly.length > 0) formatted = numbersOnly.slice(0, 2);
        if (numbersOnly.length > 2) formatted += ':' + numbersOnly.slice(2, 4);
        handleServiceSummaryChange(index, 'hora', formatted);
    };

    const handleSummaryTimeBlur = (index: number, rawValue: string) => {
        const numbersOnly = rawValue.replace(/[^0-9]/g, '');
        if (numbersOnly.length === 4) {
            handleServiceSummaryChange(index, 'hora', `${numbersOnly.slice(0, 2)}:${numbersOnly.slice(2, 4)}`);
        }
    };

    const handleActivitySelect = async (activityName: string) => {
        const upperActivityName = activityName.toUpperCase();
        setNewService(prev => ({...prev, servicio: upperActivityName, hora: ''}));
        if (upperActivityName !== 'TRF IN' && upperActivityName !== 'TRF OUT' && !newService.hora) {
            const suggestedTime = await getSuggestedTimeForActivity(upperActivityName);
            if (suggestedTime) { handleNewServiceChange('hora', suggestedTime); }
        }
    };
    
    const handleFlightSelect = (flightNumber: string) => {
        const selectedFlight = flights.find(f => f.flightNumber.toUpperCase() === flightNumber.toUpperCase());
        if (selectedFlight) {
            setNewService(prev => ({ ...prev, vuelo: selectedFlight.flightNumber, hora: selectedFlight.time, observaciones: selectedFlight.observations }));
        }
    };

    const addNewServiceRow = () => {
        const lastService = orderData.services[orderData.services.length - 1];
        const serviceToAdd: ServiceItem = {
            ...newService,
            fecha: newService.fecha ? format(parse(newService.fecha, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : '',
            guia: orderData.guia,
            bus: busTypeSelection || lastService?.bus || '',
            chofer: choferSelection || lastService?.chofer || '',
        };
        recordActivityTimeUsage(serviceToAdd.servicio, serviceToAdd.hora);
        setOrderData({ ...orderData, services: [...orderData.services, serviceToAdd] });
        setNewService(prev => ({ ...initialNewServiceState, fecha: prev.fecha, }));
    };

    const removeServiceRow = (index: number) => {
        setOrderData({ ...orderData, services: orderData.services.filter((_, i) => i !== index) });
    };

    const handleSaveOrder = async () => {
        if (!orderData.guia || !orderData.file || !currentUser?.email) {
            toast({ title: "Datos Requeridos", description: "El guía y el número de file son obligatorios.", variant: "destructive" }); return;
        }
        setIsSaving(true);
        try {
            await saveServiceOrder(orderData, currentUser.email);
            toast({ title: "Éxito", description: "Orden de servicio guardada.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
            onSave();
        } catch (error) {
            toast({ title: "Error", description: "No se pudo guardar la orden de servicio.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleApplyDateToSelected = () => {
        if (!masterDate || selectedServices.size === 0) {
            toast({ title: "Datos incompletos", description: "Selecciona una fecha y al menos un servicio.", variant: "destructive" }); return;
        }
        const formattedDate = format(parse(masterDate, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy');
        const updatedServices = orderData.services.map((service, index) => {
            if (selectedServices.has(index)) {
                return { ...service, fecha: formattedDate };
            }
            return service;
        });
        setOrderData({ ...orderData, services: updatedServices });
        setSelectedServices(new Set()); // Clear selection after applying
    };

    const handleSelectService = (index: number, checked: boolean) => {
        const newSelection = new Set(selectedServices);
        if (checked) {
            newSelection.add(index);
        } else {
            newSelection.delete(index);
        }
        setSelectedServices(newSelection);
    };

    const sortedServices = useMemo(() => {
        return [...orderData.services].sort((a, b) => {
            try {
                const dateA = a.fecha ? parse(a.fecha, 'dd/MM/yyyy', new Date()).getTime() : 0;
                const dateB = b.fecha ? parse(b.fecha, 'dd/MM/yyyy', new Date()).getTime() : 0;
                if (dateA !== dateB) return dateA - dateB;
            } catch (e) {
                // Handle parsing errors, maybe treat invalid dates as unequal
            }

            const hasTimeA = a.hora && a.hora.trim() !== '';
            const hasTimeB = b.hora && b.hora.trim() !== '';

            if (hasTimeA && !hasTimeB) return -1; // a comes first
            if (!hasTimeA && hasTimeB) return 1;  // b comes first
            if (hasTimeA && hasTimeB) {
                return a.hora.localeCompare(b.hora);
            }
            
            return 0; // if dates are same and both have/don't have time, keep original relative order
        });
    }, [orderData.services]);

    const guideOptions = guides.map(g => ({ value: g.fullName.toUpperCase(), label: g.fullName }));
    const hotelOptions = hotels.map(h => ({ value: h.name.toUpperCase(), label: h.name }));
    const driverOptions = (busTypeSelection === 'CONT.' ? externalDrivers : ownDrivers).map(d => ({ value: d.name.toUpperCase(), label: d.name.replace(/^CONT\\s/i, '') }));
    const activityOptions = activities.map(a => ({ value: a.name.toUpperCase(), label: a.name }));
    const isAddServiceDisabled = !newService.fecha.trim() || !newService.servicio.trim();

    const filteredFlightOptions = useMemo(() => {
        const createOption = (f: PredefinedFlight) => ({ value: f.flightNumber, key: f.id, label: `${f.flightNumber} (${f.time})` });
        const service = newService.servicio?.toUpperCase();
        if (service === 'TRF IN') { return flights.filter(f => f.observations.toUpperCase().includes('LLEGA')).map(createOption); }
        if (service === 'TRF OUT') { return flights.filter(f => f.observations.toUpperCase().includes('SALE')).map(createOption); }
        return flights.map(createOption);
    }, [newService.servicio, flights]);
    

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="top" className="w-full h-full max-h-screen flex flex-col sm:max-w-full">
                <SheetHeader>
                     <SheetTitle className="text-2xl font-headline text-primary">
                        {isAutomatedMode ? "Generar Orden de Servicio Automatizada" : "Nueva Orden de Servicio"}
                    </SheetTitle>
                </SheetHeader>
                <div className="flex-grow min-h-0 overflow-y-auto pr-6 -mr-6">
                    <div className="space-y-4 py-4">
                         <div className="space-y-4 p-4 border rounded-lg bg-card">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Programa:</Label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className={cn("w-full justify-start", selectedFile && "border-green-500 font-medium text-green-700")}>
                                            <Upload className="mr-2 h-4 w-4" />{selectedFile ? selectedFile.name : "Seleccionar .xlsx"}
                                        </Button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx,.xls"/>
                                        {selectedFile && <Button type="button" variant="destructive" size="icon" onClick={clearFile}><Trash2 className="h-4 w-4" /></Button>}
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="file">File:*</Label>
                                    <div className="flex items-center gap-1 mt-1">
                                        <Input id="file" value={orderData.file} onChange={e => handleInputChange('file', e.target.value)} className={cn(orderData.file && "border-green-500")} />
                                        <Button type="button" onClick={handleSearchFile} size="icon" disabled={!selectedFile || !orderData.file || isProcessingSearch}>
                                            {isProcessingSearch ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <Label htmlFor="ref">Ref (Grupo):</Label>
                                  <Input id="ref" value={orderData.ref} onChange={e => handleInputChange('ref', e.target.value)} className={cn("mt-1", orderData.ref && "border-green-500")} />
                                </div>
                                <div>
                                  <Label htmlFor="nPax">Nº Pax:</Label>
                                  <Input id="nPax" value={orderData.nPax} onChange={e => handleInputChange('nPax', e.target.value)} className={cn("mt-1", orderData.nPax && "border-green-500")} />
                                </div>
                                <div>
                                    <Label>Hotel</Label>
                                    <Combobox 
                                        options={hotelOptions} 
                                        value={orderData.hotel} 
                                        onSelect={(val) => handleSelectChange('hotel', val)} 
                                        placeholder="Buscar hotel..." 
                                        className="mt-1 bg-card"
                                        triggerClassName={cn(orderData.hotel && "border-green-500 font-medium")}
                                    />
                                </div>
                            </div>
                             <div className="grid grid-cols-10 items-end gap-4">
                                <div className="col-span-3">
                                    <Label>Guía Principal*</Label>
                                    <Combobox 
                                        options={guideOptions} 
                                        value={orderData.guia} 
                                        onSelect={(val) => handleSelectChange('guide', val)} 
                                        placeholder="Buscar guía..." 
                                        className="mt-1 bg-card"
                                        triggerClassName={cn(orderData.guia && "border-green-500 font-medium")}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Label>Bus/Tipo Chofer</Label>
                                    <Select value={busTypeSelection} onValueChange={setBusTypeSelection}>
                                        <SelectTrigger className={cn("mt-1 bg-card", busTypeSelection && "border-green-500 font-medium")}>
                                            <SelectValue placeholder="Seleccionar..." />
                                        </SelectTrigger>
                                        <SelectContent>{[{ value: '8', label: 'Bus 8' }, { value: '9', label: 'Bus 9' }, { value: '10', label: 'Bus 10' }, { value: 'CONT.', label: 'Contratado' }].map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-3">
                                    <Label>Chofer</Label>
                                    <Combobox 
                                        options={driverOptions} 
                                        value={choferSelection} 
                                        onSelect={setChoferSelection} 
                                        placeholder="Seleccionar chofer..." 
                                        className="mt-1 bg-card"
                                        triggerClassName={cn(choferSelection && "border-green-500 font-medium")}
                                    />
                                </div>
                                {isAutomatedMode && (
                                <div className="col-span-2 flex items-center">
                                     <Button onClick={handleGenerateServices} disabled={fileSearchStatus !== "found"} className="w-full h-10 bg-green-600 hover:bg-green-700 text-white">
                                      <CheckCircle className="mr-2 h-5 w-5"/>
                                      Generar Servicios
                                    </Button>
                                </div>
                                )}
                            </div>
                        </div>
                        
                        {!isAutomatedMode && (
                            <div className="p-4 border rounded-lg bg-card">
                                <h3 className="font-semibold mb-2">Añadir Servicio Manualmente</h3>
                                 <div className="flex items-end gap-2">
                                    <div style={{ width: '150px' }}>
                                      <Label>Fecha</Label>
                                      <Input type="date" value={newService.fecha} onChange={(e) => handleNewServiceChange('fecha', e.target.value)} className="mt-1 w-full"/>
                                    </div>
                                    <div className="flex-grow" style={{ minWidth: '250px' }}>
                                        <Label>Actividad</Label>
                                        <Combobox 
                                            options={activityOptions} 
                                            value={newService.servicio} 
                                            onSelect={handleActivitySelect} 
                                            placeholder="Buscar actividad..." 
                                            className="mt-1 bg-card"
                                            triggerClassName={cn(newService.servicio && "border-green-500 font-medium")}
                                        />
                                    </div>
                                    {(newService.servicio?.includes('TRF IN') || newService.servicio?.includes('TRF OUT')) && (
                                        <div className="flex-grow" style={{ minWidth: '200px' }}>
                                            <Label>Vuelo</Label>
                                            <Combobox 
                                                options={filteredFlightOptions} 
                                                value={newService.vuelo || ''} 
                                                onSelect={handleFlightSelect} 
                                                placeholder="Seleccionar vuelo..." 
                                                className="mt-1 bg-card"
                                                triggerClassName={cn(newService.vuelo && "border-green-500 font-medium")}
                                            />
                                        </div>
                                    )}
                                    <div style={{ width: '100px' }}>
                                        <Label>Hora</Label>
                                        <Input value={newService.hora} onChange={handleTimeInputChange} onBlur={handleTimeInputBlur} placeholder="HH:mm" maxLength={5} className="mt-1 w-full"/>
                                    </div>
                                    <div>
                                        <Button onClick={addNewServiceRow} variant="default" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isAddServiceDisabled}>
                                            <PlusCircle className="mr-2 h-5 w-5"/>Añadir
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-4 border rounded-lg bg-card">
                             <div className="flex justify-between items-center mb-2">
                                <h3 className="font-semibold">Resumen ({orderData.services.length} servicios)</h3>
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="master-date" className="text-sm">Fecha para asignar:</Label>
                                    <Input 
                                        type="date" 
                                        id="master-date" 
                                        value={masterDate}
                                        onChange={(e) => setMasterDate(e.target.value)}
                                        className="h-8 w-36"
                                    />
                                    <Button onClick={handleApplyDateToSelected} size="sm" variant="outline" disabled={!masterDate || selectedServices.size === 0}>
                                        Asignar Fecha
                                    </Button>
                                </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto border rounded-md bg-card font-mono">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-primary/10 z-10 hover:bg-primary/10">
                                        <TableRow className="border-b-primary/20">
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{width: '40px'}}>
                                                 <Checkbox 
                                                    checked={selectedServices.size > 0 && selectedServices.size === orderData.services.length}
                                                    onCheckedChange={(checked) => {
                                                        const newSelection = new Set<number>();
                                                        if (checked) {
                                                            orderData.services.forEach((_, index) => newSelection.add(index));
                                                        }
                                                        setSelectedServices(newSelection);
                                                    }}
                                                 />
                                            </TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{width: '120px'}}>Fecha</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{width: '90px'}}>Hora</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20">Servicio</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{width: '200px'}}>Vuelo</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{width: '120px'}}>Guía</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{width: '70px'}}>Bus</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{width: '120px'}}>Chofer</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20">Observaciones</TableHead>
                                            <TableHead className="text-primary font-bold p-2" style={{width: '40px'}}></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedServices.length > 0 ? (
                                            sortedServices.map((s, i) => {
                                                const originalIndex = orderData.services.findIndex(os => os === s);
                                                const guiaFirstName = (s.guia || "").split(" ")[0];
                                                const choferName = (s.chofer || "").replace(/^CONT\s/i, '');
                                                const isTransfer = s.servicio?.toUpperCase().includes('TRF');

                                                return (
                                                <TableRow key={i} className="font-mono border-b-primary/20">
                                                     <TableCell className="p-1 border-r border-primary/20 text-center">
                                                        <Checkbox 
                                                            checked={selectedServices.has(originalIndex)}
                                                            onCheckedChange={(checked) => handleSelectService(originalIndex, !!checked)}
                                                        />
                                                     </TableCell>
                                                    <TableCell className="p-1 border-r border-primary/20">
                                                        <Input type="date" value={s.fecha ? format(parse(s.fecha, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd') : ''} onChange={(e) => handleServiceSummaryChange(originalIndex, 'fecha', e.target.value ? format(parse(e.target.value, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : '')} className="h-8 text-xs bg-card/80"/>
                                                    </TableCell>
                                                    <TableCell className="p-1 border-r border-primary/20">
                                                        <Input value={s.hora} onChange={(e) => handleSummaryTimeChange(originalIndex, e.target.value)} onBlur={(e) => handleSummaryTimeBlur(originalIndex, e.target.value)} placeholder="HH:mm" maxLength={5} className="h-8 text-xs bg-card/80"/>
                                                    </TableCell>
                                                    <TableCell className="p-2 border-r border-primary/20 font-sans">{s.servicio}</TableCell>
                                                    <TableCell className="p-1 border-r border-primary/20">
                                                        {isTransfer ? (
                                                             <Combobox 
                                                                options={flights.map(f => ({value: f.flightNumber, label: `${f.flightNumber} (${f.time})`}))} 
                                                                value={s.vuelo || ''} 
                                                                onSelect={(val) => handleServiceSummaryChange(originalIndex, 'vuelo', val)} 
                                                                placeholder="Vuelo..." 
                                                                className="h-8 text-xs" triggerClassName="bg-card/80"
                                                            />
                                                        ) : s.vuelo}
                                                    </TableCell>
                                                    <TableCell className="p-2 border-r border-primary/20 font-sans">{guiaFirstName}</TableCell>
                                                    <TableCell className="p-2 border-r border-primary/20">{s.bus}</TableCell>
                                                    <TableCell className="p-2 border-r border-primary/20 font-sans">{choferName}</TableCell>
                                                    <TableCell className="p-1 border-r border-primary/20 font-sans">
                                                        <Input
                                                          value={s.observaciones || ''}
                                                          onChange={(e) => handleServiceSummaryChange(originalIndex, 'observaciones', e.target.value)}
                                                          className="h-8 text-xs bg-card/80"
                                                        />
                                                    </TableCell>
                                                     <TableCell className="p-1 text-center">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => removeServiceRow(originalIndex)}>
                                                            <XCircle className="h-4 w-4" />
                                                        </Button>
                                                     </TableCell>
                                                </TableRow>
                                            )})
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                                    El resumen está vacío.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                        
                        <div className="p-4 border rounded-lg bg-card">
                            <Accordion type="multiple" className="w-full">
                              <AccordionItem value="item-1">
                                <AccordionTrigger>Observaciones Generales</AccordionTrigger>
                                <AccordionContent>
                                  <Textarea id="observaciones" value={orderData.observations} onChange={e => handleInputChange('observations', e.target.value)} className="mt-1" rows={5}/>
                                </AccordionContent>
                              </AccordionItem>
                              <AccordionItem value="item-2">
                                <AccordionTrigger>Nota (Pie de página)</AccordionTrigger>
                                <AccordionContent>
                                  <Textarea id="nota" value={orderData.nota} onChange={e => handleInputChange('nota', e.target.value)} className="mt-1" rows={5}/>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                        </div>

                    </div>
                </div>
                <div className="pt-4 border-t gap-2 flex justify-end">
                    <Button variant="outline" onClick={handleClearForm} className="mr-auto border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Eraser className="mr-2 h-4 w-4"/>
                        Limpiar Formulario
                    </Button>
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                    <Button onClick={handleSaveOrder} disabled={isSaving || isLoadingData}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        Guardar Orden
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
