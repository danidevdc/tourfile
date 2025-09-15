
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
} from '@/lib/serviceOrderStorage';
import { generateServiceOrderExcel, type ServiceOrderData } from '@/lib/serviceOrderGenerator';
import { getBaseName, getFamilyId, childNameFrom, shortPerson } from "@/lib/serviceOrderFamily";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Trash2, FilePlus, ListOrdered, Eye, Printer, Search, FilePenLine, Bot, ShieldAlert, FileDown, ChevronDown, Image } from "lucide-react";
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

  const filteredOrders = useMemo(() => {
    let statusFilteredOrders = orders;
    
    const currentFilterState = isCurrentUserAdmin ? filterState : 'active';
    if (currentFilterState === 'active') {
        statusFilteredOrders = orders.filter(order => order.status !== 'eliminado');
    } else if (currentFilterState === 'deleted') {
        statusFilteredOrders = orders.filter(order => order.status === 'eliminado');
    }

    if (!searchTerm) {
        return statusFilteredOrders;
    }

    const lowercasedFilter = searchTerm.toLowerCase();
    return statusFilteredOrders.filter(order => {
        const date = format(order.createdAt, 'dd/MM/yyyy', { locale: es });
        return (
            order.orderName.replace(/_/g, ' ').toLowerCase().includes(lowercasedFilter) ||
            order.data.guia.toLowerCase().includes(lowercasedFilter) ||
            (isCurrentUserAdmin && order.createdBy && order.createdBy.toLowerCase().includes(lowercasedFilter)) ||
            (isCurrentUserAdmin && date.toLowerCase().includes(lowercasedFilter))
        );
    });
  }, [searchTerm, orders, isCurrentUserAdmin, filterState]);

  const families = useMemo(() => {
    const byId = new Map<string, StoredServiceOrder>();
    orders.forEach(o => byId.set(o.id, o));
  
    const groups = new Map<string, { parent: StoredServiceOrder, children: StoredServiceOrder[] }>();
  
    for (const o of filteredOrders) {
      if (o.data.isSplitParent) continue;
      
      const famId = getFamilyId(o);
      const parent = o.splitFrom ? byId.get(o.splitFrom) : o;

      if (!parent) continue;

      const parentKey = parent.id;
  
      if (!groups.has(parentKey)) {
        groups.set(parentKey, { parent, children: [] });
      }
      if (o.id !== parentKey) {
        groups.get(parentKey)!.children.push(o);
      }
    }
  
    return Array.from(groups.values())
      .sort((a, b) => b.parent.createdAt.getTime() - a.parent.createdAt.getTime())
      .map(g => ({ 
        ...g, 
        children: g.children.sort((x, y) => x.orderName.localeCompare(y.orderName)) 
      }));
  }, [filteredOrders, orders]);
  
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

  const handlePreviewOrderClick = (order: StoredServiceOrder) => {
    const family = families.find(f => f.parent.id === order.id);
    if (family && family.children.length > 0) {
        const allServices = family.children.flatMap(child => child.data.services);
        setOrderToPreview({ ...order, data: { ...order.data, services: allServices } });
    } else {
        setOrderToPreview(order);
    }
    setIsPreviewModalOpen(true);
  };
  
 const handleSaveFromEditModal = async (updatedOrderData: ServiceOrderData) => {
    if (!orderToEdit || !currentUser?.email) return;

    const uniqueGuides = new Set(updatedOrderData.services.map(s => s.guia || updatedOrderData.guia).filter(Boolean));
    const uniqueDrivers = new Set(updatedOrderData.services.map(s => s.chofer).filter(Boolean));

    const needsGuideSplit = uniqueGuides.size > 1;
    const needsDriverSplit = !needsGuideSplit && uniqueDrivers.size > 1;
    
    if (needsGuideSplit || needsDriverSplit) {
        const splitDimension = needsGuideSplit ? 'guide' : 'driver';
        const serviceMap = new Map<string, ServiceOrderData['services']>();
        
        updatedOrderData.services.forEach(service => {
            const key = splitDimension === 'guide' ? (service.guia || updatedOrderData.guia) : service.chofer!;
            if (!serviceMap.has(key)) {
                serviceMap.set(key, []);
            }
            serviceMap.get(key)!.push(service);
        });

        if (serviceMap.size > 1) {
            try {
                await updateServiceOrder(orderToEdit.id, { ...updatedOrderData, services: updatedOrderData.services, isSplitParent: true }, 'editado');
                
                const parentBaseName = getBaseName(orderToEdit.orderName);

                for (const [key, services] of serviceMap.entries()) {
                    const newSplitOrderData: ServiceOrderData = { ...updatedOrderData, services, isSplitParent: false };
                    
                    if(splitDimension === 'guide') {
                      newSplitOrderData.guia = key;
                    }
                    
                    const childOrderName = childNameFrom(parentBaseName, { ...orderToEdit, data: newSplitOrderData });
                    await saveServiceOrder(newSplitOrderData, currentUser.email, childOrderName, orderToEdit.id);
                }
                
                toast({ title: "Éxito", description: `La orden ha sido dividida en ${serviceMap.size} nuevas órdenes.`, className: "bg-green-100 dark:bg-green-900 border-green-500" });
                fetchOrders();
            } catch (e) {
                 toast({ title: "Error al Dividir", description: "No se pudo dividir la orden.", variant: "destructive" });
            } finally {
                setIsEditModalOpen(false);
                setOrderToEdit(null);
            }
            return;
        }
    }
    
    try {
      await updateServiceOrder(orderToEdit.id, updatedOrderData, 'editado');
      toast({ title: "Éxito", description: "Orden actualizada correctamente.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
      fetchOrders(); 
    } catch(e) {
      toast({ title: "Error", description: "No se pudo actualizar la orden.", variant: "destructive" });
    } finally {
      setIsEditModalOpen(false);
      setOrderToEdit(null);
    }
  };


  const handleDeleteOrder = async () => {
    if(!orderToDelete || !orderToDelete.id || !currentUser?.email) return;

    // Find the family to get all IDs to delete
    const family = families.find(f => f.parent.id === orderToDelete.id || f.children.some(c => c.id === orderToDelete.id));
    let idsToDelete: string[] = [orderToDelete.id];

    // If deleting a parent, include all its children
    if (family && family.parent.id === orderToDelete.id) {
        idsToDelete = [orderToDelete.id, ...family.children.map(c => c.id)];
    }
    
    try {
        await deleteBulkServiceOrders(idsToDelete, currentUser.email);
        toast({ title: "Éxito", description: `${idsToDelete.length} orden(es) marcada(s) como eliminada(s).`, className: "bg-green-100 dark:bg-green-900 border-green-500" });
        fetchOrders();
    } catch (error) {
        toast({ title: "Error", description: "No se pudieron eliminar las órdenes.", variant: "destructive"});
    } finally {
        setOrderToDelete(null);
    }
  }

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedOrderIds);
    if (idsToDelete.length === 0 || !currentUser?.email) return;

    try {
        await deleteBulkServiceOrders(idsToDelete, currentUser.email);
        toast({ title: "Eliminación Exitosa", description: `${idsToDelete.length} órdenes marcadas como eliminadas.`, className: "bg-green-100 dark:bg-green-900 border-green-500" });
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
      
      if (order.status !== 'excel' && order.status !== 'eliminado') {
        await updateServiceOrder(order.id, order.data, 'excel');
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
      if (order.status !== 'enviado' && order.status !== 'eliminado') {
        await updateServiceOrder(order.id, order.data, 'enviado');
        fetchOrders();
      }
      const orderDataString = encodeURIComponent(JSON.stringify(order));
      const url = `/service-order-print?order=${orderDataString}`;
      window.open(url, '_blank', 'popup=yes,width=1123,height=794');
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
            if(parent.status !== 'eliminado') newSelectedIds.add(parent.id)
            children.forEach(child => {
                if(child.status !== 'eliminado') newSelectedIds.add(child.id)
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

  const getStatusBadge = (order: StoredServiceOrder) => {
    const status = order.status || 'creado';
    switch (status) {
        case 'eliminado':
            return <Badge variant="destructive" className="flex items-center gap-1"><ShieldAlert className="h-3 w-3"/>Eliminado</Badge>;
        case 'enviado':
            return <Badge variant="default" className="bg-red-500 hover:bg-red-600">PDF</Badge>;
        case 'excel':
            return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Excel</Badge>;
        case 'editado':
            return <Badge variant="secondary" className="bg-orange-500 text-white hover:bg-orange-600">Editado</Badge>;
        default: // creado
            return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">Creado</Badge>;
    }
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
      let count = parent.status !== 'eliminado' ? 1 : 0;
      count += children.filter(c => c.status !== 'eliminado').length;
      return acc + count;
  }, 0);
  const isAllSelected = numInPage > 0 && numSelected === numInPage;

  const renderOrderActions = (order: StoredServiceOrder) => {
    const canModify = isCurrentUserAdmin || currentUser?.email === order.createdBy;
    const isDeleted = order.status === 'eliminado';
    return (
        <div className="text-left space-x-1">
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => handlePreviewOrderClick(order)} className="text-purple-600 border-purple-600/50 hover:bg-purple-100/80 hover:text-purple-700 h-8 w-8 p-0"><Image className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Vista Previa de Imagen (Beta)</p></TooltipContent></Tooltip>
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
                        <Input placeholder="Buscar orden..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
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
                            <TableHead>Guía Asignado</TableHead>
                            {isCurrentUserAdmin && (<><TableHead>Creado Por</TableHead><TableHead className="w-[120px]">Fecha</TableHead><TableHead>Estado</TableHead></>)}
                            <TableHead className="text-left">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                       {paginatedFamilies.length > 0 ? paginatedFamilies.map(({ parent, children }) => {
                            const baseName = getBaseName(parent.orderName);
                            const childCount = children.length;
                            const isExpanded = expandedFamilies.has(parent.id);
                            
                            let displayedGuide = parent.data.guia;
                            if (childCount > 0) {
                                const childGuides = [...new Set(children.map(c => c.data.guia || ''))].filter(Boolean);
                                if (childGuides.length > 0) {
                                    displayedGuide = childGuides.join(', ');
                                }
                            }

                            return (
                                <React.Fragment key={parent.id}>
                                    <TableRow>
                                        {isCurrentUserAdmin && (
                                            <TableCell><Checkbox checked={selectedOrderIds.has(parent.id)} onCheckedChange={(c) => handleSelectOne(parent.id, !!c)} aria-label={`Seleccionar ${baseName}`} disabled={parent.status === 'eliminado'} /></TableCell>
                                        )}
                                        <TableCell className="font-semibold">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleFamilyExpansion(parent.id)}
                                                    disabled={childCount === 0}
                                                    className="flex items-center gap-1 text-left hover:underline p-0 bg-transparent border-none disabled:cursor-default disabled:no-underline"
                                                >
                                                    <span>{baseName}</span>
                                                    {childCount > 0 && <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isExpanded && "rotate-180")} />}
                                                </button>
                                                {childCount > 0 && <Badge variant="secondary">{childCount}</Badge>}
                                                {parent.data.isSplitParent && <Badge className="bg-purple-600 hover:bg-purple-700">Dividida</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell>{displayedGuide}</TableCell>
                                        {isCurrentUserAdmin && (<><TableCell>{parent.createdBy}</TableCell><TableCell>{format(parent.createdAt, 'dd/MM/yyyy', { locale: es })}</TableCell><TableCell>{getStatusBadge(parent)}</TableCell></>)}
                                        <TableCell>{renderOrderActions(parent)}</TableCell>
                                    </TableRow>

                                    {isExpanded && children.map(child => (
                                        <TableRow key={child.id} className="bg-muted/30 hover:bg-muted/50">
                                            {isCurrentUserAdmin && <TableCell><Checkbox checked={selectedOrderIds.has(child.id)} onCheckedChange={(c) => handleSelectOne(child.id, !!c)} disabled={child.status === 'eliminado'} /></TableCell>}
                                            <TableCell className="pl-12">
                                                <div className="text-sm">
                                                    <span className="text-muted-foreground">{baseName} › </span>
                                                    <span className="font-medium">{childNameFrom(baseName, child).replace(`${baseName} — `, "")}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{child.data.guia || shortPerson(child.data.services[0]?.chofer)}</TableCell>
                                            {isCurrentUserAdmin && (<><TableCell>{child.createdBy}</TableCell><TableCell>{format(child.createdAt, 'dd/MM/yyyy', { locale: es })}</TableCell><TableCell>{getStatusBadge(child)}</TableCell></>)}
                                            <TableCell>{renderOrderActions(child)}</TableCell>
                                        </TableRow>
                                    ))}
                                </React.Fragment>
                            )
                        }) : (
                          <TableRow><TableCell colSpan={isCurrentUserAdmin ? 7 : 4} className="text-center h-24 text-muted-foreground">{searchTerm ? `No se encontraron órdenes para "${searchTerm}"` : "No se han encontrado órdenes de servicio."}</TableCell></TableRow>
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
          <ServiceOrderPreviewModal order={orderToPreview} onClose={() => { setIsPreviewModalOpen(false); setOrderToPreview(null); }} />
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
