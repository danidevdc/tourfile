
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";

import { 
    getAllServiceOrders, 
    deleteBulkServiceOrders,
    updateServiceOrder, 
    type StoredServiceOrder, 
    saveServiceOrder, 
    type OrderStatus,
    getChildrenByParentId,
    softCancelServiceOrder,
    saveEditedServiceOrder,
    deleteServiceOrder, // Import the correct soft-delete function
} from '@/lib/serviceOrderStorage';
import { generateServiceOrderExcel, type ServiceOrderData } from '@/lib/serviceOrderGenerator';
import { getFamilyId, childNameFrom, getBaseName, shortPerson } from "@/lib/serviceOrderFamily";
import { showSimplePreviewModal } from '@/lib/simplePreviewModal';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Trash2, FilePlus, ListOrdered, Eye, Printer, Search, FilePenLine, Bot, ShieldAlert, FileDown, ChevronDown, Image, Split, User, Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ServiceOrderGeneratorSheet } from "@/components/service-order/ServiceOrderGeneratorSheet";
import { ServiceOrderEditModal } from "@/components/service-order/ServiceOrderEditModal";
import ServiceOrderPreviewModal from "@/components/service-order/ServiceOrderPreviewModal";
import { getGuidesFromFirestore, getDriversFromFirestore, getHotelsFromFirestore, getActivitiesFromFirestore, getFlightsFromFirestore, getBusesFromFirestore, type ServiceOrderGuide, type Driver, type Hotel, type Activity, type PredefinedFlight, type Bus } from "@/lib/serviceOrderService";
import { Checkbox } from "@/components/ui/checkbox";
import { ServiceOrderDeletionFilter, type FilterState } from "@/components/service-order/ServiceOrderDeletionFilter";


const defaultObsText = '';
const defaultNotaText = 'TODOS LOS GUÍAS DEBEN ENVIAR UN INFORME DIARIO POR WHATSAPP A LA SEÑORA JUDITH SOBRE LOS SERVICIOS REALIZADOS.\nGUIA DEBE PRESENTAR COPIA DE PASAPORTE DE PAX DESPUES DE CADA SERVICIO JUNTO A SU LIQUIDACION Y CAJA CHICA\nLA CAJA CHICA CUBRE 1 BOTELLA DE AGUA POR DÍA PARA CADA PAX, GUÍA Y CHOFER. NO INCLUYE TRANSFERS NI SERVICIOS EN EL LAGO.';

const initialOrderDataState: ServiceOrderData = {
    guia: '', file: '', ref: '', nPax: '', hotel: '', services: [],
    observations: defaultObsText, nota: defaultNotaText
};

const ITEMS_PER_PAGE = 10;

// Extend the Window interface to include our global function
declare global {
    interface Window {
        showSimplePreviewModal: (order: StoredServiceOrder, onStatusUpdate?: (orderId: string) => void) => void;
        __serviceOrdersMap: Map<string, StoredServiceOrder>;
        __handleStatusUpdate: (orderId: string) => void;
    }
}


export default function ServiceOrderListPage() {
  const router = useRouter();
  const { currentUser, isLoading: authLoading, isCurrentUserAdmin } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<StoredServiceOrder[]>([]);
  const [guides, setGuides] = useState<ServiceOrderGuide[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [flights, setFlights] = useState<PredefinedFlight[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [filterState, setFilterState] = useState<FilterState>('active');

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAutomatedMode, setIsAutomatedMode] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  
  const [orderToEdit, setOrderToEdit] = useState<StoredServiceOrder | null>(null);
  const [orderToPreview, setOrderToPreview] = useState<StoredServiceOrder | null>(null);
  
  const [intermediateOrderData, setIntermediateOrderData] = useState<ServiceOrderData>(initialOrderDataState);

  const [orderToDelete, setOrderToDelete] = useState<StoredServiceOrder | null>(null);
  const [isPrintingPdfId, setIsPrintingPdfId] = useState<string | null>(null);
  const [isDownloadingId, setIsDownloadingId] = useState<string | null>(null);


  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const [fetchedOrders, fetchedGuides, fetchedDrivers, fetchedHotels, fetchedActivities, fetchedFlights, fetchedBuses] = await Promise.all([
        getAllServiceOrders(),
        getGuidesFromFirestore(),
        getDriversFromFirestore(),
        getHotelsFromFirestore(),
        getActivitiesFromFirestore(),
        getFlightsFromFirestore(),
        getBusesFromFirestore(),
      ]);
      setOrders(fetchedOrders);
      setGuides(fetchedGuides);
      setDrivers(fetchedDrivers);
      setHotels(fetchedHotels);
      setActivities(fetchedActivities);
      setFlights(fetchedFlights);
      setBuses(fetchedBuses);
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los datos iniciales.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchOrders();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const families = useMemo(() => {
    const currentFilter = isCurrentUserAdmin ? filterState : 'active';

    const orderIsVisible = (order: StoredServiceOrder) => {
        if (currentFilter === 'all') return true;
        const isInactive = order.status === 'eliminado' || order.status === 'cancelado';
        if (currentFilter === 'deleted') return order.status === 'eliminado';
        if (currentFilter === 'active') return !isInactive;
        return !isInactive; // Default to 'active' behavior
    };

    const visibleOrders = orders.filter(orderIsVisible);
    
    const searchedOrders = searchTerm
      ? visibleOrders.filter(order => {
          const lowercasedFilter = searchTerm.toLowerCase();
          const date = format(order.createdAt, 'dd/MM/yyyy', { locale: es });
          
          if (!order.data) return false;

          const allGuidsInOrder = new Set<string>();
          if (order.data.guia) allGuidsInOrder.add(order.data.guia);
          order.data.services?.forEach(s => {
              if (s.guia) allGuidsInOrder.add(s.guia);
          });
          
          const allDriversInOrder = new Set<string>();
           order.data.services?.forEach(s => {
              if (s.chofer) allDriversInOrder.add(s.chofer);
          });

          const checkOrder = 
            order.orderName.replace(/_/g, ' ').toLowerCase().includes(lowercasedFilter) ||
            (order.data.file && order.data.file.toLowerCase().includes(lowercasedFilter)) ||
            Array.from(allGuidsInOrder).some(g => shortPerson(g).toLowerCase().includes(lowercasedFilter)) ||
            Array.from(allDriversInOrder).some(d => shortPerson(d).toLowerCase().includes(lowercasedFilter)) ||
            (isCurrentUserAdmin && order.createdBy && order.createdBy.toLowerCase().includes(lowercasedFilter)) ||
            (isCurrentUserAdmin && date.toLowerCase().includes(lowercasedFilter));

          return checkOrder;
        })
      : visibleOrders;

    const byId = new Map(searchedOrders.map(o => [o.id, o]));
    const familyGroups = new Map<string, { parent: StoredServiceOrder; children: StoredServiceOrder[] }>();

    for (const order of searchedOrders) {
        if (!order.data) continue;
        const familyId = getFamilyId(order);
        const parentOrder = byId.get(familyId);
        
        if (parentOrder) {
            if (!familyGroups.has(familyId)) {
                familyGroups.set(familyId, { parent: parentOrder, children: [] });
            }
            if (order.id !== familyId) {
                const existingChildren = familyGroups.get(familyId)!.children;
                existingChildren.push(order);
            }
        }
    }
    
    const allFamilies = Array.from(familyGroups.values());

    return allFamilies
      .map(group => ({
        ...group,
        children: group.children.sort((a, b) => a.orderName.localeCompare(b.orderName))
      }))
      .sort((a, b) => b.parent.createdAt.getTime() - a.parent.createdAt.getTime());

  }, [orders, filterState, searchTerm, isCurrentUserAdmin]);
  
  
  const handleStatusUpdate = async (orderId: string) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;
    
    const isUpdatableStatus = !['excel', 'enviado', 'impreso', 'eliminado', 'cancelado'].includes(orderToUpdate.status);
    if (isUpdatableStatus) {
        try {
            await updateServiceOrder(orderId, 'enviado');
            setOrders(prevOrders => 
                prevOrders.map(o => o.id === orderId ? { ...o, status: 'enviado' } : o)
            );
        } catch (error) {
            console.error("Failed to update order status:", error);
            toast({ title: "Error", description: "No se pudo actualizar el estado de la orden.", variant: "destructive" });
        }
    }
  };

  // Expose the modal function and data globally
  useEffect(() => {
    window.showSimplePreviewModal = (order, onStatusUpdate) => {
        const family = families.find(f => f.parent.id === getFamilyId(order));
        if (family && family.parent.data.isSplitParent) {
            showSimplePreviewModal({ ...family.parent }, onStatusUpdate);
        } else {
            showSimplePreviewModal(order, onStatusUpdate);
        }
    };
    
    // Make handleStatusUpdate available globally for the raw HTML button to call
    window.__handleStatusUpdate = handleStatusUpdate;

    const ordersMap = new Map<string, StoredServiceOrder>();
    orders.forEach(order => ordersMap.set(order.id, order));
    window.__serviceOrdersMap = ordersMap;
  }, [orders, families]);
  
  const paginatedFamilies = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return families.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [families, currentPage]);

  const totalPages = Math.ceil(families.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedOrderIds(new Set()); 
  }, [searchTerm, filterState]);


  const handleNewOrderClick = () => {
    setIsAutomatedMode(false);
    setIsSheetOpen(true);
  };
  
  const handleAutomatedOrderClick = () => {
      setIsAutomatedMode(true);
      setIsSheetOpen(true);
  };

  const handleEditOrderClick = (order: StoredServiceOrder) => {
    setOrderToEdit(order);
    setIsEditModalOpen(true);
  };

  const handlePreviewOrderClick = async (order: StoredServiceOrder) => {
    const family = families.find(f => f.parent.id === getFamilyId(order));
    let orderToDisplay = order;

    if (family && family.parent.data.isSplitParent) {
        orderToDisplay = { ...family.parent };
    }
    
    setOrderToPreview(orderToDisplay);
    setIsPreviewModalOpen(true);
  };
  
  const handleSaveFromEditModal = async (updatedOrderData: ServiceOrderData) => {
    if (!orderToEdit || !currentUser?.email) return;

    try {
        await saveEditedServiceOrder(orderToEdit, updatedOrderData, currentUser.email);
        toast({ title: "Éxito", description: "La orden ha sido actualizada y/o dividida exitosamente.", className: "bg-green-100 dark:bg-green-950/30 dark:text-green-200 dark:border-green-700" });
    } catch (error: any) {
        console.error("Error saving/splitting order:", error);
        toast({ title: "Error al Guardar", description: error.message || "No se pudo guardar la orden.", variant: "destructive" });
    }

    await fetchOrders(); // Wait for orders to load before closing modal
    setIsEditModalOpen(false);
    setOrderToEdit(null);
  };


  const handleDeleteOrder = async () => {
    if (!orderToDelete || !orderToDelete.id || !currentUser?.email) return;

    try {
        await deleteServiceOrder(orderToDelete.id, currentUser.email);
        toast({ title: "Éxito", description: `La orden "${getBaseName(orderToDelete.orderName)}" ha sido marcada como eliminada.`, className: "bg-green-100 dark:bg-green-950/30 dark:text-green-200 dark:border-green-700" });
        fetchOrders();
    } catch (error) {
        toast({ title: "Error", description: "No se pudo eliminar la orden.", variant: "destructive"});
    } finally {
        setOrderToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedOrderIds);
    if (idsToDelete.length === 0 || !currentUser?.email) return;

    try {
        await deleteBulkServiceOrders(idsToDelete, currentUser.email);
        toast({ title: "Eliminación Exitosa", description: `${idsToDelete.length} órdenes marcadas como eliminadas.`, className: "bg-green-100 dark:bg-green-950/30 dark:text-green-200 dark:border-green-700" });
        setSelectedOrderIds(new Set());
        fetchOrders();
    } catch (error) {
        toast({ title: "Error de Eliminación", description: "No se pudieron eliminar las órdenes.", variant: "destructive" });
    }
  };

  const handleDownloadExcel = async (order: StoredServiceOrder) => {
    setIsDownloadingId(order.id);
    try {
      if (!order.id) throw new Error("ID de orden no válido");
      
      const buffer = await generateServiceOrderExcel(order.data);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fileName = order.orderName
        .replace(/\s*—\s*/g, '_')
        .replace(/:/g, '_')
        .replace(/[\s/]/g, '_');

      link.download = `${fileName}.xlsx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      if (order.status !== 'excel' && order.status !== 'eliminado' && order.status !== 'cancelado') {
        await updateServiceOrder(order.id, 'excel');
        fetchOrders();
      }

    } catch(error) {
      toast({ title: "Error", description: "No se pudo generar el archivo Excel.", variant: "destructive" });
    } finally {
      setIsDownloadingId(null);
    }
  };
  
  const handlePrintToPdf = async (order: StoredServiceOrder) => {
    setIsPrintingPdfId(order.id);
    try {
      if (order.status !== 'impreso' && order.status !== 'eliminado' && order.status !== 'cancelado' && order.status !== 'enviado' && order.status !== 'excel') {
        await updateServiceOrder(order.id, 'impreso');
        fetchOrders();
      }
      const orderDataString = encodeURIComponent(JSON.stringify(order));
      const url = `/service-order-print?order=${orderDataString}`;
      window.open(url, '_blank');
    } catch (error) {
        toast({ title: "Error", description: "No se pudo generar el PDF.", variant: "destructive" });
    } finally {
        setIsPrintingPdfId(null); 
    }
  };

  const onSave = () => {
    setIsSheetOpen(false);
    setIntermediateOrderData(initialOrderDataState);
    fetchOrders(); 
  };
  
  const onSheetClose = () => {
    setIsSheetOpen(false);
  }

  const onClearAndNew = () => {
      setIntermediateOrderData(initialOrderDataState);
      setOrderToEdit(null);
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelectedIds = new Set<string>();
    if (checked) {
        paginatedFamilies.forEach(({parent, children}) => {
            if(parent.status !== 'eliminado' && parent.status !== 'cancelado') newSelectedIds.add(parent.id)
            children.forEach(child => {
                if(child.status !== 'eliminado' && child.status !== 'cancelado') newSelectedIds.add(child.id)
            })
        });
    }
    setSelectedOrderIds(newSelectedIds);
  };

  const handleSelectOne = (orderId: string, checked: boolean) => {
      setSelectedOrderIds(prev => {
          const newSet = new Set(prev);
          if (checked) newSet.add(orderId);
          else newSet.delete(orderId);
          return newSet;
      });
  };
  
  const toggleFamilyExpansion = (familyId: string) => {
    setExpandedFamilies(prev => {
        const newSet = new Set(prev);
        if (newSet.has(familyId)) {
            newSet.delete(familyId);
        } else {
            newSet.add(familyId);
        }
        return newSet;
    });
  };

  const getStatusBadge = (order: StoredServiceOrder, childCount = 0) => {
    const status = order.status || 'creado';
    let baseBadge: React.ReactNode;

    switch (status) {
        case 'eliminado': baseBadge = <Badge variant="destructive" className="flex items-center gap-1"><ShieldAlert className="h-3 w-3"/>Eliminado</Badge>; break;
        case 'cancelado': baseBadge = <Badge variant="destructive" className="bg-yellow-600 hover:bg-yellow-700">Cancelado</Badge>; break;
        case 'enviado': baseBadge = <Badge variant="default" className="bg-lime-600 hover:bg-lime-700">Enviado</Badge>; break;
        case 'impreso': baseBadge = <Badge variant="default" className="bg-red-500 hover:bg-red-600">PDF</Badge>; break;
        case 'excel': baseBadge = <Badge variant="default" className="bg-green-600 hover:bg-green-700">Excel</Badge>; break;
        case 'editado': baseBadge = <Badge variant="secondary" className="bg-orange-500 text-white hover:bg-orange-600">Editado</Badge>; break;
        default: baseBadge = <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">Creado</Badge>;
    }
    
    if (childCount > 0) {
        return <div className="flex items-center gap-1">{baseBadge}<Badge className="bg-purple-600 hover:bg-purple-700"><Split className="h-3 w-3 mr-1"/>Dividida</Badge></div>;
    }
    return baseBadge;
  };
  
  const getDeletionAlertDescription = () => {
    if (!orderToDelete) return "";
    const family = families.find(f => f.parent.id === orderToDelete.id);
    const childCount = family ? family.children.length : 0;
    
    let baseMessage = `La orden "${getBaseName(orderToDelete.orderName)}" será marcada como eliminada.`;
    if (childCount > 0) {
      baseMessage += ` Sus ${childCount} órdenes hijas también serán eliminadas.`;
    }
    baseMessage += " Los administradores podrán verla y recuperarla.";
    return baseMessage;
  };

  const numSelected = selectedOrderIds.size;
  const numInPage = paginatedFamilies.reduce((acc, {parent, children}) => {
      let count = (parent.status !== 'eliminado' && parent.status !== 'cancelado') ? 1 : 0;
      count += children.filter(c => c.status !== 'eliminado' && c.status !== 'cancelado').length;
      return acc + count;
  }, 0);
  const isAllSelected = numInPage > 0 && numSelected === numInPage;

  const renderOrderActions = (order: StoredServiceOrder) => {
    const canModify = isCurrentUserAdmin || currentUser?.email === order.createdBy;
    const isDeleted = order.status === 'eliminado' || order.status === 'cancelado';
    
    const simplePreviewButtonHtml = `<button title="Vista Previa Rápida" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-purple-600/50 bg-background hover:bg-purple-100/80 text-purple-600 hover:text-purple-700 dark:hover:bg-purple-900/20 dark:text-purple-400 dark:border-purple-600/70 h-8 w-8 p-0" onclick="window.showSimplePreviewModal(window.__serviceOrdersMap.get('${order.id}'), window.__handleStatusUpdate)"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></button>`;

    return (
        <div className="text-left space-x-1">
            <span dangerouslySetInnerHTML={{ __html: simplePreviewButtonHtml }} />
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => handlePreviewOrderClick(order)} className="text-primary border-primary/50 hover:bg-primary/10 hover:text-primary h-8 w-8 p-0"><Eye className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Vista Previa (WhatsApp)</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => handleEditOrderClick(order)} disabled={!canModify || isDeleted} className="text-indigo-600 border-indigo-600/50 hover:bg-indigo-100/80 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 h-8 w-8 p-0"><FilePenLine className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Editar</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => handleDownloadExcel(order)} disabled={isDownloadingId === order.id || isDeleted} className="text-green-600 border-green-600/50 hover:bg-green-100/80 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-50 h-8 w-8 p-0">{isDownloadingId === order.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileDown className="h-4 w-4"/>}</Button></TooltipTrigger><TooltipContent><p>Descargar Excel</p></TooltipContent></Tooltip>
            {isCurrentUserAdmin && (<Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => handlePrintToPdf(order)} disabled={isPrintingPdfId === order.id || isDeleted} className="text-red-600 border-red-600/50 hover:bg-red-100/80 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 h-8 w-8 p-0">{isPrintingPdfId === order.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Printer className="h-4 w-4"/>}</Button></TooltipTrigger><TooltipContent><p>Imprimir PDF</p></TooltipContent></Tooltip>)}
            {!isDeleted && (<AlertDialog>
                <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="destructive" size="sm" disabled={!canModify} onClick={() => setOrderToDelete(order)} className="h-8 w-8 p-0"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent><p>Eliminar Orden</p></TooltipContent></Tooltip>
                {orderToDelete && orderToDelete.id === order.id && (<AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>¿Estás seguro de eliminar esta orden?</AlertDialogTitle><AlertDialogDescription>{getDeletionAlertDescription()}</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel onClick={() => setOrderToDelete(null)}>Cerrar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteOrder} className="bg-destructive hover:bg-destructive/90">Sí, eliminar</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>)}
            </AlertDialog>)}
        </div>
    );
  };


  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  return (
    <TooltipProvider>
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8 bg-background space-y-6">
      <div className="w-full max-w-7xl flex justify-between items-center">
        <Button variant="default" size="icon" onClick={() => router.push('/')} aria-label="Go home">
            <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex gap-2">
            <Button onClick={handleAutomatedOrderClick} className="bg-green-600 hover:bg-green-700 text-white">
                <Bot className="mr-2 h-4 w-4" />
                Generar Orden Automatizada
            </Button>
            <Button onClick={handleNewOrderClick}>
                <FilePlus className="mr-2 h-4 w-4" />
                Nueva Orden de Servicio
            </Button>
        </div>
      </div>

       <Card className="w-full max-w-7xl shadow-lg">
          <CardHeader>
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <ListOrdered className="h-8 w-8 text-primary"/>
                    <CardTitle className="text-2xl font-headline text-primary">Órdenes de Servicio</CardTitle>
                </div>
                <div className="flex w-full sm:w-auto items-center gap-2">
                    {isCurrentUserAdmin && <ServiceOrderDeletionFilter value={filterState} onValueChange={setFilterState} />}
                    <div className="relative w-full sm:w-auto flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar orden..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 focus-visible:ring-2 focus-visible:ring-primary" />
                    </div>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
                {numSelected > 0 && filterState !== 'deleted' && (
                  <div className="p-2 bg-muted/50 flex justify-between items-center">
                    <span className="text-sm font-medium">{numSelected} seleccionado(s)</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                           <Trash2 className="mr-2 h-4 w-4" />
                           Eliminar Seleccionados
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
                          <AlertDialogDescription>
                            ¿Estás seguro de que quieres eliminar {numSelected} orden(es)? Esta acción las marcará como eliminadas.
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
                <Table>
                    <TableHeader>
                        <TableRow>
                            {isCurrentUserAdmin && <TableHead className="w-12"><Checkbox checked={isAllSelected} onCheckedChange={(checked) => handleSelectAll(!!checked)} aria-label="Seleccionar todas" disabled={filterState === 'deleted'} /></TableHead>}
                            <TableHead>Nombre de la Orden</TableHead>
                            <TableHead>Responsable(s)</TableHead>
                            <TableHead>Estado</TableHead>
                            {isCurrentUserAdmin && <TableHead>Creado Por</TableHead>}
                            {isCurrentUserAdmin && <TableHead className="w-[120px]">Fecha</TableHead>}
                            <TableHead className="text-left">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                       {paginatedFamilies.length > 0 ? paginatedFamilies.map(({ parent, children }) => {
                            const parentName = getBaseName(parent.orderName);
                            const childCount = children.length;
                            const isExpanded = expandedFamilies.has(parent.id);
                            
                            const allGuidsInFamily = new Set<string>();
                            const allDriversInFamily = new Set<string>();

                            if (parent.data && parent.data.services) {
                                parent.data.services.forEach(service => {
                                    if(service.guia) allGuidsInFamily.add(service.guia);
                                    if(service.chofer) allDriversInFamily.add(service.chofer);
                                });
                                if (parent.data.guia) allGuidsInFamily.add(parent.data.guia);
                            }
                            
                            const displayedGuides = Array.from(allGuidsInFamily).filter(Boolean);
                            const displayedDrivers = Array.from(allDriversInFamily).filter(Boolean);

                            return (
                                <React.Fragment key={parent.id}>
                                    <TableRow>
                                        {isCurrentUserAdmin && (
                                            <TableCell><Checkbox checked={selectedOrderIds.has(parent.id)} onCheckedChange={(c) => handleSelectOne(parent.id, !!c)} aria-label={`Seleccionar ${parentName}`} disabled={parent.status === 'eliminado' || parent.status === 'cancelado'} /></TableCell>
                                        )}
                                        <TableCell className="font-semibold">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleFamilyExpansion(parent.id)}
                                                    disabled={childCount === 0}
                                                    className="flex items-center gap-1 text-left hover:underline p-0 bg-transparent border-none disabled:cursor-default disabled:no-underline"
                                                >
                                                    <span>{parentName}</span>
                                                    {childCount > 0 && <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isExpanded && "rotate-180")} />}
                                                </button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {displayedGuides.map(g => <Badge key={g} className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 hover:bg-blue-100"><User size={12} className="mr-1"/>{shortPerson(g)}</Badge>)}
                                                {displayedDrivers.map(d => <Badge key={d} className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 hover:bg-green-100"><Car size={12} className="mr-1"/>{shortPerson(d)}</Badge>)}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(parent, childCount)}</TableCell>
                                        {isCurrentUserAdmin && <TableCell>{parent.createdBy}</TableCell>}
                                        {isCurrentUserAdmin && <TableCell>{format(parent.createdAt, 'dd/MM/yyyy', { locale: es })}</TableCell>}
                                        <TableCell>{renderOrderActions(parent)}</TableCell>
                                    </TableRow>

                                    {isExpanded && children.map(child => {
                                        const isDriverPerspective = child.orderName.includes(" — C-");
                                        const isGuidePerspective = child.orderName.includes(" — G-");
                                        return (
                                            <TableRow key={child.id} className="bg-muted/30 hover:bg-muted/50">
                                                {isCurrentUserAdmin && <TableCell><Checkbox checked={selectedOrderIds.has(child.id)} onCheckedChange={(c) => handleSelectOne(child.id, !!c)} disabled={child.status === 'eliminado' || child.status === 'cancelado'} /></TableCell>}
                                                <TableCell className="pl-12">
                                                    <div className="text-sm">
                                                        <span className="font-medium">{child.orderName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        {isGuidePerspective && child.data.guia && <Badge className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 hover:bg-blue-100"><User size={12} className="mr-1"/>{shortPerson(child.data.guia)}</Badge>}
                                                        {isDriverPerspective && Array.from(new Set(child.data.services?.map(s => s.chofer).filter(Boolean))).map(c => 
                                                          <Badge key={c} className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 hover:bg-green-100"><Car size={12} className="mr-1"/>{shortPerson(c as string)}</Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getStatusBadge(child)}</TableCell>
                                                {isCurrentUserAdmin && <TableCell>{child.createdBy}</TableCell>}
                                                {isCurrentUserAdmin && <TableCell>{format(child.createdAt, 'dd/MM/yyyy', { locale: es })}</TableCell>}
                                                <TableCell>{renderOrderActions(child)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </React.Fragment>
                            )
                        }) : (
                          <TableRow><TableCell colSpan={isCurrentUserAdmin ? 7 : 5} className="text-center h-24 text-muted-foreground">{searchTerm ? `No se encontraron órdenes para "${searchTerm}"` : "No se han encontrado órdenes de servicio."}</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Anterior</Button>
                    <span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Siguiente</Button>
                </div>
            )}
          </CardContent>
        </Card>

        {isEditModalOpen && orderToEdit && (
          <ServiceOrderEditModal
            order={orderToEdit} guides={guides} activities={activities} drivers={drivers} flights={flights} hotels={hotels} buses={buses}
            onSave={handleSaveFromEditModal}
            onClose={() => { setIsEditModalOpen(false); setOrderToEdit(null); }}
          />
        )}
        
        {isPreviewModalOpen && orderToPreview && (
          <ServiceOrderPreviewModal
            order={orderToPreview}
            onClose={() => { setIsPreviewModalOpen(false); setOrderToPreview(null); }}
            onStatusUpdate={handleStatusUpdate}
          />
        )}

        <ServiceOrderGeneratorSheet 
            isOpen={isSheetOpen}
            onClose={onSheetClose}
            onSave={onSave}
            orderData={intermediateOrderData}
            setOrderData={setIntermediateOrderData}
            onClearAndNew={onClearAndNew}
            isAutomatedMode={isAutomatedMode}
            guides={guides}
            activities={activities}
            drivers={drivers}
            flights={flights}
            hotels={hotels}
            buses={buses}
        />
    </div>
    </TooltipProvider>
  );
}

    