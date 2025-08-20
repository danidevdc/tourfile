
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  initializeDefaultServiceOrderData,
  getGuidesFromUsers,
  getHotelsFromFirestore,
  type ServiceOrderGuide,
  type Hotel,
} from "@/lib/serviceOrderService";
import { generateServiceOrderExcel } from '@/lib/serviceOrderGenerator';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, FileDown, Trash2, PlusCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type ServiceOrderData, type ServiceItem } from "@/lib/serviceOrderGenerator";

const initialServiceOrderState: ServiceOrderData = {
  guia: '',
  file: '',
  ref: '',
  nPax: '',
  hotel: '',
  services: [],
  observations: '',
  nota: 'SERVICIOS EN EL LAGO.\nTODOS LOS GUIAS DEBEN ENVIAR UN INFORME DIARIO POR WHATSAPP A LA SEÑORA JUDITH SOBRE LOS SERVICIOS.\nGUIA DEBE PRESENTAR COPIA DE PASAPORTE DE PAX DESPUES DE CADA SERVICIO JUNTO A SU LIQUIDACION Y CAJA CHICA'
};

export default function ServiceOrderPage() {
  const router = useRouter();
  const { isCurrentUserAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // Component State
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Data for Selects
  const [guides, setGuides] = useState<ServiceOrderGuide[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);

  // Form & Results State
  const [orderData, setOrderData] = useState<ServiceOrderData>(initialServiceOrderState);

  // Initial data loading
  useEffect(() => {
    if (!authLoading && !isCurrentUserAdmin) {
      toast({ title: "Acceso Denegado", description: "No tienes permisos para acceder.", variant: "destructive" });
      router.replace('/');
      return;
    }
    
    async function loadInitialData() {
      if (isCurrentUserAdmin) {
        setIsLoading(true);
        try {
          await initializeDefaultServiceOrderData();
          const [fetchedGuides, fetchedHotels] = await Promise.all([
            getGuidesFromUsers(),
            getHotelsFromFirestore(),
          ]);
          setGuides(fetchedGuides);
          setHotels(fetchedHotels);
        } catch (error) {
          toast({ title: "Error", description: "No se pudieron cargar los datos iniciales.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      }
    }
    if(!authLoading) {
      loadInitialData();
    }
  }, [authLoading, isCurrentUserAdmin, router, toast]);

  const handleInputChange = (field: keyof ServiceOrderData, value: string) => {
    setOrderData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSelectChange = (type: 'guide' | 'hotel', value: string) => {
    if (type === 'guide') {
      const selectedGuide = guides.find(g => g.uid === value);
      if (selectedGuide) {
        setOrderData(prev => ({
          ...prev,
          guia: selectedGuide.fullName,
          services: prev.services.map(s => ({ ...s, guia: selectedGuide.firstName }))
        }));
      }
    } else if (type === 'hotel') {
      const selectedHotel = hotels.find(h => h.id === value);
      setOrderData(prev => ({ ...prev, hotel: selectedHotel?.name || '' }));
    }
  };

  const handleServiceChange = (index: number, field: keyof ServiceItem, value: string) => {
    const updatedServices = [...orderData.services];
    updatedServices[index] = { ...updatedServices[index], [field]: value };
    setOrderData(prev => ({ ...prev, services: updatedServices }));
  };

  const addNewService = () => {
    const newService: ServiceItem = {
      fecha: '', hora: '', servicio: '', vuelo: '',
      guia: guides.find(g => g.fullName === orderData.guia)?.firstName || '',
      bus: orderData.nPax,
      chofer: '',
      observaciones: ''
    };
    setOrderData(prev => ({ ...prev, services: [...prev.services, newService] }));
  };

  const removeService = (index: number) => {
    const updatedServices = orderData.services.filter((_, i) => i !== index);
    setOrderData(prev => ({ ...prev, services: updatedServices }));
  };

  const handleDownloadExcel = () => {
    setIsGenerating(true);
    try {
      if (!orderData.guia || !orderData.file) {
        toast({ title: "Datos incompletos", description: "El nombre del guía y el file son obligatorios.", variant: "destructive" });
        return;
      }
      const workbook = generateServiceOrderExcel(orderData);
      const fileName = `Orden_Servicio_${orderData.file.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast({ title: "Descarga Exitosa", description: `Se generó el archivo ${fileName}.`, className: "bg-green-100 dark:bg-green-900 border-green-500"});
    } catch(error) {
      console.error("Error generating excel", error);
      toast({ title: "Error", description: "No se pudo generar el archivo Excel.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };


  useEffect(() => {
    // Update 'bus' and 'guia' in services when main fields change
    const guideFirstName = guides.find(g => g.fullName === orderData.guia)?.firstName || '';
    setOrderData(prev => ({
      ...prev,
      services: prev.services.map(s => ({
        ...s,
        bus: prev.nPax,
        guia: guideFirstName
      }))
    }));
  }, [orderData.nPax, orderData.guia, guides]);


  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8 bg-background">
      <div className="w-full max-w-7xl mb-4">
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="w-full max-w-7xl space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-primary">Generador de Órdenes de Servicio</CardTitle>
            <CardDescription>Completa los campos para generar la orden de servicio.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                  <Label>Guía</Label>
                  <Select onValueChange={(value) => handleSelectChange('guide', value)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar guía..." /></SelectTrigger>
                      <SelectContent>
                          {guides.map(g => <SelectItem key={g.uid} value={g.uid}>{g.fullName}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
              <div>
                  <Label htmlFor="file">File</Label>
                  <Input id="file" value={orderData.file} onChange={e => handleInputChange('file', e.target.value)} className="mt-1"/>
              </div>
              <div>
                  <Label htmlFor="ref">Ref</Label>
                  <Input id="ref" value={orderData.ref} onChange={e => handleInputChange('ref', e.target.value)} className="mt-1"/>
              </div>
              <div>
                  <Label htmlFor="nPax">Nº Pax</Label>
                  <Input id="nPax" value={orderData.nPax} onChange={e => handleInputChange('nPax', e.target.value)} className="mt-1"/>
              </div>
              <div>
                  <Label>Hotel</Label>
                  <Select onValueChange={(value) => handleSelectChange('hotel', value)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar hotel..." /></SelectTrigger>
                      <SelectContent>
                          {hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Vuelo</TableHead>
                    <TableHead>Guía</TableHead>
                    <TableHead>Bus</TableHead>
                    <TableHead>Chofer</TableHead>
                    <TableHead>Observaciones</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderData.services.map((service, index) => (
                    <TableRow key={index}>
                      <TableCell><Input value={service.fecha} onChange={e => handleServiceChange(index, 'fecha', e.target.value)} placeholder="dd/mm/aa" /></TableCell>
                      <TableCell><Input value={service.hora} onChange={e => handleServiceChange(index, 'hora', e.target.value)} placeholder="HH:mm" /></TableCell>
                      <TableCell><Input value={service.servicio} onChange={e => handleServiceChange(index, 'servicio', e.target.value)} /></TableCell>
                      <TableCell><Input value={service.vuelo} onChange={e => handleServiceChange(index, 'vuelo', e.target.value)} /></TableCell>
                      <TableCell><Input value={service.guia} onChange={e => handleServiceChange(index, 'guia', e.target.value)} /></TableCell>
                      <TableCell><Input value={service.bus} onChange={e => handleServiceChange(index, 'bus', e.target.value)} /></TableCell>
                      <TableCell><Input value={service.chofer} onChange={e => handleServiceChange(index, 'chofer', e.target.value)} /></TableCell>
                      <TableCell><Input value={service.observaciones} onChange={e => handleServiceChange(index, 'observaciones', e.target.value)} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="destructive" size="icon" onClick={() => removeService(index)}><Trash2 className="h-4 w-4"/></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={addNewService} variant="outline" className="mt-4"><PlusCircle className="mr-2 h-4 w-4"/>Añadir Servicio</Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
           <CardHeader>
            <CardTitle>Observaciones y Notas Finales</CardTitle>
          </CardHeader>
           <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="observaciones">Observaciones Generales</Label>
                <Textarea id="observaciones" value={orderData.observations} onChange={e => handleInputChange('observations', e.target.value)} className="mt-1" rows={5}/>
              </div>
               <div>
                <Label htmlFor="nota">Nota (Pie de página)</Label>
                <Textarea id="nota" value={orderData.nota} onChange={e => handleInputChange('nota', e.target.value)} className="mt-1" rows={5}/>
              </div>
           </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
             <CardTitle className="text-xl">Finalizar</CardTitle>
             <CardDescription>Genera y descarga el archivo final.</CardDescription>
          </CardHeader>
          <CardContent>
              <Button onClick={handleDownloadExcel} className="w-full sm:w-auto" disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileDown className="mr-2 h-4 w-4"/>}
                  Generar y Descargar Excel
              </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
