
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Trash2, Loader2, Search, FileDown, FileImage, FileText, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Placeholder types, will be defined properly later
interface ServiceOrder {
  id: string;
  fileNumber: string;
  guideName: string;
  driverName: string;
  paxInfo: string;
  itinerary: ItineraryItem[];
}

interface ItineraryItem {
  date: string;
  time: string;
  activity: string;
}

export default function ServiceOrderGeneratorPage() {
  const router = useRouter();
  const { isCurrentUserAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileNumber, setFileNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // This will hold the generated service order data
  const [generatedOrder, setGeneratedOrder] = useState<ServiceOrder | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && !isCurrentUserAdmin) {
      toast({ title: "Acceso Denegado", description: "No tienes permisos para acceder a esta página.", variant: "destructive" });
      router.replace('/');
    }
  }, [authLoading, isCurrentUserAdmin, router, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      toast({ title: "Archivo Seleccionado", description: file.name, className: "bg-green-100 dark:bg-green-900 border-green-500" });
    }
  };

  const handleClearFile = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSelectedFile(null);
  };
  
  const handleSearchFile = async () => {
    if (!selectedFile) {
        toast({ title: "Error", description: "Por favor, carga un archivo de programa primero.", variant: "destructive"});
        return;
    }
    if (!fileNumber) {
        toast({ title: "Error", description: "Por favor, ingresa un número de file para buscar.", variant: "destructive"});
        return;
    }
    setIsSearching(true);
    // Simulate search and generation
    await new Promise(res => setTimeout(res, 1500));
    
    // Placeholder data for demonstration
    setGeneratedOrder({
        id: `ORD-${fileNumber}`,
        fileNumber: fileNumber,
        guideName: "JUAN PEREZ",
        driverName: "CARLOS RAMOS",
        paxInfo: "Sr. John Doe (2 PAX)",
        itinerary: [
            { date: "25/07/2024", time: "08:00", activity: "Recojo del Hotel" },
            { date: "25/07/2024", time: "09:00", activity: "City Tour La Paz" },
            { date: "25/07/2024", time: "12:30", activity: "Almuerzo en restaurante típico" },
            { date: "25/07/2024", time: "14:00", activity: "Visita al Valle de la Luna" },
            { date: "25/07/2024", time: "17:00", activity: "Retorno al Hotel" },
        ]
    });

    toast({ title: "Búsqueda Exitosa", description: `Se encontró y generó la orden para el file ${fileNumber}.`, className: "bg-green-100 dark:bg-green-900 border-green-500" });
    setIsSearching(false);
  };
  
  const handleDownload = (format: 'Excel' | 'PDF' | 'Imagen' | 'WhatsApp') => {
      toast({
          title: `Función Próximamente`,
          description: `La opción de descargar como ${format} estará disponible pronto.`,
          variant: "default",
      });
  };

  if (authLoading || !isCurrentUserAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-4xl mb-4">
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back" className="hover:bg-primary/90">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Input Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-primary">Generar Orden de Servicio</CardTitle>
            <CardDescription>Carga el programa y busca por número de file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>1. Archivo de Programa</Label>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex-grow justify-start text-left font-normal",
                    selectedFile && "bg-green-100 dark:bg-green-900 border-green-500"
                  )}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {selectedFile ? selectedFile.name : "Seleccionar archivo .xlsx"}
                </Button>
                {selectedFile && (
                  <Button type="button" variant="destructive" size="icon" onClick={handleClearFile}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".xlsx,.xls"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="fileNumber">2. Número de File</Label>
              <div className="flex items-center gap-2 mt-2">
                <Input 
                    id="fileNumber" 
                    placeholder="Ingresa el file..." 
                    value={fileNumber}
                    onChange={(e) => setFileNumber(e.target.value)}
                    className="bg-muted"
                />
                <Button onClick={handleSearchFile} disabled={isSearching || !selectedFile || !fileNumber}>
                    {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>}
                    Buscar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Output Card */}
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-headline text-primary">Orden de Servicio Generada</CardTitle>
                <CardDescription>
                    {generatedOrder ? `Mostrando orden para el file: ${generatedOrder.fileNumber}` : "Aquí se mostrará el resultado."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isSearching ? (
                    <div className="flex flex-col items-center justify-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                        <p className="mt-4 text-muted-foreground">Buscando y generando...</p>
                    </div>
                ) : generatedOrder ? (
                    <div className="space-y-4">
                        <div className="p-4 border rounded-lg bg-background">
                            <h3 className="font-bold text-lg">{generatedOrder.guideName} (Guía)</h3>
                            <h4 className="font-semibold text-md">{generatedOrder.driverName} (Chofer)</h4>
                            <p className="text-sm text-muted-foreground">{generatedOrder.paxInfo}</p>
                        </div>
                        <div className="border rounded-lg p-4">
                            <h4 className="font-semibold mb-2">Itinerario:</h4>
                            <ul className="space-y-2">
                                {generatedOrder.itinerary.map((item, index) => (
                                    <li key={index} className="flex items-center text-sm">
                                        <span className="font-bold w-28">{item.date} {item.time}</span>
                                        <span className="text-muted-foreground">{item.activity}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                        <p className="text-muted-foreground">La orden de servicio aparecerá aquí una vez generada.</p>
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
