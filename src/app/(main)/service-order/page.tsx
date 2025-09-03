
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";

import { getAllServiceOrders, deleteServiceOrder, updateServiceOrder, type StoredServiceOrder, saveServiceOrder, type OrderStatus } from '@/lib/serviceOrderStorage';
import { generateServiceOrderExcel, type ServiceOrderData } from '@/lib/serviceOrderGenerator';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Trash2, FilePlus, ListOrdered, Eye, Printer, Search, FilePenLine } from "lucide-react";
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
import { getGuidesFromFirestore, getDriversFromFirestore, getHotelsFromFirestore, getActivitiesFromFirestore, getFlightsFromFirestore, type ServiceOrderGuide, type Driver, type Hotel, type Activity, type PredefinedFlight } from "@/lib/serviceOrderService";


const defaultObsText = 'LA CAJA CHICA CUBRE 1 BOTELLA DE AGUA POR DÍA PARA CADA PAX, GUÍA Y CHOFER. NO INCLUYE TRANSFERS NI SERVICIOS EN EL LAGO.';
const defaultNotaText = 'TODOS LOS GUÍAS DEBEN ENVIAR UN INFORME DIARIO POR WHATSAPP A LA SEÑORA JUDITH SOBRE LOS SERVICIOS REALIZADOS.\nGUIA DEBE PRESENTAR COPIA DE PASAPORTE DE PAX DESPUES DE CADA SERVICIO JUNTO A SU LIQUIDACION Y CAJA CHICA';

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

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  
  const [orderToEdit, setOrderToEdit] = useState<StoredServiceOrder | null>(null);
  const [orderToPreview, setOrderToPreview] = useState<StoredServiceOrder | null>(null);
  
  const [intermediateOrderData, setIntermediateOrderData] = useState<ServiceOrderData>(initialOrderDataState);

  const [orderToDelete, setOrderToDelete] = useState<StoredServiceOrder | null>(null);
  const [isPrintingPdfId, setIsPrintingPdfId] = useState<string | null>(null);


  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const [fetchedOrders, fetchedGuides, fetchedDrivers, fetchedHotels, fetchedActivities, fetchedFlights] = await Promise.all([
        getAllServiceOrders(),
        getGuidesFromFirestore(),
        getDriversFromFirestore(),
        getHotelsFromFirestore(),
        getActivitiesFromFirestore(),
        getFlightsFromFirestore(),
      ]);
      setOrders(fetchedOrders);
      setGuides(fetchedGuides);
      setDrivers(fetchedDrivers);
      setHotels(fetchedHotels);
      setActivities(fetchedActivities);
      setFlights(fetchedFlights);
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
    const visibleOrders = isCurrentUserAdmin 
      ? orders
      : orders.filter(order => order.status !== 'eliminado');

    if (!searchTerm) return visibleOrders;

    const lowercasedFilter = searchTerm.toLowerCase();
    return visibleOrders.filter(order => {
        const date = format(order.createdAt, 'dd/MM/yyyy', { locale: es });
        return (
            order.orderName.replace(/_/g, ' ').toLowerCase().includes(lowercasedFilter) ||
            order.data.guia.toLowerCase().includes(lowercasedFilter) ||
            order.createdBy.toLowerCase().includes(lowercasedFilter) ||
            date.toLowerCase().includes(lowercasedFilter)
        );
    });
  }, [searchTerm, orders, isCurrentUserAdmin]);
  
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);


  const handleNewOrderClick = () => {
    // Do not reset the data here, allowing the sheet to open with the last state.
    // The data is reset on save or explicit clear.
    setIsSheetOpen(true);
  };

  const handleEditOrderClick = (order: StoredServiceOrder) => {
    setOrderToEdit(order);
    setIsEditModalOpen(true);
  };

  const handlePreviewOrderClick = (order: StoredServiceOrder) => {
    setOrderToPreview(order);
    setIsPreviewModalOpen(true);
  }
  
 const handleSaveFromEditModal = async (updatedOrderData: ServiceOrderData, isSplitOrder: boolean) => {
    if (!orderToEdit || !currentUser?.email) return;

    // --- SPLIT LOGIC ---
    if (isSplitOrder) {
        const servicesByGuide = new Map<string, ServiceOrderData['services']>();
        updatedOrderData.services.forEach(service => {
            const guideName = service.guia || updatedOrderData.guia;
            if (!guideName) return; 
            if (!servicesByGuide.has(guideName)) {
                servicesByGuide.set(guideName, []);
            }
            servicesByGuide.get(guideName)!.push(service);
        });

        const assignedGuides = Array.from(servicesByGuide.keys());

        if (assignedGuides.length > 1) {
            try {
                // 1. Update the original order to become the "master" order, listing all guides.
                const masterOrderData = { ...updatedOrderData, guia: assignedGuides.join(', ') };
                await updateServiceOrder(orderToEdit.id, masterOrderData, 'editado');

                // 2. Create new child orders for each guide, using the master order's name as a base.
                for (const [guideName, guideServices] of servicesByGuide.entries()) {
                    const newSplitOrderData: ServiceOrderData = {
                        ...updatedOrderData,
                        guia: guideName, 
                        services: guideServices,
                    };
                    // Pass the original order name to create the correct child name.
                    await saveServiceOrder(newSplitOrderData, currentUser.email, orderToEdit.orderName);
                }
                toast({ title: "Éxito", description: `La orden ha sido dividida en ${servicesByGuide.size} nuevas órdenes.`, className: "bg-green-100 dark:bg-green-900 border-green-500" });
                fetchOrders();
            } catch (e) {
                 toast({ title: "Error al Dividir", description: "No se pudo dividir la orden.", variant: "destructive" });
            } finally {
                setIsEditModalOpen(false);
                setOrderToEdit(null);
            }
            return; // End execution here for split logic
        }
    }
    
    // --- REGULAR UPDATE LOGIC ---
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
    if(!orderToDelete || !orderToDelete.id) return;
    try {
      // This now performs a soft delete by setting status to 'eliminado'
      await deleteServiceOrder(orderToDelete.id);
      toast({ title: "Éxito", description: "Orden de servicio eliminada.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
      fetchOrders();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la orden.", variant: "destructive"});
    } finally {
      setOrderToDelete(null);
    }
  }
  
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

  const onSheetSave = () => {
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
  
  const getStatusBadge = (order: StoredServiceOrder) => {
    const status = order.status || 'creado';

    switch (status) {
        case 'eliminado':
            return <Badge variant="destructive">Eliminado</Badge>;
        case 'enviado':
            return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Enviado</Badge>;
        case 'editado':
            return <Badge variant="secondary" className="bg-orange-500 text-white hover:bg-orange-600">Editado</Badge>;
        default: // creado
            return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Creado</Badge>;
    }
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
        <Button onClick={handleNewOrderClick}>
            <FilePlus className="mr-2 h-4 w-4" />
            Nueva Orden de Servicio
        </Button>
      </div>

       <Card className="w-full max-w-7xl shadow-lg">
          <CardHeader>
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <ListOrdered className="h-8 w-8 text-primary"/>
                    <CardTitle className="text-2xl font-headline text-primary">Órdenes de Servicio</CardTitle>
                </div>
                <div className="relative w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                    placeholder="Buscar orden..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    />
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[30%] border-r">Nombre de la Orden</TableHead>
                            <TableHead className="w-[18%] border-r">Guía Asignado</TableHead>
                            <TableHead className="w-[15%] border-r">Creado Por</TableHead>
                            <TableHead className="w-[10%] border-r">Fecha de Creación</TableHead>
                            <TableHead className="w-[10%] border-r">Estado</TableHead>
                            <TableHead className="text-left w-[17%]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedOrders.length > 0 ? (
                            paginatedOrders.map((order) => {
                                const isDeleted = order.status === 'eliminado';
                                const canModify = isCurrentUserAdmin || currentUser?.email === order.createdBy;

                                return (
                                    <TableRow key={order.id} className={cn(isDeleted && "bg-destructive/10 text-muted-foreground")}>
                                        <TableCell className="font-medium border-r">{order.orderName.replace(/_/g, ' ')}</TableCell>
                                        <TableCell className="border-r">{order.data.guia}</TableCell>
                                        <TableCell className="border-r">{order.createdBy}</TableCell>
                                        <TableCell className="border-r">{format(order.createdAt, 'dd/MM/yyyy', { locale: es })}</TableCell>
                                        <TableCell className="border-r">{getStatusBadge(order)}</TableCell>
                                        <TableCell className="text-left space-x-1">
                                            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => handlePreviewOrderClick(order)} className="text-primary border-primary/50 hover:bg-primary/10 hover:text-primary"><Eye className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Vista Previa</p></TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => handleEditOrderClick(order)} disabled={isDeleted || !canModify} className="text-indigo-600 border-indigo-600/50 hover:bg-indigo-100/80 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><FilePenLine className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Editar</p></TooltipContent></Tooltip>
                                            
                                            <Tooltip><TooltipTrigger asChild>
                                               <Button 
                                                  variant="outline"
                                                  size="icon" 
                                                  onClick={() => handlePrintToPdf(order)}
                                                  disabled={isPrintingPdfId === order.id || isDeleted}
                                                  className="text-red-600 border-red-600/50 hover:bg-red-100/80 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                  {isPrintingPdfId === order.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Printer className="h-4 w-4"/>}
                                               </Button>
                                            </TooltipTrigger><TooltipContent><p>Imprimir PDF</p></TooltipContent></Tooltip>
                                            
                                            <AlertDialog>
                                                <Tooltip><TooltipTrigger asChild>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="icon" disabled={isDeleted || !canModify} onClick={() => setOrderToDelete(order)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                </TooltipTrigger><TooltipContent><p>Eliminar Orden</p></TooltipContent></Tooltip>
                                                
                                                {orderToDelete && orderToDelete.id === order.id && (
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Se eliminará la orden "{orderToDelete.orderName.replace(/_/g, ' ')}". El registro será ocultado pero permanecerá visible para los administradores.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel onClick={() => setOrderToDelete(null)}>Cerrar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={handleDeleteOrder} className="bg-destructive hover:bg-destructive/90">
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
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                    {searchTerm ? `No se encontraron órdenes para "${searchTerm}"` : "No se han encontrado órdenes de servicio."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Página {currentPage} de {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        Siguiente
                    </Button>
                </div>
            )}
          </CardContent>
        </Card>

        {isEditModalOpen && orderToEdit && (
          <ServiceOrderEditModal
            order={orderToEdit}
            guides={guides}
            activities={activities}
            drivers={drivers}
            flights={flights}
            onSave={handleSaveFromEditModal}
            onClose={() => {
              setIsEditModalOpen(false);
              setOrderToEdit(null);
            }}
          />
        )}
        
        {isPreviewModalOpen && orderToPreview && (
          <ServiceOrderPreviewModal
            order={orderToPreview}
            onClose={() => {
              setIsPreviewModalOpen(false);
              setOrderToPreview(null);
            }}
          />
        )}

        <ServiceOrderGeneratorSheet 
            isOpen={isSheetOpen}
            onClose={onSheetClose}
            onSave={onSheetSave}
            orderData={intermediateOrderData}
            setOrderData={setIntermediateOrderData}
            onClearAndNew={onClearAndNew}
        />
    </div>
    </TooltipProvider>
  );
}
