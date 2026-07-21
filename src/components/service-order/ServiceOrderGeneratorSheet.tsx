
"use client";

import { useState, useEffect, useRef, useMemo, type ChangeEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

import {
    getGuidesFromFirestore, getHotelsFromFirestore, getDriversFromFirestore, getActivitiesFromFirestore, getFlightsFromFirestore, getBusesFromFirestore,
    recordActivityTimeUsage, getSuggestedTimeForActivity,
    type ServiceOrderGuide, type Hotel, type Driver, type Activity, type ServiceItem, type PredefinedFlight, type Bus,
} from '@/lib/serviceOrderService';
import { getServiceOrderRules, type ServiceOrderRule } from '@/lib/serviceOrderRuleService';
import { type ServiceOrderData } from '@/lib/serviceOrderGenerator';
import { generateServicesFromExcelColumn } from '@/lib/serviceOrderProcessor';
import { saveServiceOrder, saveServiceOrderWithSplit, saveServiceOrderInSplitMode } from '@/lib/serviceOrderStorage';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Loader2, PlusCircle, Upload, Search, Plane, Save, Trash2, XCircle, Eraser, CheckCircle, UserPlus, Car, Split } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FileSearchStatus } from "@/lib/report-generator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const initialNewServiceState: ServiceItem = {
    fecha: '', hora: '', servicio: '', vuelo: '', guia: '', bus: '', chofer: '', observaciones: ''
};

const defaultObsText = '';
const defaultNotaText = 'TODOS LOS GUÍAS DEBEN ENVIAR UN INFORME DIARIO POR WHATSAPP A LA SEÑORA JUDITH SOBRE LOS SERVICIOS REALIZADOS.\nGUIA DEBE PRESENTAR COPIA DE PASAPORTE DE PAX DESPUES DE CADA SERVICIO JUNTO A SU LIQUIDACION Y CAJA CHICA\nLA CAJA CHICA CUBRE 1 BOTELLA DE AGUA POR DÍA PARA CADA PAX, GUÍA Y CHOFER. NO INCLUYE TRANSFERS NI SERVICIOS EN EL LAGO.';

const SESSION_STORAGE_FILE_KEY = 'serviceOrderProgramFile_v2';
const SESSION_STORAGE_FILENAME_KEY = 'serviceOrderProgramFileName_v2';

interface ServiceOrderGeneratorSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    orderData: ServiceOrderData;
    setOrderData: React.Dispatch<React.SetStateAction<ServiceOrderData>>;
    onClearAndNew: () => void;
    isAutomatedMode: boolean;
    guides: ServiceOrderGuide[];
    hotels: Hotel[];
    drivers: Driver[];
    activities: Activity[];
    flights: PredefinedFlight[];
    buses: Bus[];
}

export function ServiceOrderGeneratorSheet({
    isOpen, onClose, onSave, orderData, setOrderData, onClearAndNew, isAutomatedMode,
    guides, hotels, drivers, activities, flights, buses
}: ServiceOrderGeneratorSheetProps) {
    const { currentUser } = useAuth();
    const { toast } = useToast();

    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);

    const [ownDrivers, setOwnDrivers] = useState<Driver[]>([]);
    const [externalDrivers, setExternalDrivers] = useState<Driver[]>([]);
    const [serviceOrderRules, setServiceOrderRules] = useState<ServiceOrderRule[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<{ name: string } | null>(null);
    const [excelData, setExcelData] = useState<any[][] | null>(null);
    const [fileSearchStatus, setFileSearchStatus] = useState<FileSearchStatus>("idle");
    const [isProcessingSearch, setIsProcessingSearch] = useState(false);
    const [foundFileColumnIndex, setFoundFileColumnIndex] = useState<number | null>(null);

    const [newService, setNewService] = useState<ServiceItem>(initialNewServiceState);
    const [busTypeSelection, setBusTypeSelection] = useState('');
    const [choferSelection, setChoferSelection] = useState('');

    const [selectedServices, setSelectedServices] = useState<Set<number>>(new Set());
    const [masterDate, setMasterDate] = useState<string>('');

    const [additionalGuides, setAdditionalGuides] = useState<string[]>([]);
    const [additionalDrivers, setAdditionalDrivers] = useState<string[]>([]);
    const [isSplitMode, setIsSplitMode] = useState(false);

    // Calculate if split mode can be enabled (only with exactly 1 guide and 1 driver)
    const splitModeStatus = useMemo(() => {
        const totalGuides = orderData.guia ? 1 + additionalGuides.length : additionalGuides.length;
        const totalDrivers = choferSelection ? 1 + additionalDrivers.length : additionalDrivers.length;

        const canEnableSplit = totalGuides === 1 && totalDrivers === 1;
        const willBeDivided = totalGuides > 1 || totalDrivers > 1;

        return { canEnableSplit, willBeDivided, totalGuides, totalDrivers };
    }, [orderData.guia, additionalGuides, choferSelection, additionalDrivers]);

    const processAndStoreFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = "Hoja1";
                const worksheet = workbook.Sheets[sheetName];

                if (!worksheet) {
                    throw new Error(`El archivo no contiene una hoja llamada "${sheetName}".`);
                }
                const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: null });
                setExcelData(jsonData);

                const base64 = btoa(new Uint8Array(data).reduce((res, byte) => res + String.fromCharCode(byte), ''));
                sessionStorage.setItem(SESSION_STORAGE_FILE_KEY, base64);
                sessionStorage.setItem(SESSION_STORAGE_FILENAME_KEY, file.name);
            } catch (error: any) {
                toast({ title: "Error", description: error.message || "No se pudo procesar el archivo. Límite de tamaño excedido.", variant: "destructive" });
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
                    const workbook = XLSX.read(byteArray, { type: 'array', cellDates: true });
                    setExcelData(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, blankrows: false, defval: null }));
                } catch (e) {
                    clearFile();
                }
            }
        }
    }, []);

    useEffect(() => {
        async function loadRules() {
            if (!isOpen) return;
            setIsLoadingData(true);
            try {
                const fetchedRules = await getServiceOrderRules();
                setServiceOrderRules(fetchedRules);
            } catch (error) {
                toast({ title: "Error", description: "No se pudieron cargar las reglas de servicio.", variant: "destructive" });
            } finally {
                setIsLoadingData(false);
            }
        }
        loadRules();
    }, [isOpen, toast]);

    useEffect(() => {
        if (drivers.length > 0) {
            setOwnDrivers(drivers.filter(d => !d.name.startsWith('CONT ')));
            setExternalDrivers(drivers.filter(d => d.name.startsWith('CONT ')));
        }
    }, [drivers]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile({ name: file.name });
            toast({ title: "Archivo Seleccionado", variant: "success" as any });
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

        // Fix: Check if excelData is empty or first row is invalid
        if (excelData.length === 0 || !excelData[0]) {
            toast({ title: "Archivo Inválido", description: "El archivo Excel parece estar vacío o no tiene columnas.", variant: "destructive" }); return;
        }

        setIsProcessingSearch(true); setFileSearchStatus("searching");
        await new Promise(resolve => setTimeout(resolve, 300));

        let found = false, fileColumnIndex = -1, rowIdxWhereFileNumberFound = -1;
        const fileNumberToSearch = orderData.file.trim().toUpperCase();
        // Si el usuario escribió solo dígitos (sin el prefijo, ej. "109860" en vez de
        // "CTFI109860"), se busca por sufijo numérico. Solo se acepta si es
        // inequívoco: distintos files pueden compartir el mismo número con
        // prefijos distintos, así que un match ambiguo no se resuelve solo.
        const isDigitsOnlySearch = /^\d+$/.test(fileNumberToSearch);

        const numCols = excelData.reduce((max, row) => Math.max(max, row ? row.length : 0), 0);

        for (let j = 0; j < numCols; j++) {
            for (let i = 0; i < excelData.length; i++) {
                if (excelData[i] && excelData[i][j] && String(excelData[i][j]).trim().toUpperCase() === fileNumberToSearch) {
                    found = true; fileColumnIndex = j; rowIdxWhereFileNumberFound = i; break;
                }
            }
            if (found) break;
        }

        let realFileNumber: string | null = null;

        if (!found && isDigitsOnlySearch) {
            const suffixMatches: { row: number; col: number; value: string }[] = [];
            for (let j = 0; j < numCols; j++) {
                for (let i = 0; i < excelData.length; i++) {
                    const cellValue = excelData[i] && excelData[i][j];
                    if (cellValue !== undefined && cellValue !== null) {
                        const cellText = String(cellValue).trim().toUpperCase();
                        if (cellText.endsWith(fileNumberToSearch) && /^[A-Z]*\d+$/.test(cellText)) {
                            suffixMatches.push({ row: i, col: j, value: cellText });
                        }
                    }
                }
            }

            const distinctValues = new Set(suffixMatches.map(m => m.value));
            if (distinctValues.size === 1) {
                fileColumnIndex = suffixMatches[0].col;
                rowIdxWhereFileNumberFound = suffixMatches[0].row;
                realFileNumber = suffixMatches[0].value;
                found = true;
            } else if (distinctValues.size > 1) {
                setIsProcessingSearch(false);
                setFileSearchStatus("error");
                toast({
                    title: "Número de File Ambiguo",
                    description: `Se encontraron varios files terminados en "${fileNumberToSearch}" (${Array.from(distinctValues).join(", ")}). Ingresa el número completo con su prefijo.`,
                    variant: "destructive",
                });
                return;
            }
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
                    const paxRegex = /^\d{1,3}(\s*\+\s*\d{1,3})?$/;
                    if (paxRegex.test(paxValue)) { pax = paxValue; break; }
                }
            }

            let hotelName = "";
            // Busca SOLO en la columna del file, acumulando todos los hoteles encontrados
            const allFoundHotels = new Set<string>();
            
            for (let i = 0; i < excelData.length; i++) {
                const cellText = String(excelData[i]?.[fileColumnIndex] || "").toUpperCase().trim();
                
                // Busca todos los hoteles de la BD en esta celda
                hotels.forEach(h => {
                    if (cellText.includes(h.name.toUpperCase())) {
                        allFoundHotels.add(h.name);
                    }
                });
            }
            
            if (allFoundHotels.size > 0) {
                // Priorizar no-POSADA
                const nonPosadaHotels = Array.from(allFoundHotels).filter(h => h.toUpperCase() !== 'POSADA');
                const hotelsToPick = nonPosadaHotels.length > 0 ? nonPosadaHotels : Array.from(allFoundHotels);
                
                // Entre los hoteles a seleccionar, escoger el más largo (más específico)
                hotelName = hotelsToPick.sort((a, b) => b.length - a.length)[0];
            }

            setOrderData((prev: ServiceOrderData) => ({
                ...prev,
                // Si se encontró por sufijo numérico, usar el número de file real
                // del Excel (con prefijo), no los dígitos que el usuario tecleó.
                file: realFileNumber ?? prev.file,
                ref: groupName, nPax: pax, hotel: hotelName, services: [],
            }));
            toast({ title: "Búsqueda Exitosa", description: `Grupo: ${groupName}, PAX: ${pax}, Hotel: ${hotelName || 'No encontrado'}`, variant: "success" as any, duration: 5000 });

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

        const generatedServicesRaw = generateServicesFromExcelColumn(excelData, foundFileColumnIndex, serviceOrderRules, activities, flights);

        const generatedServicesWithDetails = generatedServicesRaw.map(service => ({
            ...service,
            id: crypto.randomUUID(),
            guia: mainGuide,
            bus: mainBus,
            chofer: mainChofer,
        }));

        const sortedGenerated = sortServiceItems(generatedServicesWithDetails);
        setOrderData((prev: ServiceOrderData) => ({ ...prev, services: sortedGenerated }));
        toast({ title: "Generación Exitosa", description: `Se generaron ${sortedGenerated.length} servicios ordenados.`, variant: "success" as any, duration: 5000 });
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
        setNewService((prev: ServiceItem) => ({ ...prev, [field]: value.toUpperCase() }));
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

        setOrderData((prev: ServiceOrderData) => ({ ...prev, services: updatedServices }));
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
            handleNewServiceChange('hora', `${rawValue.slice(0, 2)}:${rawValue.slice(2, 4)}`);
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
        setNewService(prev => ({ ...prev, servicio: upperActivityName, hora: '' }));
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
            id: crypto.randomUUID(),
            fecha: newService.fecha ? format(parse(newService.fecha, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : '',
            guia: orderData.guia, // Always use main guide (like EditModal)
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
            // If split mode is enabled and conditions are met, use split mode
            if (isSplitMode && splitModeStatus.canEnableSplit) {
                await saveServiceOrderInSplitMode(orderData, currentUser.email);
                toast({ title: "Éxito", description: "Orden de servicio separada guardada exitosamente (1 para guía, 1 para chofer).", variant: "success" as any });
            } else {
                // Otherwise, use the automatic split function
                await saveServiceOrderWithSplit(orderData, currentUser.email);
                const message = splitModeStatus.willBeDivided
                    ? "Orden de servicio guardada y dividida exitosamente."
                    : "Orden de servicio guardada exitosamente.";
                toast({ title: "Éxito", description: message, variant: "success" as any });
            }
            onSave();
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "No se pudo guardar la orden de servicio.", variant: "destructive" });
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

    const sortServiceItems = (items: ServiceItem[]) => {
        return [...items].sort((a, b) => {
            try {
                const dateA = a.fecha ? parse(a.fecha, "dd/MM/yyyy", new Date()).getTime() : 0;
                const dateB = b.fecha ? parse(b.fecha, "dd/MM/yyyy", new Date()).getTime() : 0;
                if (dateA !== dateB) return dateA - dateB;
            } catch { }

            const hasTimeA = a.hora && a.hora.trim() !== '';
            const hasTimeB = b.hora && b.hora.trim() !== '';

            if (hasTimeA && !hasTimeB) return -1;
            if (!hasTimeA && hasTimeB) return 1;
            if (hasTimeA && hasTimeB) return a.hora.localeCompare(b.hora);
            return 0;
        });
    };

    // Automatic sorting with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setOrderData((prev: ServiceOrderData) => {
                const sorted = sortServiceItems(prev.services);
                // Check if order actually changed to avoid unnecessary updates
                const isDifferent = JSON.stringify(sorted.map(s => ({ f: s.fecha, h: s.hora, s: s.servicio }))) !==
                    JSON.stringify(prev.services.map(s => ({ f: s.fecha, h: s.hora, s: s.servicio })));

                if (isDifferent) {
                    return { ...prev, services: sorted };
                }
                return prev;
            });
        }, 2000);
        return () => clearTimeout(timer);
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

    const busOptions = buses.map(b => ({ value: b.name.toUpperCase(), label: b.name }));
    const finalBusOptions = [...busOptions, { value: 'CONT.', label: 'Contratado' }];

    // Options for selecting guide/driver per service (from assigned ones)
    const allAvailableGuides = guides.map(g => ({ value: g.fullName.toUpperCase(), label: g.fullName }));
    const allAvailableDrivers = drivers.map(d => ({ value: d.name.toUpperCase(), label: d.name }));

    const assignedGuides = [orderData.guia, ...additionalGuides].filter(Boolean);
    const serviceGuideOptions = [
        { value: 'NONE', label: 'Ninguno' },
        ...assignedGuides.map(g => ({ value: g.toUpperCase(), label: g.toUpperCase() }))
    ];

    const assignedDrivers = [choferSelection, ...additionalDrivers].filter(Boolean);
    const serviceDriverOptions = [
        { value: 'NONE', label: 'Ninguno' },
        ...assignedDrivers.map(d => ({ value: d.toUpperCase(), label: d.toUpperCase() }))
    ];

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="top" className="w-full h-full max-h-screen flex flex-col sm:max-w-full overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="text-2xl font-headline text-primary">
                        {isAutomatedMode ? "Generar Orden de Servicio Automatizada" : "Nueva Orden de Servicio"}
                    </SheetTitle>
                    <SheetDescription>
                        Completa los detalles de la orden aquí. Haz clic en guardar cuando hayas terminado.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-grow min-h-0 overflow-y-auto mobile-padding relative">
                    <div className="space-y-4 py-4">
                        <div className="space-y-4 p-3 sm:p-4 border rounded-lg bg-card">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label>Programa:</Label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className={cn("w-full justify-start", selectedFile && "border-green-500 font-medium text-green-700")}>
                                            <Upload className="mr-2 h-4 w-4" />{selectedFile ? selectedFile.name : "Seleccionar .xlsx"}
                                        </Button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx,.xls" />
                                        {selectedFile && <Button type="button" variant="destructive" size="icon" onClick={clearFile}><Trash2 className="h-4 w-4" /></Button>}
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="file">File:*</Label>
                                    <div className="flex items-center gap-1 mt-1">
                                        <Input id="file" value={orderData.file} onChange={e => handleInputChange('file', e.target.value)} className={cn(orderData.file && "border-green-500")} />
                                        <Button type="button" onClick={handleSearchFile} size="icon" disabled={!selectedFile || !orderData.file || isProcessingSearch}>
                                            {isProcessingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                                        className="mt-1 bg-card dark:bg-slate-800/80 dark:border-slate-600"
                                        triggerClassName={cn("dark:bg-slate-800/80 dark:border-slate-600", orderData.hotel && "border-green-500 font-medium")}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-10 items-end gap-4">
                                <div className="sm:col-span-3">
                                    <Label>Guía Principal*</Label>
                                    <Combobox
                                        options={guideOptions}
                                        value={orderData.guia}
                                        onSelect={(val) => handleSelectChange('guide', val)}
                                        placeholder="Buscar guía..."
                                        className="mt-1 bg-card dark:bg-slate-800/80 dark:border-slate-600"
                                        triggerClassName={cn("dark:bg-slate-800/80 dark:border-slate-600", orderData.guia && "border-green-500 font-medium")}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <Label>Bus/Tipo Chofer*</Label>
                                    <Select value={busTypeSelection} onValueChange={setBusTypeSelection}>
                                        <SelectTrigger className={cn("mt-1 bg-card dark:bg-slate-800/80 dark:border-slate-600", busTypeSelection && "border-green-500 font-medium")}>
                                            <SelectValue placeholder="Seleccionar..." />
                                        </SelectTrigger>
                                        <SelectContent>{finalBusOptions.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="sm:col-span-3">
                                    <Label>Chofer*</Label>
                                    <Combobox
                                        options={driverOptions}
                                        value={choferSelection}
                                        onSelect={setChoferSelection}
                                        placeholder="Seleccionar chofer..."
                                        className="mt-1 bg-card dark:bg-slate-800/80 dark:border-slate-600"
                                        triggerClassName={cn("dark:bg-slate-800/80 dark:border-slate-600", choferSelection && "border-green-500 font-medium")}
                                        disabled={!busTypeSelection}
                                    />
                                </div>
                                {isAutomatedMode && (
                                    <div className="col-span-2 flex items-center">
                                        <Button onClick={handleGenerateServices} disabled={fileSearchStatus !== "found" || !orderData.guia || !busTypeSelection || !choferSelection} className="w-full h-10 bg-green-600 hover:bg-green-700 text-white">
                                            <CheckCircle className="mr-2 h-5 w-5" />
                                            Generar Servicios
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Additional Guides and Drivers Section */}
                            <div className="space-y-3 p-3 rounded-lg border bg-zinc-50 dark:bg-zinc-900/50">
                                <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                        <Label className="flex items-center gap-2"><UserPlus size={14} />Guías Adicionales</Label>
                                        <Combobox
                                            options={allAvailableGuides.filter(g => g.value !== orderData.guia && !additionalGuides.includes(g.value))}
                                            value={''}
                                            onSelect={(val) => {
                                                if (!additionalGuides.includes(val)) {
                                                    setAdditionalGuides([...additionalGuides, val]);
                                                }
                                            }}
                                            placeholder="Añadir otro guía..."
                                            className="h-9 mt-1"
                                            triggerClassName="bg-background dark:bg-slate-800/80 dark:border-slate-600"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {additionalGuides.map(g => (
                                        <div key={g} className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full px-2 py-0.5">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-4 w-4 text-blue-500"
                                                onClick={() => setAdditionalGuides(additionalGuides.filter(ag => ag !== g))}
                                            >
                                                <XCircle size={14} />
                                            </Button>
                                            <span>{g}</span>
                                        </div>
                                    ))}
                                </div>
                                <hr className="my-2 border-zinc-200 dark:border-zinc-700" />
                                <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                        <Label className="flex items-center gap-2"><Car size={14} />Choferes Adicionales</Label>
                                        <Combobox
                                            options={allAvailableDrivers.filter(d => !additionalDrivers.includes(d.value))}
                                            value={''}
                                            onSelect={(val) => {
                                                if (!additionalDrivers.includes(val)) {
                                                    setAdditionalDrivers([...additionalDrivers, val]);
                                                }
                                            }}
                                            placeholder="Añadir otro chofer..."
                                            className="h-9 mt-1"
                                            triggerClassName="bg-background dark:bg-slate-800/80 dark:border-slate-600"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {additionalDrivers.map(d => (
                                        <div key={d} className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 rounded-full px-2 py-0.5">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-4 w-4 text-green-500"
                                                onClick={() => setAdditionalDrivers(additionalDrivers.filter(ad => ad !== d))}
                                            >
                                                <XCircle size={14} />
                                            </Button>
                                            <span>{d}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-3 sm:p-4 border rounded-lg bg-card">
                            <h3 className="font-semibold mb-2">Añadir Servicio {isAutomatedMode ? 'Adicional' : 'Manualmente'}</h3>
                            <div className="flex items-end gap-2">
                                <div style={{ width: '150px' }}>
                                    <Label>Fecha</Label>
                                    <Input type="date" value={newService.fecha} onChange={(e) => handleNewServiceChange('fecha', e.target.value)} className="mt-1 w-full" />
                                </div>
                                <div className="flex-grow" style={{ minWidth: '250px' }}>
                                    <Label>Actividad</Label>
                                    <Combobox
                                        options={activityOptions}
                                        value={newService.servicio}
                                        onSelect={handleActivitySelect}
                                        placeholder="Buscar actividad..."
                                        className="mt-1 bg-card dark:bg-slate-800/80 dark:border-slate-600"
                                        triggerClassName={cn("dark:bg-slate-800/80 dark:border-slate-600", newService.servicio && "border-green-500 font-medium")}
                                    />
                                </div>
                                <div className="flex-grow" style={{ minWidth: '200px' }}>
                                    <Label>Vuelo</Label>
                                    <Combobox
                                        options={filteredFlightOptions}
                                        value={newService.vuelo || ''}
                                        onSelect={handleFlightSelect}
                                        placeholder="Seleccionar vuelo..."
                                        className="mt-1 bg-card dark:bg-slate-800/80 dark:border-slate-600"
                                        triggerClassName={cn("dark:bg-slate-800/80 dark:border-slate-600", newService.vuelo && "border-green-500 font-medium")}
                                        disabled={!(newService.servicio?.toUpperCase().includes('TRF') || newService.servicio?.toUpperCase().includes('APTO'))}
                                    />
                                </div>
                                <div style={{ width: '100px' }}>
                                    <Label>Hora</Label>
                                    <Input value={newService.hora} onChange={handleTimeInputChange} onBlur={handleTimeInputBlur} placeholder="HH:mm" maxLength={5} className="mt-1 w-full" />
                                </div>
                                <div>
                                    <Button onClick={addNewServiceRow} variant="default" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isAddServiceDisabled}>
                                        <PlusCircle className="mr-2 h-5 w-5" />Añadir
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 sm:p-4 border rounded-lg bg-card">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold mobile-text-base">Resumen ({orderData.services.length} servicios)</h3>
                            </div>
                            <div className="max-h-64 overflow-y-auto overflow-x-auto border rounded-md bg-card">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-primary/10 z-10 hover:bg-primary/10">
                                        <TableRow className="border-b-primary/20">
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{ width: '40px' }}>
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
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{ width: '120px' }}>Fecha</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{ width: '90px' }}>Hora</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20">Servicio</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{ width: '200px' }}>Vuelo</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{ width: '120px' }}>Guía</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{ width: '70px' }}>Bus</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20" style={{ width: '120px' }}>Chofer</TableHead>
                                            <TableHead className="text-primary font-bold p-2 border-r border-primary/20">Observaciones</TableHead>
                                            <TableHead className="text-primary font-bold p-2" style={{ width: '40px' }}></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {orderData.services.length > 0 ? (
                                            orderData.services.map((s, i) => {
                                                const originalIndex = i;
                                                const guiaFirstName = (s.guia || "").split(" ")[0];
                                                const choferName = (s.chofer || "").replace(/^CONT\s/i, '');
                                                const isTransfer = s.servicio?.toUpperCase().includes('TRF') || s.servicio?.toUpperCase().includes('APTO');

                                                return (
                                                    <TableRow key={s.id || i} className="font-mono border-b-primary/20">
                                                        <TableCell className="p-1 border-r border-primary/20 text-center">
                                                            <Checkbox
                                                                checked={selectedServices.has(originalIndex)}
                                                                onCheckedChange={(checked) => handleSelectService(originalIndex, !!checked)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-1 border-r border-primary/20">
                                            <Input type="date" value={s.fecha ? format(parse(s.fecha, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd') : ''} onChange={(e) => handleServiceSummaryChange(originalIndex, 'fecha', e.target.value ? format(parse(e.target.value, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : '')} className="h-8 text-xs bg-card/80 dark:bg-slate-800/90 dark:border-slate-600" />
                                                        </TableCell>
                                                        <TableCell className="p-1 border-r border-primary/20">
                                            <Input value={s.hora} onChange={(e) => handleSummaryTimeChange(originalIndex, e.target.value)} onBlur={(e) => handleSummaryTimeBlur(originalIndex, e.target.value)} placeholder="HH:mm" maxLength={5} className="h-8 text-xs bg-card/80 dark:bg-slate-800/90 dark:border-slate-600" />
                                                        </TableCell>
                                                        <TableCell className="p-1 border-r border-primary/20">
                                                            <Combobox
                                                                options={activityOptions}
                                                                value={s.servicio || ''}
                                                                onSelect={(value) => handleServiceSummaryChange(originalIndex, 'servicio', value)}
                                                                placeholder="Actividad..."
                                                                className="h-8 text-xs"
                                                                triggerClassName="bg-card/80 dark:bg-slate-800/90 dark:border-slate-600"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-1 border-r border-primary/20">
                                                            <Combobox
                                                                options={flights.map(f => ({ value: f.flightNumber, label: `${f.flightNumber} (${f.time})` }))}
                                                                value={s.vuelo || ''}
                                                                onSelect={(val) => handleServiceSummaryChange(originalIndex, 'vuelo', val)}
                                                                placeholder="Vuelo..."
                                                                className="h-8 text-xs" triggerClassName="bg-card/80 dark:bg-slate-800/90 dark:border-slate-600"
                                                                disabled={!isTransfer}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-1 border-r border-primary/20">
                                                            <Select
                                                                value={s.guia || orderData.guia || 'NONE'}
                                                                onValueChange={(value) => handleServiceSummaryChange(originalIndex, 'guia', value === 'NONE' ? '' : value)}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs bg-card/80">
                                                                    <SelectValue placeholder="Guía..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {serviceGuideOptions.map(g => (
                                                                        <SelectItem key={g.value} value={g.value} className="text-xs">{g.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell className="p-1 border-r border-primary/20">
                                                            <Select
                                                                value={s.bus || 'NONE'}
                                                                onValueChange={(value) => handleServiceSummaryChange(originalIndex, 'bus', value === 'NONE' ? '' : value)}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs bg-card/80 dark:bg-slate-800/90 dark:border-slate-600">
                                                                    <SelectValue placeholder="Bus..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="NONE" className="text-xs">Ninguno</SelectItem>
                                                                    <SelectItem value="SIN BUS" className="text-xs">SIN BUS (A PIE)</SelectItem>
                                                                    {busOptions.map(b => (
                                                                        <SelectItem key={b.value} value={b.value} className="text-xs">{b.label}</SelectItem>
                                                                    ))}
                                                                    <SelectItem value="CONT." className="text-xs">Contratado</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell className="p-1 border-r border-primary/20">
                                                            <Select
                                                                value={s.chofer || 'NONE'}
                                                                onValueChange={(value) => handleServiceSummaryChange(originalIndex, 'chofer', value === 'NONE' ? '' : value)}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs bg-card/80 dark:bg-slate-800/90 dark:border-slate-600">
                                                                    <SelectValue placeholder="Chofer..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {serviceDriverOptions.map(d => (
                                                                        <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell className="p-1 border-r border-primary/20 font-sans">
                                                            <Input
                                                                value={s.observaciones || ''}
                                                                onChange={(e) => handleServiceSummaryChange(originalIndex, 'observaciones', e.target.value)}
                                                                className="h-8 text-xs bg-card/80 dark:bg-slate-800/90 dark:border-slate-600"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-1 text-center">
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => removeServiceRow(originalIndex)}>
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
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

                        <div className="p-3 sm:p-4 border rounded-lg bg-card">
                            <Accordion type="multiple" className="w-full">
                                <AccordionItem value="item-1">
                                    <AccordionTrigger>Observaciones Generales</AccordionTrigger>
                                    <AccordionContent>
                                        <Textarea id="observaciones" value={orderData.observations} onChange={e => handleInputChange('observations', e.target.value)} className="mt-1" rows={5} />
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="item-2">
                                    <AccordionTrigger>Nota (Pie de página)</AccordionTrigger>
                                    <AccordionContent>
                                        <Textarea id="nota" value={orderData.nota} onChange={e => handleInputChange('nota', e.target.value)} className="mt-1" rows={5} />
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    </div>

                    {selectedServices.size > 1 && (
                        <div className="sticky bottom-4 w-full flex justify-center">
                            <div className="flex items-center gap-2 p-2 rounded-lg border bg-background shadow-lg animate-in fade-in-50 slide-in-from-bottom-5">
                                <span className="text-sm font-medium pl-2">{selectedServices.size} servicio(s) seleccionado(s)</span>
                                <Input
                                    type="date"
                                    id="master-date"
                                    value={masterDate}
                                    onChange={(e) => setMasterDate(e.target.value)}
                                    className="h-9 w-36"
                                />
                                <Button onClick={handleApplyDateToSelected} size="sm" variant="default" disabled={!masterDate}>
                                    Asignar Fecha
                                </Button>
                                <Button onClick={() => setSelectedServices(new Set())} size="sm" variant="ghost">
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Limpiar
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="pt-4 border-t gap-2 flex justify-end items-center">
                    <Button variant="outline" onClick={handleClearForm} className="mr-auto border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Eraser className="mr-2 h-4 w-4" />
                        Limpiar Formulario
                    </Button>
                    {/* Split Mode Toggle */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-3 px-4 py-2 rounded-md border bg-muted/30">
                                    <div className="flex items-center gap-2">
                                        <Split className="h-4 w-4 text-purple-600" />
                                        <Label htmlFor="split-mode" className="text-sm font-medium cursor-pointer">
                                            {splitModeStatus.willBeDivided
                                                ? `Dividida (${splitModeStatus.totalGuides}G/${splitModeStatus.totalDrivers}C)`
                                                : "Orden Separada"}
                                        </Label>
                                    </div>
                                    <Switch
                                        id="split-mode"
                                        checked={isSplitMode}
                                        onCheckedChange={setIsSplitMode}
                                        disabled={!splitModeStatus.canEnableSplit}
                                        className="data-[state=checked]:bg-purple-600"
                                    />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                {splitModeStatus.canEnableSplit ? (
                                    <p>Activar para crear 2 órdenes idénticas: una para el guía y otra para el chofer. Solo disponible con 1 guía y 1 chofer.</p>
                                ) : splitModeStatus.willBeDivided ? (
                                    <p>Con más de 1 guía o chofer, la orden se dividirá automáticamente (cada responsable recibe solo sus servicios).</p>
                                ) : (
                                    <p>Necesitas asignar 1 guía y 1 chofer para habilitar la orden separada.</p>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                    <Button onClick={handleSaveOrder} disabled={isSaving || isLoadingData}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar Orden
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
