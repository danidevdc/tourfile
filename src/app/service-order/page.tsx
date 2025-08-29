
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { getAllServiceOrders, deleteServiceOrder, updateServiceOrder, type StoredServiceOrder } from '@/lib/serviceOrderStorage';
import { generateServiceOrderExcel, type ServiceOrderData } from '@/lib/serviceOrderGenerator';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, FileDown, Edit, Trash2, FilePlus, ListOrdered } from "lucide-react";
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
import { ServiceOrderGeneratorSheet } from "@/components/service-order/ServiceOrderGeneratorSheet";
import { ItineraryEditModal } from "@/components/service-order/ItineraryEditModal";
import { getGuidesFromFirestore, getDriversFromFirestore, type ServiceOrderGuide, type Driver } from "@/lib/serviceOrderService";


export default function ServiceOrderListPage() {
  const router = useRouter();
  const { isLoading: authLoading, isCurrentUserAdmin } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<StoredServiceOrder[]>([]);
  const [guides, setGuides] = useState<ServiceOrderGuide[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [orderToEditInSheet, setOrderToEditInSheet] = useState<StoredServiceOrder | null>(null);
  const [orderToEditInModal, setOrderToEditInModal] = useState<StoredServiceOrder | null>(null);

  const [orderToDelete, setOrderToDelete] = useState<StoredServiceOrder | null>(null);
  const [isDownloadingId, setIsDownloadingId] = useState<string | null>(null);


  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const [fetchedOrders, fetchedGuides, fetchedDrivers] = await Promise.all([
        getAllServiceOrders(),
        getGuidesFromFirestore(),
        getDriversFromFirestore()
      ]);
      setOrders(fetchedOrders);
      setGuides(fetchedGuides);
      setDrivers(fetchedDrivers);
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
  }, [authLoading]);

  const handleNewOrderClick = () => {
    setOrderToEditInSheet(null);
    setIsSheetOpen(true);
  };
  
  const handleEditOrderClick = (order: StoredServiceOrder) => {
    setOrderToEditInSheet(order);
    setIsSheetOpen(true);
  };

  const handleEditItineraryClick = (order: StoredServiceOrder) => {
    setOrderToEditInModal(order);
    setIsModalOpen(true);
  };
  
  const handleSaveFromModal = async (updatedServices: StoredServiceOrder['data']['services']) => {
    if (!orderToEditInModal) return;

    const updatedOrderData: ServiceOrderData = {
      ...orderToEditInModal.data,
      services: updatedServices
    };
    
    try {
      await updateServiceOrder(orderToEditInModal.id, updatedOrderData);
      toast({ title: "Éxito", description: "Itinerario actualizado.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
      fetchOrders(); // Refresh list
    } catch(e) {
      toast({ title: "Error", description: "No se pudo actualizar el itinerario.", variant: "destructive" });
    } finally {
      setIsModalOpen(false);
      setOrderToEditInModal(null);
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

  const onSheetSave = () => {
    setIsSheetOpen(false);
    setOrderToEditInSheet(null);
    fetchOrders(); // Refresh the list after saving
  };
  
  const onSheetClose = () => {
    // Keep isSheetOpen in sync with the sheet's internal state
    setIsSheetOpen(false);
    // DO NOT clear orderToEditInSheet here, so the state persists on re-open
  }

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  return (
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
            <div className="flex items-center gap-4">
               <ListOrdered className="h-8 w-8 text-primary"/>
               <div>
                  <CardTitle className="text-2xl font-headline text-primary">Historial de Órdenes de Servicio</CardTitle>
                  <CardDescription>Visualiza, edita o descarga las órdenes generadas.</CardDescription>
               </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[15%]">Nombre de la Orden</TableHead>
                            <TableHead className="w-[15%]">Creado Por</TableHead>
                            <TableHead className="w-[15%]">Guía Asignado</TableHead>
                            <TableHead className="w-[15%]">Fecha de Creación</TableHead>
                            <TableHead className="text-right w-[40%]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.length > 0 ? (
                            orders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium">{order.orderName}</TableCell>
                                    <TableCell>{order.createdBy}</TableCell>
                                    <TableCell>{order.data.guia}</TableCell>
                                    <TableCell>{format(order.createdAt, 'dd MMMM yyyy, HH:mm', { locale: es })}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="sm" onClick={() => handleEditOrderClick(order)} title="Editar Orden" className="text-primary border-primary hover:bg-primary/10">
                                            <Edit className="mr-2 h-4 w-4"/>Editar
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleEditItineraryClick(order)} title="Editar Itinerario" className="text-blue-600 border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20">
                                            <ListOrdered className="mr-2 h-4 w-4"/>Itinerario
                                        </Button>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => handleDownloadExcel(order)} 
                                          disabled={isDownloadingId === order.id}
                                          title="Descargar Excel"
                                          className="text-green-600 border-green-600 hover:bg-green-100 hover:text-green-700"
                                        >
                                            {isDownloadingId === order.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileDown className="mr-2 h-4 w-4"/>}
                                            Excel
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm" title="Eliminar Orden" onClick={() => setOrderToDelete(order)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />Eliminar
                                                </Button>
                                            </AlertDialogTrigger>
                                            {orderToDelete && orderToDelete.id === order.id && (
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Se eliminará permanentemente la orden "{orderToDelete.orderName}". Esta acción no se puede deshacer.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel onClick={() => setOrderToDelete(null)}>Cancelar</AlertDialogCancel>
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
                                    No se han generado órdenes de servicio todavía.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
          </CardContent>
        </Card>

        {isModalOpen && orderToEditInModal && (
          <ItineraryEditModal 
            services={orderToEditInModal.data.services}
            guides={guides}
            drivers={drivers}
            onSave={handleSaveFromModal}
            onClose={() => {
              setIsModalOpen(false);
              setOrderToEditInModal(null);
            }}
          />
        )}

        <ServiceOrderGeneratorSheet 
            isOpen={isSheetOpen}
            onClose={onSheetClose}
            onSave={onSheetSave}
            existingOrder={orderToEditInSheet}
            onClearAndNew={() => setOrderToEditInSheet(null)} // Pass the new handler
        />
    </div>
  );
}
