
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from 'xlsx';

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  initializeDefaultServiceOrderData,
  getGuidesFromUsers,
  getHotelsFromFirestore,
  getActivitiesFromFirestore,
  type ServiceOrderGuide,
  type Hotel,
  type Activity,
} from "@/lib/serviceOrderService";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Trash2, Loader2, Search, FileDown, FileImage, FileText, Share2, User, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


interface ServiceOrderData {
  ref: string;
  file: string;
  pax: string;
  guide: ServiceOrderGuide | null;
  hotel: Hotel | null;
  itinerary: Activity[];
}

export default function ServiceOrderPage() {
  const router = useRouter();
  const { isCurrentUserAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // Component State
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any[][] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Data for Selects
  const [guides, setGuides] = useState<ServiceOrderGuide[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  // Form & Results State
  const [fileNumberToSearch, setFileNumberToSearch] = useState("");
  const [generatedOrder, setGeneratedOrder] = useState<ServiceOrderData | null>(null);

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
          const [fetchedGuides, fetchedHotels, fetchedActivities] = await Promise.all([
            getGuidesFromUsers(),
            getHotelsFromFirestore(),
            getActivitiesFromFirestore(),
          ]);
          setGuides(fetchedGuides);
          setHotels(fetchedHotels);
          setActivities(fetchedActivities);
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
        setExcelData(json);
        toast({ title: "Archivo Cargado", description: file.name, className: "bg-green-100 dark:bg-green-900 border-green-500" });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleClearFile = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSelectedFile(null);
    setExcelData(null);
    setGeneratedOrder(null);
  };
  
  const handleSearchFile = async () => {
    if (!excelData) return toast({ title: "Error", description: "Carga un archivo de programa.", variant: "destructive" });
    if (!fileNumberToSearch) return toast({ title: "Error", description: "Ingresa un número de file.", variant: "destructive" });

    setIsSearching(true);
    await new Promise(res => setTimeout(res, 500)); // Simulate search

    let fileFound = false;
    let ref = "No encontrado";
    let pax = "N/A";

    for (const row of excelData) {
      if (String(row[0]).trim().toUpperCase() === fileNumberToSearch.trim().toUpperCase()) {
        fileFound = true;
        ref = String(row[1] || "No encontrado");
        pax = String(row[2] || "N/A");
        break;
      }
    }

    if (fileFound) {
      setGeneratedOrder({
        ref: ref,
        file: fileNumberToSearch,
        pax: pax,
        guide: null,
        hotel: null,
        itinerary: activities.slice(0, 5), // Placeholder with first 5 activities
      });
      toast({ title: "Búsqueda Exitosa", description: `File encontrado: ${ref}`, className: "bg-green-100 dark:bg-green-900 border-green-500" });
    } else {
      setGeneratedOrder(null);
      toast({ title: "Búsqueda Fallida", description: `No se encontró el file ${fileNumberToSearch}.`, variant: "destructive" });
    }
    setIsSearching(false);
  };
  
  const handleSelectChange = (type: 'guide' | 'hotel', value: string) => {
    if (!generatedOrder) return;

    if (type === 'guide') {
      const selectedGuide = guides.find(g => g.uid === value) || null;
      setGeneratedOrder({ ...generatedOrder, guide: selectedGuide });
    } else if (type === 'hotel') {
      const selectedHotel = hotels.find(h => h.id === value) || null;
      setGeneratedOrder({ ...generatedOrder, hotel: selectedHotel });
    }
  };
  
  const handleDownload = (format: 'Excel' | 'PDF' | 'Imagen' | 'WhatsApp') => {
    if (!generatedOrder || !generatedOrder.guide || !generatedOrder.hotel) {
      return toast({ title: "Datos incompletos", description: "Selecciona un guía y un hotel antes de descargar.", variant: "destructive"});
    }
    toast({
        title: `Función Próximamente`,
        description: `La opción de descargar como ${format} estará disponible pronto.`,
        variant: "default",
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-6xl mb-4">
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* --- Input Column --- */}
        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-headline text-primary">Generar Orden de Servicio</CardTitle>
              <CardDescription>Carga el programa, busca por file y selecciona los detalles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>1. Archivo de Programa</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}
                    className={cn("w-full justify-start", selectedFile && "bg-green-100 dark:bg-green-900 border-green-500")}>
                    <Upload className="mr-2 h-4 w-4" />
                    {selectedFile ? selectedFile.name : "Seleccionar archivo .xlsx"}
                  </Button>
                  {selectedFile && <Button type="button" variant="destructive" size="icon" onClick={handleClearFile}><Trash2 className="h-4 w-4" /></Button>}
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx,.xls"/>
                </div>
              </div>
              <div>
                <Label htmlFor="fileNumber">2. Buscar Número de File</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input id="fileNumber" placeholder="Ingresa el file..." value={fileNumberToSearch} onChange={(e) => setFileNumberToSearch(e.target.value)} className="bg-muted"/>
                  <Button onClick={handleSearchFile} disabled={isSearching || !selectedFile}><Search className="mr-2 h-4 w-4"/>Buscar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {generatedOrder && (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-xl">3. Completar Datos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label>Guía</Label>
                            <Select onValueChange={(value) => handleSelectChange('guide', value)}>
                                <SelectTrigger className="w-full mt-2"><User className="mr-2 h-4 w-4 text-muted-foreground"/> <SelectValue placeholder="Seleccionar guía..." /></SelectTrigger>
                                <SelectContent>
                                    {guides.map(g => <SelectItem key={g.uid} value={g.uid}>{g.fullName}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Hotel</Label>
                            <Select onValueChange={(value) => handleSelectChange('hotel', value)}>
                                <SelectTrigger className="w-full mt-2"><Building className="mr-2 h-4 w-4 text-muted-foreground"/> <SelectValue placeholder="Seleccionar hotel..." /></SelectTrigger>
                                <SelectContent>
                                    {hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                   </div>
                   {/* We can add a component to edit the itinerary here later */}
                </CardContent>
            </Card>
          )}
        </div>

        {/* --- Output Column --- */}
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-headline text-primary">Orden de Servicio</CardTitle>
                <CardDescription>
                    {generatedOrder ? `Orden para el file: ${generatedOrder.file}` : "Aquí se mostrará el resultado."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!generatedOrder ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                        {isSearching ? <Loader2 className="h-8 w-8 animate-spin text-primary"/> : <p className="text-muted-foreground">La orden aparecerá aquí.</p>}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 border rounded-lg bg-muted/50 space-y-1 text-sm">
                           <p><strong>REF:</strong> {generatedOrder.ref}</p>
                           <p><strong>FILE:</strong> {generatedOrder.file}</p>
                           <p><strong>PAX:</strong> {generatedOrder.pax}</p>
                           <p><strong>GUIA:</strong> {generatedOrder.guide?.fullName || <span className="text-destructive">No seleccionado</span>}</p>
                           <p><strong>HOTEL:</strong> {generatedOrder.hotel?.name || <span className="text-destructive">No seleccionado</span>}</p>
                        </div>
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">Fecha</TableHead>
                                        <TableHead>Actividad</TableHead>
                                        <TableHead className="w-[120px]">Guía Asignado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {generatedOrder.itinerary.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell>01/01/25</TableCell>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell className="font-medium">{generatedOrder.guide?.firstName || ""}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </CardContent>
            {generatedOrder && (
                <CardFooter className="grid grid-cols-2 gap-2 pt-6 border-t">
                    <Button onClick={() => handleDownload('Excel')} variant="outline"><FileDown className="mr-2"/> Excel</Button>
                    <Button onClick={() => handleDownload('PDF')} variant="outline"><FileText className="mr-2"/> PDF</Button>
                    <Button onClick={() => handleDownload('Imagen')} variant="outline"><FileImage className="mr-2"/> Imagen</Button>
                    <Button onClick={() => handleDownload('WhatsApp')} variant="outline"><Share2 className="mr-2"/> WhatsApp</Button>
                </CardFooter>
            )}
        </Card>
      </div>
    </div>
  );
}
