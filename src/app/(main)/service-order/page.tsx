"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

import { getAllServiceOrders, deleteServiceOrder, updateServiceOrder, type StoredServiceOrder } from '@/lib/serviceOrderStorage';
import { generateServiceOrderExcel, type ServiceOrderData } from '@/lib/serviceOrderGenerator';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, FileDown, Trash2, FilePlus, ListOrdered, Eye, Printer, Search, FilePenLine } from "lucide-react";
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
import { getGuidesFromFirestore, getDriversFromFirestore, getHotelsFromFirestore, getActivitiesFromFirestore, type ServiceOrderGuide, type Driver, type Hotel, type Activity } from "@/lib/serviceOrderService";


const defaultObsText = 'LA CAJA CHICA CUBRE 1 BOTELLA DE AGUA POR DÍA PARA CADA PAX, GUÍA Y CHOFER. NO INCLUYE TRANSFERS NI SERVICIOS EN EL LAGO.';
const defaultNotaText = 'TODOS LOS GUÍAS DEBEN ENVIAR UN INFORME DIARIO POR WHATSAPP A LA SEÑORA JUDITH SOBRE LOS SERVICIOS REALIZADOS.\nGUIA DEBE PRESENTAR COPIA DE PASAPORTE DE PAX DESPUES DE CADA SERVICIO JUNTO A SU LIQUIDACION Y CAJA CHICA';

const initialOrderDataState: ServiceOrderData = {
    guia: '', file: '', ref: '', nPax: '', hotel: '', services: [],
    observations: defaultObsText, nota: defaultNotaText
};

const ITEMS_PER_PAGE = 10;

export default function ServiceOrderListPage() {
  const router = useRouter();
  const { isLoading: authLoading, isCurrentUserAdmin } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<StoredServiceOrder[]>([]);
  const [guides, setGuides] = useState<ServiceOrderGuide[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  
  const [orderToEditInSheet, setOrderToEditInSheet] = useState<StoredServiceOrder | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<StoredServiceOrder | null>(null);
  const [orderToPreview, setOrderToPreview] = useState<StoredServiceOrder | null>(null);
  
  const [intermediateOrderData, setIntermediateOrderData] = useState<ServiceOrderData>(initialOrderDataState);

  const [orderToDelete, setOrderToDelete] = useState<StoredServiceOrder | null>(null);
  const [isDownloadingId, setIsDownloadingId] = useState<string | null>(null);
  const [isPrintingPdfId, setIsPrintingPdfId] = useState<string | null>(null);


  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const [fetchedOrders, fetchedGuides, fetchedDrivers, fetchedHotels, fetchedActivities] = await Promise.all([
        getAllServiceOrders(),
        getGuidesFromFirestore(),
        getDriversFromFirestore(),
        getHotelsFromFirestore(),
        getActivitiesFromFirestore(),
      ]);
      setOrders(fetchedOrders);
      setGuides(fetchedGuides);
      setDrivers(fetchedDrivers);
      setHotels(fetchedHotels);
      setActivities(fetchedActivities);
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
    if (!searchTerm) return orders;
    const lowercasedFilter = searchTerm.toLowerCase();
    return orders.filter(order => {
        const date = format(order.createdAt, 'dd/MM/yyyy', { locale: es });
        return (
            order.orderName.toLowerCase().includes(lowercasedFilter) ||
            order.data.guia.toLowerCase().includes(lowercasedFilter) ||
            order.createdBy.toLowerCase().includes(lowercasedFilter) ||
            date.toLowerCase().includes(lowercasedFilter)
        );
    });
  }, [searchTerm, orders]);
  
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);


  const handleNewOrderClick = () => {
    setOrderToEditInSheet(null);
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
  
  const handleSaveFromEditModal = async (updatedOrderData: ServiceOrderData) => {
    if (!orderToEdit) return;
    
    try {
      await updateServiceOrder(orderToEdit.id, updatedOrderData);
      toast({ title: "Éxito", description: "Orden actualizada correctamente.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
      fetchOrders(); // Refresh list
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
      await deleteServiceOrder(orderToDelete.id);
      toast({ title: "Éxito", description: "Orden de servicio eliminada.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
      fetchOrders(); // Refresh list
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la orden.", variant: "destructive"});
    } finally {
      setOrderToDelete(null);
    }
  }

  const handleDownloadExcel = async (order: StoredServiceOrder) => {
    setIsDownloadingId(order.id);
    try {
      if (!order.id) throw new Error("ID de orden no válido");
      
      const buffer = await generateServiceOrderExcel(order.data);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${order.orderName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch(error) {
      toast({ title: "Error", description: "No se pudo generar el archivo Excel.", variant: "destructive" });
    } finally {
      setIsDownloadingId(null);
    }
  };

  const handlePrintToPdf = (order: StoredServiceOrder) => {
    setIsPrintingPdfId(order.id);
    const orderDataString = encodeURIComponent(JSON.stringify(order));
    const url = `/service-order-print?order=${orderDataString}`;
    window.open(url, '_blank', 'popup=yes,width=1123,height=794');
    setIsPrintingPdfId(null); // Reset state immediately after opening
  };

  const onSheetSave = () => {
    setIsSheetOpen(false);
    setOrderToEditInSheet(null);
    setIntermediateOrderData(initialOrderDataState);
    fetchOrders(); 
  };
  
  const onSheetClose = () => {
    setIsSheetOpen(false);
  }

  const onSheetClearAndNew = () => {
      setIntermediateOrderData(initialOrderDataState);
      setOrderToEditInSheet(null);
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
        {isCurrentUserAdmin && (
          <Button onClick={handleNewOrderClick}>
              <FilePlus className="mr-2 h-4 w-4" />
              Nueva Orden de Servicio
          </Button>
        )}
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
                            <TableHead className="w-[26%] border-r">Nombre de la Orden</TableHead>
                            <TableHead className="w-[25%] border-r">Guía Asignado</TableHead>
                            <TableHead className="w-[15%] border-r">Creado Por</TableHead>
                            <TableHead className="w-[10%] border-r">Fecha de Creación</TableHead>
                            <TableHead className="text-right w-[24%]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedOrders.length > 0 ? (
                            paginatedOrders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium border-r">{order.orderName}</TableCell>
                                    <TableCell className="border-r">{order.data.guia}</TableCell>
                                    <TableCell className="border-r">{order.createdBy}</TableCell>
                                    <TableCell className="border-r">{format(order.createdAt, 'dd/MM/yyyy', { locale: es })}</TableCell>
                                    <TableCell className="text-right space-x-1">
                                        <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => handlePreviewOrderClick(order)} className="text-primary border-primary/50 hover:bg-primary/10 hover:text-primary"><Eye className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Vista Previa</p></TooltipContent></Tooltip>
                                        <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => handleEditOrderClick(order)} className="text-indigo-600 border-indigo-600/50 hover:bg-indigo-100/80 hover:text-indigo-700"><FilePenLine className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Editar</p></TooltipContent></Tooltip>
                                        
                                        <Tooltip><TooltipTrigger asChild>
                                           <Button 
                                              variant="outline"
                                              size="icon" 
                                              onClick={() => handlePrintToPdf(order)}
                                              disabled={isPrintingPdfId === order.id}
                                              className="text-red-600 border-red-600/50 hover:bg-red-100/80 hover:text-red-700"
                                            >
                                              {isPrintingPdfId === order.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Printer className="h-4 w-4"/>}
                                           </Button>
                                        </TooltipTrigger><TooltipContent><p>Imprimir PDF</p></TooltipContent></Tooltip>

                                        <Tooltip><TooltipTrigger asChild>
                                           <Button 
                                              variant="outline" 
                                              size="icon"
                                              onClick={() => handleDownloadExcel(order)} 
                                              disabled={isDownloadingId === order.id}
                                              className="text-green-600 border-green-600/50 hover:bg-green-100/80 hover:text-green-700 hidden"
                                            >
                                                {isDownloadingId === order.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileDown className="h-4 w-4"/>}
                                            </Button>
                                        </TooltipTrigger><TooltipContent><p>Descargar Excel</p></TooltipContent></Tooltip>
                                        
                                        <AlertDialog>
                                            <Tooltip><TooltipTrigger asChild>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="icon" onClick={() => setOrderToDelete(order)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                            </TooltipTrigger><TooltipContent><p>Eliminar Orden</p></TooltipContent></Tooltip>
                                            
                                            {orderToDelete && orderToDelete.id === order.id && (
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Se eliminará permanentemente la orden "{orderToDelete.orderName}". Esta acción no se puede deshacer.
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
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
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
            existingOrderId={orderToEditInSheet?.id || null}
            onClearAndNew={onSheetClearAndNew}
        />
    </div>
    </TooltipProvider>
  );
}
