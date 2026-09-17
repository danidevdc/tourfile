
"use client";

import { useState, useEffect, useRef, useMemo, type ChangeEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

import {
    getGuidesFromFirestore, getHotelsFromFirestore, getDriversFromFirestore, getActivitiesFromFirestore, getFlightsFromFirestore, getBusesFromFirestore,
    recordActivityTimeUsage, getSuggestedTimeForActivity,
    type ServiceOrderGuide, type Hotel, type Driver, type Activity, type ServiceItem, type PredefinedFlight, type Bus,
} from '@/lib/serviceOrderService';
import { getServiceOrderRules, type ServiceOrderRule } from '@/lib/serviceOrderRuleService';
import { type ServiceOrderData } from '@/lib/serviceOrderGenerator';
import { generateServicesFromExcelColumnWithDiagnostics, type SkippedTransfer } from '@/lib/serviceOrderProcessor';
import { getServiceOrderDraftError } from '@/lib/serviceOrderDraftValidation';
import { saveServiceOrderWithSplit, saveServiceOrderInSplitMode, type StoredServiceOrder } from '@/lib/serviceOrderStorage';
import { findActiveRootOrdersByExactFile } from '@/lib/serviceOrderSearch';
import { findFileInExcelData, sortServiceItems, type ExcelMatrix } from '@/lib/serviceOrderGeneratorHelpers';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, PlusCircle, Upload, Search, Plane, Save, Trash2, XCircle, Eraser, CheckCircle, UserPlus, Car, Split, FileSpreadsheet, X, Lock, Pencil, UsersRound, ChevronDown, CirclePlus, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FileSearchStatus } from "@/lib/report-generator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
    const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
    const [duplicateOrders, setDuplicateOrders] = useState<StoredServiceOrder[]>([]);
    const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
    const [generationSummary, setGenerationSummary] = useState<{ generatedCount: number; skippedTransfers: SkippedTransfer[] } | null>(null);

    const [ownDrivers, setOwnDrivers] = useState<Driver[]>([]);
    const [externalDrivers, setExternalDrivers] = useState<Driver[]>([]);
    const [serviceOrderRules, setServiceOrderRules] = useState<ServiceOrderRule[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<{ name: string } | null>(null);
    const [excelData, setExcelData] = useState<any[][] | null>(null);
    const [fileSearchStatus, setFileSearchStatus] = useState<FileSearchStatus>("idle");
    const [isProcessingSearch, setIsProcessingSearch] = useState(false);
    const [foundFileColumnIndex, setFoundFileColumnIndex] = useState<number | null>(null);
    const [showFileSuggestions, setShowFileSuggestions] = useState(false);
    const fileFieldWrapperRef = useRef<HTMLDivElement>(null);

    // Números de file únicos detectados en el Excel cargado (ej. "CTFI109860"),
    // usados para sugerir mientras el usuario escribe en el campo File.
    const availableFileNumbers = useMemo(() => {
        if (!excelData) return [];
        const found = new Set<string>();
        for (const row of excelData) {
            if (!row) continue;
            for (const cell of row) {
                if (cell === null || cell === undefined) continue;
                const cellText = String(cell).trim().toUpperCase();
                if (cellText.length >= 4 && /^[A-Z]*\d{3,}$/.test(cellText)) {
                    found.add(cellText);
                }
            }
        }
        return Array.from(found).sort();
    }, [excelData]);

    const fileSuggestions = useMemo(() => {
        const typed = orderData.file.trim().toUpperCase();
        if (!typed) return [];
        return availableFileNumbers.filter(f => f.includes(typed) && f !== typed).slice(0, 8);
    }, [availableFileNumbers, orderData.file]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (fileFieldWrapperRef.current && !fileFieldWrapperRef.current.contains(e.target as Node)) {
                setShowFileSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [newService, setNewService] = useState<ServiceItem>(initialNewServiceState);
    const [busTypeSelection, setBusTypeSelection] = useState('');
    const [choferSelection, setChoferSelection] = useState('');

    const [selectedServices, setSelectedServices] = useState<Set<number>>(new Set());
    const [masterDate, setMasterDate] = useState<string>('');

    const [additionalGuides, setAdditionalGuides] = useState<string[]>([]);
    const [additionalDrivers, setAdditionalDrivers] = useState<string[]>([]);
    const [isSplitMode, setIsSplitMode] = useState(false);

    // Ref y Pax (autocompletados por la búsqueda) quedan readonly por defecto;
    // cada uno se desbloquea de forma independiente con su propio ícono.
    const [isRefUnlocked, setIsRefUnlocked] = useState(false);
    const [isPaxUnlocked, setIsPaxUnlocked] = useState(false);
    const [isAdicionalesOpen, setIsAdicionalesOpen] = useState(false);
    const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);

    // Calculate if split mode can be enabled (only with exactly 1 guide and 1 driver)
    const splitModeStatus = useMemo(() => {
        const totalGuides = orderData.guia ? 1 + additionalGuides.length : additionalGuides.length;
        const totalDrivers = choferSelection ? 1 + additionalDrivers.length : additionalDrivers.length;

        const canEnableSplit = totalGuides === 1 && totalDrivers === 1;
        const willBeDivided = totalGuides > 1 || totalDrivers > 1;

        return { canEnableSplit, willBeDivided, totalGuides, totalDrivers };
    }, [orderData.guia, additionalGuides, choferSelection, additionalDrivers]);

    // Cuando hay un único guía/bus/chofer asignado (sin adicionales), cambiar el
    // valor principal actualiza las filas de la tabla que aún coincidían con el
    // valor anterior — las que ya fueron editadas manualmente a otro valor no se tocan.
    const prevGuiaRef = useRef(orderData.guia);
    const prevBusRef = useRef(busTypeSelection);
    const prevChoferRef = useRef(choferSelection);

    useEffect(() => {
        const prevGuia = prevGuiaRef.current;
        prevGuiaRef.current = orderData.guia;
        if (!splitModeStatus.canEnableSplit) return;
        if (!prevGuia || prevGuia === orderData.guia) return;
        setOrderData((prev: ServiceOrderData) => ({
            ...prev,
            services: prev.services.map(s => s.guia === prevGuia ? { ...s, guia: orderData.guia } : s),
        }));
    }, [orderData.guia, splitModeStatus.canEnableSplit]);

    useEffect(() => {
        const prevBus = prevBusRef.current;
        prevBusRef.current = busTypeSelection;
        if (!splitModeStatus.canEnableSplit) return;
        if (!prevBus || prevBus === busTypeSelection) return;
        setOrderData((prev: ServiceOrderData) => ({
            ...prev,
            services: prev.services.map(s => s.bus === prevBus ? { ...s, bus: busTypeSelection } : s),
        }));
    }, [busTypeSelection, splitModeStatus.canEnableSplit]);

    useEffect(() => {
        const prevChofer = prevChoferRef.current;
        prevChoferRef.current = choferSelection;
        if (!splitModeStatus.canEnableSplit) return;
        if (!prevChofer || prevChofer === choferSelection) return;
        setOrderData((prev: ServiceOrderData) => ({
            ...prev,
            services: prev.services.map(s => s.chofer === prevChofer ? { ...s, chofer: choferSelection } : s),
        }));
    }, [choferSelection, splitModeStatus.canEnableSplit]);

    const processAndStoreFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const XLSX = await import('xlsx');
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
        setGenerationSummary(null);
        setBusTypeSelection('');
        setChoferSelection('');
        setNewService(initialNewServiceState);
        setFileSearchStatus("idle");
        setSelectedServices(new Set());
        setMasterDate('');
        toast({ title: "Formulario Limpiado" });
    }

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const storedFile = sessionStorage.getItem(SESSION_STORAGE_FILE_KEY);
        const storedFileName = sessionStorage.getItem(SESSION_STORAGE_FILENAME_KEY);
        if (!storedFile || !storedFileName) return;

        (async () => {
            try {
                const byteString = atob(storedFile);
                const byteNumbers = new Array(byteString.length);
                for (let i = 0; i < byteString.length; i++) byteNumbers[i] = byteString.charCodeAt(i);
                const byteArray = new Uint8Array(byteNumbers);
                const file = new File([new Blob([byteArray])], storedFileName);
                setSelectedFile({ name: file.name });
                const XLSX = await import('xlsx');
                const workbook = XLSX.read(byteArray, { type: 'array', cellDates: true });
                setExcelData(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, blankrows: false, defval: null }));
            } catch (e) {
                clearFile();
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            setGenerationSummary(null);
            setSelectedFile({ name: file.name });
            toast({ title: "Archivo Seleccionado", variant: "success" });
            processAndStoreFile(file);
        }
        if (event.target) event.target.value = "";
    };

    const clearFile = () => {
        setGenerationSummary(null);
        setSelectedFile(null); setExcelData(null); setFileSearchStatus("idle");
        setOrderData({ ...orderData, file: '', ref: '', nPax: '', services: [] });
        if (fileInputRef.current) fileInputRef.current.value = "";
        sessionStorage.removeItem(SESSION_STORAGE_FILE_KEY);
        sessionStorage.removeItem(SESSION_STORAGE_FILENAME_KEY);
        toast({ title: "Archivo Limpiado" });
    };

    const handleSearchFile = async (fileNumberOverride?: string) => {
        setGenerationSummary(null);
        const fileNumberInput = fileNumberOverride ?? orderData.file;
        if (!selectedFile || !excelData || !fileNumberInput) {
            toast({ title: "Datos incompletos", description: "Selecciona un archivo e ingresa un número de file.", variant: "destructive" }); return;
        }
        setIsRefUnlocked(false);
        setIsPaxUnlocked(false);

        // Fix: Check if excelData is empty or first row is invalid
        if (excelData.length === 0 || !excelData[0]) {
            toast({ title: "Archivo Inválido", description: "El archivo Excel parece estar vacío o no tiene columnas.", variant: "destructive" }); return;
        }

        setIsProcessingSearch(true); setFileSearchStatus("searching");
        await new Promise(resolve => setTimeout(resolve, 300));

        const result = findFileInExcelData(excelData as ExcelMatrix, fileNumberInput, hotels);

        if (!result.found && result.ambiguous) {
            setIsProcessingSearch(false);
            setFileSearchStatus("error");
            toast({
                title: "Número de File Ambiguo",
                description: `Se encontraron varios files terminados en "${fileNumberInput.trim().toUpperCase()}" (${result.distinctValues.join(", ")}). Ingresa el número completo con su prefijo.`,
                variant: "destructive",
            });
            return;
        }

        if (result.found) {
            setFileSearchStatus("found");
            setFoundFileColumnIndex(result.fileColumnIndex);

            setOrderData((prev: ServiceOrderData) => ({
                ...prev,
                // Si se encontró por sufijo numérico, usar el número de file real
                // del Excel (con prefijo), no los dígitos que el usuario tecleó.
                file: result.realFileNumber ?? prev.file,
                ref: result.groupName, nPax: result.pax, hotel: result.hotelName, services: [],
            }));
            toast({ title: "Búsqueda Exitosa", description: `Grupo: ${result.groupName}, PAX: ${result.pax}, Hotel: ${result.hotelName || 'No encontrado'}`, variant: "success", duration: 5000 });

        } else {
            setFileSearchStatus("not_found");
            setOrderData({ ...orderData, ref: '', nPax: '', hotel: '', services: [] });
            setFoundFileColumnIndex(null);
            toast({ title: "Búsqueda Fallida", description: "Número de file no encontrado.", variant: "destructive" });
        }
        setIsProcessingSearch(false);
    };

    const handleSelectFileSuggestion = (fileNumber: string) => {
        setOrderData(prev => ({ ...prev, file: fileNumber }));
        setShowFileSuggestions(false);
        handleSearchFile(fileNumber);
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

        const generationResult = generateServicesFromExcelColumnWithDiagnostics(
            excelData,
            foundFileColumnIndex,
            serviceOrderRules,
            activities,
            flights
        );
        const generatedServicesRaw = generationResult.services;

        const generatedServicesWithDetails = generatedServicesRaw.map(service => ({
            ...service,
            id: crypto.randomUUID(),
            guia: mainGuide,
            bus: mainBus,
            chofer: mainChofer,
        }));

        const sortedGenerated = sortServiceItems(generatedServicesWithDetails);
        setOrderData((prev: ServiceOrderData) => ({ ...prev, services: sortedGenerated }));
        setGenerationSummary({ generatedCount: sortedGenerated.length, skippedTransfers: generationResult.skippedTransfers });
        const omittedTransfers = generationResult.skippedTransfers.length;
        const omittedMessage = omittedTransfers > 0
            ? ` Se omitieron ${omittedTransfers} traslados sin un vuelo de La Paz compatible.`
            : '';
        toast({
            title: "Generación Exitosa",
            description: `Se generaron ${sortedGenerated.length} servicios ordenados.${omittedMessage}`,
            variant: "success",
            duration: 5000,
        });
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

    const handleSaveOrder = async (skipDuplicateCheck = false) => {
        const draftError = getServiceOrderDraftError(orderData);
        if (draftError || !currentUser?.email) {
            toast({ title: "Revisa la orden", description: draftError || "Inicia sesión antes de guardar.", variant: "destructive" }); return;
        }

        if (!skipDuplicateCheck) {
            setIsCheckingDuplicate(true);
            try {
                const matches = await findActiveRootOrdersByExactFile(orderData.file);
                if (matches.length > 0) {
                    setDuplicateOrders(matches);
                    setIsDuplicateOpen(true);
                    return;
                }
            } catch (error: any) {
                toast({ title: "No se pudo verificar el file", description: error.message || "Intenta nuevamente.", variant: "destructive" });
                return;
            } finally {
                setIsCheckingDuplicate(false);
            }
        }

        setIsSaving(true);
        try {
            // If split mode is enabled and conditions are met, use split mode
            if (isSplitMode && splitModeStatus.canEnableSplit) {
                await saveServiceOrderInSplitMode(orderData, currentUser.email);
                toast({ title: "Éxito", description: "Orden de servicio separada guardada exitosamente (1 para guía, 1 para chofer).", variant: "success" });
            } else {
                // Otherwise, use the automatic split function
                await saveServiceOrderWithSplit(orderData, currentUser.email);
                const message = splitModeStatus.willBeDivided
                    ? "Orden de servicio guardada y dividida exitosamente."
                    : "Orden de servicio guardada exitosamente.";
                toast({ title: "Éxito", description: message, variant: "success" });
            }
            setIsDuplicateOpen(false);
            setGenerationSummary(null);
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


    const guideOptions = guides.map(g => ({ value: g.fullName.toUpperCase(), label: g.fullName, key: g.uid }));
    const hotelOptions = hotels.map(h => ({ value: h.name.toUpperCase(), label: h.name, key: h.id }));
    const driverOptions = (busTypeSelection === 'CONT.' ? externalDrivers : ownDrivers).map(d => ({ value: d.name.toUpperCase(), label: d.name.replace(/^CONT\\s/i, ''), key: d.id }));
    const activityOptions = activities.map(a => ({ value: a.name.toUpperCase(), label: a.name, key: a.id }));
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
    const allAvailableGuides = guides.map(g => ({ value: g.fullName.toUpperCase(), label: g.fullName, key: g.uid }));
    const allAvailableDrivers = drivers.map(d => ({ value: d.name.toUpperCase(), label: d.name, key: d.id }));

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
                <TooltipProvider>
                <SheetHeader className="space-y-0">
                    <SheetTitle className="text-2xl font-headline text-primary">
                        {isAutomatedMode ? 'Generar orden automatizada' : 'Nueva orden de servicio'}
                    </SheetTitle>
                </SheetHeader>
                <div className="flex-grow min-h-0 overflow-y-auto mobile-padding relative -mt-2">
                    <div className="space-y-4 py-2">
                        <div className="space-y-4 p-3 sm:p-4 border rounded-lg bg-card">
                            {/* Chip compacto del archivo subido, en su propia fila */}
                            {selectedFile ? (
                                <div className="flex items-center gap-2 w-fit rounded-full border border-green-500/50 bg-green-50 dark:bg-emerald-950/30 px-3 py-1.5 text-sm">
                                    <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                                    <FileSpreadsheet className="h-3.5 w-3.5 text-green-700 dark:text-emerald-400 shrink-0" />
                                    <span className="text-green-800 dark:text-emerald-200 font-medium truncate max-w-[240px]">{selectedFile.name}</span>
                                    <button type="button" onClick={clearFile} className="text-green-600/60 hover:text-destructive transition-colors">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-fit justify-start">
                                        <Upload className="mr-2 h-4 w-4" />Seleccionar archivo .xlsx
                                    </Button>
                                </div>
                            )}
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx,.xls" />

                            <div className="flex flex-wrap items-end gap-4">
                                <div ref={fileFieldWrapperRef} className="relative" style={{ width: '175px' }}>
                                    <Label htmlFor="file">File:*</Label>
                                    <div className="flex items-center gap-1 mt-1">
                                        <Input
                                            id="file"
                                            value={orderData.file}
                                            onChange={e => {
                                                handleInputChange('file', e.target.value);
                                                setShowFileSuggestions(true);
                                            }}
                                            onFocus={() => setShowFileSuggestions(true)}
                                            className={cn("rounded-md ring-2 ring-blue-200 dark:ring-blue-500/30 shadow-[0_0_0_3px_rgba(47,111,237,0.10)]", orderData.file && "border-green-500")}
                                            autoComplete="off"
                                        />
                                        <Button type="button" onClick={() => handleSearchFile()} size="icon" className="shrink-0" disabled={!selectedFile || !orderData.file || isProcessingSearch}>
                                            {isProcessingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    {showFileSuggestions && fileSuggestions.length > 0 && (
                                        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                                            {fileSuggestions.map(f => (
                                                <button
                                                    type="button"
                                                    key={f}
                                                    onClick={() => handleSelectFileSuggestion(f)}
                                                    className="block w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                                                >
                                                    {f}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-1 min-w-[380px] items-end gap-3 transition-opacity" style={{ opacity: fileSearchStatus === "found" ? 1 : 0.45 }}>
                                    <div className="flex-[3]">
                                        <Label htmlFor="ref">Ref (Grupo):</Label>
                                        <div className="relative mt-1">
                                            <Input
                                                id="ref"
                                                value={orderData.ref}
                                                readOnly={!isRefUnlocked}
                                                tabIndex={isRefUnlocked ? 0 : -1}
                                                onMouseDown={e => { if (!isRefUnlocked) e.preventDefault(); }}
                                                onChange={e => handleInputChange('ref', e.target.value)}
                                                className={cn("pr-8", !isRefUnlocked && "cursor-default", orderData.ref && !isRefUnlocked && "border-green-500 bg-green-50 dark:bg-emerald-950/20")}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setIsRefUnlocked(v => !v)}
                                                title={isRefUnlocked ? "Bloquear edición" : "Editar manualmente"}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {isRefUnlocked ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="w-[70px] shrink-0">
                                        <Label htmlFor="nPax">Nº Pax:</Label>
                                        <div className="relative mt-1">
                                            <Input
                                                id="nPax"
                                                value={orderData.nPax}
                                                readOnly={!isPaxUnlocked}
                                                tabIndex={isPaxUnlocked ? 0 : -1}
                                                onMouseDown={e => { if (!isPaxUnlocked) e.preventDefault(); }}
                                                onChange={e => handleInputChange('nPax', e.target.value)}
                                                maxLength={3}
                                                className={cn("text-left pr-7", !isPaxUnlocked && "cursor-default", orderData.nPax && !isPaxUnlocked && "border-green-500 bg-green-50 dark:bg-emerald-950/20")}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setIsPaxUnlocked(v => !v)}
                                                title={isPaxUnlocked ? "Bloquear edición" : "Editar manualmente"}
                                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {isPaxUnlocked ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-[2.4]">
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
                                {isAutomatedMode && (() => {
                                    const pending = [
                                        fileSearchStatus !== 'found' && 'buscar un file válido',
                                        !orderData.guia && 'elegir guía',
                                        !busTypeSelection && 'elegir bus',
                                        !choferSelection && 'elegir chofer',
                                    ].filter(Boolean);
                                    const isReady = pending.length === 0;
                                    return (
                                        <div className="col-span-2 space-y-1">
                                            <Button
                                                onClick={handleGenerateServices}
                                                disabled={!isReady}
                                                className="w-full h-10 bg-green-600 hover:bg-green-700 text-white"
                                            >
                                                <span className="flex items-center">
                                                    <CheckCircle className="mr-2 h-5 w-5" />
                                                    Generar Servicios
                                                </span>
                                            </Button>
                                            {!isReady && <p className="text-xs text-muted-foreground" role="status">Falta: {pending.join(', ')}.</p>}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Botones-ícono lado a lado: cada uno activa/desactiva su propia ficha debajo */}
                            <div className="flex items-center gap-2">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            variant={isAdicionalesOpen ? "secondary" : "outline"}
                                            size="icon"
                                            onClick={() => setIsAdicionalesOpen(v => !v)}
                                        >
                                            <UsersRound className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Guías / Choferes Adicionales</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            variant={isAddServiceOpen ? "secondary" : "outline"}
                                            size="icon"
                                            onClick={() => setIsAddServiceOpen(v => !v)}
                                        >
                                            <CirclePlus className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Añadir Servicio {isAutomatedMode ? 'Adicional' : 'Manualmente'}</TooltipContent>
                                </Tooltip>
                            </div>

                            {isAdicionalesOpen && (
                                <div className="mt-3 space-y-3 p-3 rounded-lg border bg-zinc-50 dark:bg-zinc-900/50">
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
                            )}

                            {isAddServiceOpen && (
                                <div className="flex items-end gap-2 mt-3 p-3 rounded-lg border bg-zinc-50 dark:bg-zinc-900/50">
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
                            )}
                        </div>

                        {generationSummary && (
                            <div className={cn('rounded-lg border p-3 text-sm', generationSummary.skippedTransfers.length > 0 ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-100')} role="status">
                                <div className="flex items-start gap-2 font-medium">
                                    {generationSummary.skippedTransfers.length > 0 ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                                    <span>{generationSummary.generatedCount} servicios generados{generationSummary.skippedTransfers.length > 0 ? `. ${generationSummary.skippedTransfers.length} traslados omitidos; revisa antes de guardar.` : '.'}</span>
                                </div>
                                {generationSummary.skippedTransfers.length > 0 && (
                                    <ul className="mt-2 ml-6 list-disc space-y-1 text-xs">
                                        {generationSummary.skippedTransfers.map((transfer) => (
                                            <li key={`${transfer.rowNumber}-${transfer.activity}`}>
                                                Fila {transfer.rowNumber}: {transfer.activity} {transfer.detectedFlightNumbers.length > 0 ? `(${transfer.detectedFlightNumbers.join(', ')})` : '(sin código de vuelo)'} — {transfer.reason === 'DIRECTION_MISMATCH' ? 'dirección incompatible' : transfer.reason === 'FLIGHT_NOT_IN_DATABASE' ? 'vuelo no registrado' : 'sin código de vuelo'}.
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        <div>
                            <h3 className="font-semibold mobile-text-base mb-2 px-1">Resumen ({orderData.services.length} servicios)</h3>
                            <div className="hidden lg:block max-h-96 overflow-y-auto overflow-x-auto rounded-lg border bg-card ring-2 ring-blue-200 dark:ring-blue-500/30 shadow-[0_0_0_4px_rgba(47,111,237,0.10)]">
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
                                                const guiaFirstName = ((s.guia || orderData.guia) || "").split(" ")[0];
                                                const choferName = (s.chofer || "").replace(/^CONT\s/i, '');
                                                const isTransfer = s.servicio?.toUpperCase().includes('TRF') || s.servicio?.toUpperCase().includes('APTO');

                                                return (
                                                    <TableRow key={s.id || i} className="border-b-primary/20">
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
                                                                <SelectTrigger className="h-8 text-xs bg-card/80 dark:bg-slate-800/90 dark:border-slate-600">
                                                                    <SelectValue placeholder="Guía..." className="flex-1 text-left truncate">
                                                                        {guiaFirstName || undefined}
                                                                    </SelectValue>
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
                                                        <TableCell className="p-1 border-r border-primary/20">
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
                            <div className="space-y-3 lg:hidden">
                                {orderData.services.length === 0 ? (
                                    <div className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Aún no hay servicios. Genera los del Excel o añade uno manualmente.</div>
                                ) : orderData.services.map((service, index) => {
                                    const isTransfer = service.servicio?.toUpperCase().includes('TRF') || service.servicio?.toUpperCase().includes('APTO');
                                    return (
                                        <article key={service.id || index} className="rounded-xl border bg-card p-3 shadow-sm space-y-3">
                                            <div className="flex items-center justify-between gap-2 border-b pb-2">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <Checkbox checked={selectedServices.has(index)} onCheckedChange={(checked) => handleSelectService(index, !!checked)} aria-label={`Seleccionar servicio ${index + 1}`} />
                                                    <span className="truncate text-sm font-semibold">Servicio {index + 1}{service.servicio ? ` · ${service.servicio}` : ''}</span>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive" onClick={() => removeServiceRow(index)} aria-label={`Quitar servicio ${index + 1}`}><XCircle className="h-4 w-4" /></Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><Label htmlFor={`service-date-${index}`}>Fecha</Label><Input id={`service-date-${index}`} type="date" value={service.fecha ? format(parse(service.fecha, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd') : ''} onChange={(e) => handleServiceSummaryChange(index, 'fecha', e.target.value ? format(parse(e.target.value, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : '')} className="mt-1" /></div>
                                                <div><Label htmlFor={`service-time-${index}`}>Hora</Label><Input id={`service-time-${index}`} value={service.hora} onChange={(e) => handleSummaryTimeChange(index, e.target.value)} onBlur={(e) => handleSummaryTimeBlur(index, e.target.value)} placeholder="HH:mm" maxLength={5} className="mt-1" /></div>
                                            </div>
                                            <div><Label>Actividad</Label><Combobox options={activityOptions} value={service.servicio || ''} onSelect={(value) => handleServiceSummaryChange(index, 'servicio', value)} placeholder="Buscar actividad..." className="mt-1" /></div>
                                            {isTransfer && <div><Label>Vuelo</Label><Combobox options={flights.map(f => ({ value: f.flightNumber, label: `${f.flightNumber} (${f.time})` }))} value={service.vuelo || ''} onSelect={(value) => handleServiceSummaryChange(index, 'vuelo', value)} placeholder="Seleccionar vuelo..." className="mt-1" /></div>}
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                <div><Label>Guía</Label><Select value={service.guia || orderData.guia || 'NONE'} onValueChange={(value) => handleServiceSummaryChange(index, 'guia', value === 'NONE' ? '' : value)}><SelectTrigger className="mt-1"><SelectValue placeholder="Guía..." /></SelectTrigger><SelectContent>{serviceGuideOptions.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent></Select></div>
                                                <div><Label>Bus</Label><Select value={service.bus || 'NONE'} onValueChange={(value) => handleServiceSummaryChange(index, 'bus', value === 'NONE' ? '' : value)}><SelectTrigger className="mt-1"><SelectValue placeholder="Bus..." /></SelectTrigger><SelectContent><SelectItem value="NONE">Ninguno</SelectItem><SelectItem value="SIN BUS">Sin bus (a pie)</SelectItem>{busOptions.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}<SelectItem value="CONT.">Contratado</SelectItem></SelectContent></Select></div>
                                                <div><Label>Chofer</Label><Select value={service.chofer || 'NONE'} onValueChange={(value) => handleServiceSummaryChange(index, 'chofer', value === 'NONE' ? '' : value)}><SelectTrigger className="mt-1"><SelectValue placeholder="Chofer..." /></SelectTrigger><SelectContent>{serviceDriverOptions.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent></Select></div>
                                            </div>
                                            <div><Label htmlFor={`service-notes-${index}`}>Observaciones</Label><Input id={`service-notes-${index}`} value={service.observaciones || ''} onChange={(e) => handleServiceSummaryChange(index, 'observaciones', e.target.value)} className="mt-1" /></div>
                                        </article>
                                    );
                                })}
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
                <div className="pt-4 border-t gap-2 flex flex-wrap justify-end items-center">
                    <Button variant="outline" onClick={handleClearForm} className="mr-auto border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Eraser className="mr-2 h-4 w-4" />
                        Limpiar Formulario
                    </Button>
                    {/* Split Mode Toggle */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-3 px-4 py-2 rounded-md border border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-950/30">
                                <div className="flex items-center gap-2">
                                    <Split className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                    <Label htmlFor="split-mode" className="text-sm font-medium cursor-pointer text-purple-900 dark:text-purple-100">
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
                                    className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-purple-200 dark:data-[state=unchecked]:bg-purple-900/60"
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
                    <Button variant="outline" onClick={onClose} className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive">Cerrar</Button>
                    <Button onClick={() => void handleSaveOrder()} disabled={isSaving || isLoadingData || isCheckingDuplicate}>
                        <Save className="mr-2 h-4 w-4" />
                        {isCheckingDuplicate ? 'Verificando file...' : 'Guardar orden'}
                    </Button>
                </div>
                <AlertDialog open={isDuplicateOpen} onOpenChange={setIsDuplicateOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Ya existe una orden con este file</AlertDialogTitle>
                            <AlertDialogDescription>
                                Se encontraron {duplicateOrders.length === 1 ? 'estos datos' : 'estas órdenes'} para el file <strong>{orderData.file}</strong>. ¿Estás seguro de que deseas crear otra?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm">
                            {duplicateOrders.map(existingOrder => (
                                <li key={existingOrder.id} className="flex items-center justify-between gap-3">
                                    <span className="font-medium">{existingOrder.orderName.replace(/_/g, ' ')}</span>
                                    <span className="shrink-0 text-muted-foreground">{format(existingOrder.createdAt, 'dd/MM/yyyy')}</span>
                                </li>
                            ))}
                        </ul>
                        {generationSummary && generationSummary.skippedTransfers.length > 0 && <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">Atención: {generationSummary.skippedTransfers.length} traslados no se incluyeron. Puedes volver al resumen para revisarlos.</p>}
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction disabled={isSaving} onClick={(event) => { event.preventDefault(); setIsDuplicateOpen(false); void handleSaveOrder(true); }}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Crear de todas formas
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                </TooltipProvider>
            </SheetContent>
        </Sheet>
    );
}
