
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from 'xlsx'; 
import { format } from 'date-fns';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, ArrowLeft, Search, CheckCircle2, XCircle, Eye, FileDown, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { ResultsDialogContent } from "@/components/report/ResultsDialogContent";

const formSchema = z.object({
  fileNumber: z.string().min(1, "El número de file es requerido."),
  guideName: z.string().min(1, "El nombre del guía es requerido."),
});

type FormValues = z.infer<typeof formSchema>;
type FileSearchStatus = "idle" | "searching" | "found" | "not_found" | "error";

export interface ExpenseItem {
  date: string;
  quantity: string; // Para mostrar la fórmula o número original
  detail: string;
  unitPrice: number;
  total: number; // Total calculado
  vobOps?: string;
}

export interface GeneratedReportInfo {
  id: string;
  fileNumber: string;
  guideName: string; 
  originalProgramFileName: string;
  groupName: string; 
  paxCount: string;
  generationDate: Date;
  occurrenceCount: number;
  isDuplicateInstance: boolean;
  expenseItems: ExpenseItem[];
  startDate: string; // Fecha de inicio del tour formateada dd/MM/yy
}

interface FileDataProps {
  fileIdRowIndex: number | null;
  columnIndex: number | null;
}

// Helper function to resolve quantity strings like "=$G$3+1" or "17"
function resolveQuantity(quantityStr: string, paxNumber: number): number {
  if (!isNaN(Number(quantityStr))) {
    return Number(quantityStr);
  }

  const cleanedQuantity = quantityStr.toUpperCase().replace(/\s/g, '');
  // Reemplazar $G$3 o G3 con el valor de pax
  // Asegurarse de que G3 no sea parte de otra palabra como "GUIDE"
  const formulaWithPax = cleanedQuantity.replace(/(?<![A-Z])G3(?![0-9A-Z])|\$G\$3/g, String(paxNumber));


  if (formulaWithPax.startsWith('=')) {
    try {
      const expression = formulaWithPax.substring(1);
      // Permitir solo números, +, -, *, /, (, ) y el valor de pax ya insertado.
      if (/^[\d\s()+\-*/.]+$/.test(expression)) {
        return new Function(`return ${expression}`)() as number;
      } else {
        console.warn(`Fórmula de cantidad no segura o no válida: ${expression} (original: ${quantityStr})`);
        return 1; // Fallback
      }
    } catch (e) {
      console.error(`Error evaluando cantidad "${quantityStr}" con expresión "${formulaWithPax.substring(1)}":`, e);
      return 1; // Fallback
    }
  }
  console.warn(`Cantidad no reconocida: ${quantityStr}`);
  return 1; // Fallback si no es número ni fórmula simple
}


function generateExpenseDetails(
  excelData: any[][] | null,
  fileData: FileDataProps,
  paxCountString: string,
  groupName: string
): { expenses: ExpenseItem[], tourStartDate: string } {
  
  const expenseItems: ExpenseItem[] = [];
  if (!excelData || fileData.columnIndex === null || fileData.fileIdRowIndex === null) {
    return { expenses: [], tourStartDate: "N/A" };
  }

  const columnIndex = fileData.columnIndex;
  const fileIdRowIndex = fileData.fileIdRowIndex;

  const paxNum = parseInt(paxCountString, 10);
  if (isNaN(paxNum)) {
    console.error("Número de PAX no válido:", paxCountString);
    // Considerar lanzar un error o devolver un estado de error aquí
    return { expenses: [], tourStartDate: "N/A" };
  }

  const guia = 1;

  let tourStartDate = "N/A";
  const fechaInicioRaw = excelData[fileIdRowIndex + 3]?.[columnIndex];
  if (fechaInicioRaw instanceof Date) {
    tourStartDate = format(fechaInicioRaw, 'dd/MM/yy');
  } else if (typeof fechaInicioRaw === 'number') { // Excel serial date
     const dateObj = XLSX.SSF.parse_date_code(fechaInicioRaw);
     if (dateObj) {
        tourStartDate = format(new Date(dateObj.y, dateObj.m - 1, dateObj.d, dateObj.H || 0, dateObj.M || 0, dateObj.S || 0), 'dd/MM/yy');
     } else {
        console.warn("No se pudo parsear el número de fecha de Excel:", fechaInicioRaw);
     }
  } else if (typeof fechaInicioRaw === 'string') {
    try {
        const parsedDate = new Date(fechaInicioRaw); // Intentar parseo directo
        if (!isNaN(parsedDate.valueOf())) {
            tourStartDate = format(parsedDate, 'dd/MM/yy');
        } else {
             // Podríamos intentar más formatos si es necesario. ej: date-fns parse
            console.warn("String de fecha no reconocido:", fechaInicioRaw);
        }
    } catch(e){
        console.warn("Error parseando string de fecha:", fechaInicioRaw, e);
    }
  }


  const columnData = excelData.map(row => String(row[columnIndex] || '').toLowerCase());

  const contiene = (keyword: string) => columnData.some(cell => cell.includes(keyword.toLowerCase()));

  const contiene_desaguadero = contiene("desaguadero");
  const contiene_puno = contiene("Puno/Kasani");
  const contiene_isla = contiene("I.Sol");
  const contiene_trf_in = contiene("CT-Private transfer from airport to hotel");
  const contiene_tiwa = contiene("Tiwanaku");
  const contiene_teleferico = contiene("Cable Car") || contiene("teleferico"); // Added teleferico
  const contiene_valle = contiene("Moon Valley") || contiene("valle de la luna"); // Added valle de la luna
  const contiene_city_continuado = contiene("AM"); // Asume que "AM" indica almuerzo guía en city tour continuado
  const contiene_kasani = contiene("Kasani/Puno");
  const contiene_trf_out = contiene("CT-Private transfer from hotel to airport");
  const contiene_aguas_keyword_directa = contiene("CT-City Tour"); // Esta es la que activa AGUAS en el script original por "City Tour"
  const contiene_city_tour_general = contiene("City Tour"); // Para la condición especial de AGUAS (CT y Tiwa)

  // Lógica de gastos (adaptada de Python)
  if (contiene_desaguadero) {
    const quantityStr = "=$G$3";
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "MALETAS FRONTERA", unitPrice: 3.00, total: resolveQuantity(quantityStr, paxNum) * 3.00 });
  }

  if (contiene_puno) {
    const itemsPuno = [
      { quantityStr: String(guia), detail: "TAXI DOM - OFICINA", unitPrice: 30.00 },
      { quantityStr: String(guia), detail: "BUS LPB - COPA", unitPrice: 40.00 },
      { quantityStr: String(guia), detail: "DESAYUNO GUIA", unitPrice: 20.00 },
    ];
    itemsPuno.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  if (contiene_isla) {
    const itemsIsla = [
      { quantityStr: String(guia), detail: "TAXI DOM - HOTEL", unitPrice: 30.00 }, // Asumo que es para el guía
      { quantityStr: "=$G$3", detail: "ISLA DEL SOL", unitPrice: 10.00 },
      { quantityStr: "=$G$3", detail: "ISLA DE LA LUNA", unitPrice: 10.00 },
    ];
    itemsIsla.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  if (contiene_trf_in) {
    const itemsTrfIn = [
      { quantityStr: String(guia), detail: "TAXI DOM - OFICINA", unitPrice: 30.00 },
      { quantityStr: "=$G$3", detail: "MALETAS AEROPUERTO", unitPrice: 3.00 },
      { quantityStr: String(guia), detail: "TAXI HOTEL - DOM", unitPrice: 30.00 },
    ];
    itemsTrfIn.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  if (contiene_tiwa) {
    const quantityStr = "=$G$3";
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "TIWANAKU", unitPrice: 100.00, total: resolveQuantity(quantityStr, paxNum) * 100.00 });
  }

  if (contiene_teleferico) {
    const quantityStr = "=$G$3+1";
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "TELEFERICO", unitPrice: 7.00, total: resolveQuantity(quantityStr, paxNum) * 7.00 });
  }

  if (contiene_valle) {
    const quantityStr = "=$G$3";
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "VALLE", unitPrice: 20.00, total: resolveQuantity(quantityStr, paxNum) * 20.00 });
  }
  
  // Almuerzo Guia por "AM" (asumiendo City Tour continuado)
  // El script original dice: if contiene_city_continuado (que es "AM")
  if (contiene_city_continuado && contiene_city_tour_general) { // Condición más precisa: AM y City Tour
    const quantityStr = String(guia);
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "ALMUERZO GUIA", unitPrice: 35.00, total: resolveQuantity(quantityStr, paxNum) * 35.00 });
  }


  if (contiene_kasani) {
     const itemsKasani = [
      { quantityStr: "=$G$3", detail: "MALETAS FRONTERA", unitPrice: 3.00 },
      { quantityStr: String(guia), detail: "BUS COPA - LPB", unitPrice: 40.00 },
    ];
    itemsKasani.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  if (contiene_trf_out) {
    const itemsTrfOut = [
      { quantityStr: String(guia), detail: "TAXI DOM - HOTEL", unitPrice: 30.00 },
      { quantityStr: "=$G$3", detail: "MALETAS AEROPUERTO", unitPrice: 3.00 },
      { quantityStr: String(guia), detail: "TAXI CENTRO - DOM", unitPrice: 30.00 }, // El script python dice TAXI CENTRO - DOM
    ];
    itemsTrfOut.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }
  
  // AGUAS: la lógica original es 'contiene_aguas' que se activa por "CT-City Tour"
  if (contiene_aguas_keyword_directa) { // Si "CT-City Tour" está presente
    let cantidadFormulaAguas = "=$G$3+2"; // Pax + Guia + Chofer
    // Condición especial del script python: si es City Tour Y Tiwanaku, la cantidad se duplica.
    // "contiene_city_tour" es la keyword general "City Tour", "contiene_tiwa" ya está definida.
    if (contiene_city_tour_general && contiene_tiwa) {
        cantidadFormulaAguas = "=($G$3+2)*2";
    }
    expenseItems.push({
        date: "", // Fecha vacía para AGUAS
        quantity: cantidadFormulaAguas,
        detail: "AGUAS",
        unitPrice: 6.00,
        total: resolveQuantity(cantidadFormulaAguas, paxNum) * 6.00
    });
  }
  
  return { expenses: expenseItems, tourStartDate };
}


export default function GeneratorPage() {
  const { toast } = useToast();
  const router = useRouter();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any[][] | null>(null); 
  const [fileDataProps, setFileDataProps] = useState<FileDataProps>({ fileIdRowIndex: null, columnIndex: null });

  const [foundCellValue, setFoundCellValue] = useState<string | null>(null); 
  const [currentPaxCount, setCurrentPaxCount] = useState<string | null>(null);

  const [isFileMissingError, setIsFileMissingError] = useState(false); 
  const [isProcessingSearch, setIsProcessingSearch] = useState(false);
  const [isProcessingGeneration, setIsProcessingGeneration] = useState(false);
  const [fileSearchStatus, setFileSearchStatus] = useState<FileSearchStatus>("idle");
  
  const [generatedReports, setGeneratedReports] = useState<GeneratedReportInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isResultsDialogOpen, setIsResultsDialogOpen] = useState(false);
  const [currentReportInDialog, setCurrentReportInDialog] = useState<GeneratedReportInfo | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fileNumber: "",
      guideName: "",
    },
  });

  useEffect(() => {
    if (!selectedFile) {
      setExcelData(null);
      setFoundCellValue(null);
      setCurrentPaxCount(null);
      setFileSearchStatus("idle");
      setFileDataProps({ fileIdRowIndex: null, columnIndex: null });
      form.reset({ fileNumber: "", guideName: "" });
      setGeneratedReports([]); 
    }
  }, [selectedFile, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];

    // Limpiar estados antes de cargar un nuevo archivo
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
    }
    setSelectedFile(null); 
    // El useEffect de arriba se encargará de limpiar el resto.

    if (file) {
      setSelectedFile(file); 
      setIsFileMissingError(false);

      toast({
        title: "Archivo Seleccionado",
        description: file.name,
        variant: "default",
      });

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target?.result;
          if (!arrayBuffer) throw new Error("Error al leer el archivo.");
          const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true }); // cellDates: true
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
          setExcelData(data);
        } catch (error) {
          console.error("Error al procesar el archivo Excel:", error);
          toast({
            title: "Error de Procesamiento",
            description: "No se pudo procesar el archivo Excel. Asegúrate de que sea un formato válido.",
            variant: "destructive",
          });
          handleClearFile(); 
        }
      };
      reader.onerror = (e) => {
        console.error("Error al leer el archivo:", e);
        toast({ title: "Error de Lectura", description: "Hubo un problema al leer el archivo.", variant: "destructive" });
        handleClearFile(); 
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleClearFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
    setSelectedFile(null); 
    setIsFileMissingError(false); 
    
    toast({
      title: "Archivo Limpiado",
      description: "Se ha quitado el archivo de programa seleccionado.",
      variant: "default",
    });
  };
  
  const getFileNumberInputClasses = (): string => {
    let baseClasses = "bg-muted"; 
    if (fileSearchStatus === "found") {
      baseClasses = "bg-green-100 dark:bg-green-900 border-green-500 text-green-800 dark:text-green-200 focus-visible:ring-green-500 dark:focus-visible:ring-green-500";
    } else if (fileSearchStatus === "not_found" || (fileSearchStatus === "error" && form.getValues("fileNumber"))) { 
      baseClasses = "bg-red-100 dark:bg-red-900 border-destructive text-destructive focus-visible:ring-destructive dark:focus-visible:ring-destructive";
    }
    return baseClasses;
  };
  

  const handleSearchFile = async () => {
    const fileNumberToSearch = form.getValues("fileNumber");
    if (!selectedFile || !excelData) {
      setIsFileMissingError(true); 
      setFileSearchStatus("error");
      toast({ title: "Error de Búsqueda", description: "Sube y procesa un archivo de programa primero.", variant: "destructive" });
      return;
    }
    setIsFileMissingError(false); 

    if (!fileNumberToSearch) {
      setFileSearchStatus("error"); 
      form.setError("fileNumber", { type: "manual", message: "Ingresa un número de file para buscar."});
      toast({ title: "Error de Búsqueda", description: "Ingresa un número de file para buscar.", variant: "destructive" });
      return;
    }

    setIsProcessingSearch(true);
    setFileSearchStatus("searching");
    setFoundCellValue(null);
    setCurrentPaxCount(null);
    setFileDataProps({ fileIdRowIndex: null, columnIndex: null });
    
    let found = false;
    let colIdx = -1;
    let rowIdxWhereFileNumberFound = -1; 

    if (excelData && excelData.length > 0) {
      const numCols = excelData.reduce((max, row) => Math.max(max, row.length), 0);
      for (let j = 0; j < numCols; j++) { 
        for (let i = 0; i < excelData.length; i++) { 
          if (excelData[i] && excelData[i][j] !== undefined && excelData[i][j] !== null) {
             if (String(excelData[i][j]).trim() === fileNumberToSearch.trim()) {
              colIdx = j;
              rowIdxWhereFileNumberFound = i; 
              found = true;
              break; 
            }
          }
        }
        if (found) break; 
      }
    }

    if (found && colIdx !== -1 && rowIdxWhereFileNumberFound !== -1) {
      setFileDataProps({ fileIdRowIndex: rowIdxWhereFileNumberFound, columnIndex: colIdx });
      
      const groupName = (excelData[rowIdxWhereFileNumberFound + 1]?.[colIdx] !== undefined) 
                        ? String(excelData[rowIdxWhereFileNumberFound + 1][colIdx]).trim() 
                        : "No se encontró nombre de grupo.";
      setFoundCellValue(groupName);

      // PAX se espera en la fila FilaFileID + 4 (índice original 4 si FileID es 0)
      const pax = (excelData[rowIdxWhereFileNumberFound + 4]?.[colIdx] !== undefined) 
                  ? String(excelData[rowIdxWhereFileNumberFound + 4][colIdx]).trim() 
                  : "N/A";
      setCurrentPaxCount(pax);

      setFileSearchStatus("found");
      toast({
        title: "Búsqueda Exitosa",
        description: `Nombre de file: ${groupName}`,
        variant: "default",
        className: "bg-green-100 dark:bg-green-900 border-green-500",
      });
    } else {
      setFileSearchStatus("not_found");
      toast({ title: "Búsqueda Fallida", description: `File "${fileNumberToSearch}" no encontrado.`, variant: "destructive" });
    }
    setIsProcessingSearch(false);
  };
  
  async function onSubmit(values: FormValues) {
    if (!selectedFile || !excelData) {
      setIsFileMissingError(true);
      toast({ title: "Error", description: "Sube un archivo de programa.", variant: "destructive" });
      return;
    }
    setIsFileMissingError(false);

    if (fileSearchStatus !== "found" || !foundCellValue || !currentPaxCount || fileDataProps.fileIdRowIndex === null || fileDataProps.columnIndex === null) {
       toast({ title: "Error", description: "Busca y confirma el file antes de generar. Asegúrate que se extrajo el nombre y PAX.", variant: "destructive" });
      return;
    }
    
    if (currentPaxCount === "N/A" || isNaN(parseInt(currentPaxCount, 10))) {
        toast({ title: "Error de Datos", description: "El número de PAX no es válido. Verifica el archivo Excel.", variant: "destructive" });
        return;
    }


    setIsProcessingGeneration(true);
    await new Promise(resolve => setTimeout(resolve, 300)); 

    const { expenses, tourStartDate } = generateExpenseDetails(
      excelData,
      fileDataProps,
      currentPaxCount,
      foundCellValue
    );

    if (tourStartDate === "N/A" && expenses.length === 0) {
         toast({ title: "Error de Generación", description: "No se pudo determinar la fecha de inicio o no se generaron gastos. Verifica el archivo Excel.", variant: "destructive" });
         setIsProcessingGeneration(false);
         return;
    }


    const currentInputFileNumber = values.fileNumber;
    const currentInputGuideName = values.guideName.toUpperCase(); 

    const existingOccurrences = generatedReports.filter(
      report => report.fileNumber === currentInputFileNumber && report.guideName.toUpperCase() === currentInputGuideName
    ).length;
    
    const occurrenceCount = existingOccurrences + 1;
    const isDuplicateInstance = occurrenceCount > 1; 

    const newReport: GeneratedReportInfo = {
      id: new Date().toISOString() + Math.random().toString(36).substring(2, 9), 
      fileNumber: currentInputFileNumber,
      guideName: currentInputGuideName, 
      originalProgramFileName: selectedFile.name,
      groupName: foundCellValue, 
      paxCount: currentPaxCount,
      generationDate: new Date(),
      occurrenceCount: occurrenceCount,
      isDuplicateInstance: isDuplicateInstance,
      expenseItems: expenses,
      startDate: tourStartDate,
    };

    setGeneratedReports(prev => [...prev, newReport]);
    
    form.reset({ fileNumber: "", guideName: "" }); 
    setFileSearchStatus("idle"); 
    setFoundCellValue(null);
    setCurrentPaxCount(null);
    setFileDataProps({ fileIdRowIndex: null, columnIndex: null }); // Limpiar fileDataProps
    
    toast({
      title: "Reporte Añadido",
      description: `Se añadió el reporte para el file ${newReport.fileNumber} a la lista.`,
    });
    setIsProcessingGeneration(false);
  }

  const handleViewReport = (report: GeneratedReportInfo) => {
    setCurrentReportInDialog(report);
    setIsResultsDialogOpen(true);
  };

  const handleDeleteReport = (reportId: string) => {
    setGeneratedReports(prev => prev.filter(report => report.id !== reportId));
    toast({
      title: "Reporte Eliminado",
      description: "El reporte ha sido eliminado de la lista.",
      variant: "default",
    });
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-3xl mb-4"> 
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back" className="hover:bg-primary/90">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <Card className="w-full max-w-3xl shadow-lg"> 
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center text-primary">Generador de Cajas Chicas (La Paz)</CardTitle>
          <CardDescription className="text-center">
            Sube tu archivo de programa, ingresa los detalles y genera tu reporte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}> 
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormItem>
                <FormLabel>1. Archivo de Programa Mensual</FormLabel>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex-grow justify-start text-left font-normal",
                      selectedFile 
                        ? "bg-green-100 dark:bg-green-900 border-green-500 hover:bg-green-200 dark:hover:bg-green-800 text-green-800 dark:text-green-200" 
                        : "bg-muted", 
                      isFileMissingError && !selectedFile ? "border-destructive" : ""
                    )}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {selectedFile ? selectedFile.name : "Seleccionar archivo (.xlsx, .xls)"}
                  </Button>
                  {selectedFile && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={handleClearFile}
                      title="Limpiar archivo seleccionado"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  />
                </div>
                {isFileMissingError && !selectedFile && (
                     <p className="text-sm font-medium text-destructive mt-1">Por favor, selecciona un archivo para buscar.</p>
                )}
              </FormItem>

              <div className="space-y-6"> 
                <FormField
                  control={form.control}
                  name="fileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>2. Número de File (ej: CTFI107098)</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input 
                            placeholder="Ingresa número de file" 
                            {...field}
                            className={getFileNumberInputClasses()}
                            onChange={(e) => {
                              field.onChange(e);
                              if (fileSearchStatus !== "idle" && fileSearchStatus !== "searching") {
                                setFileSearchStatus("idle");
                                setFoundCellValue(null); 
                                setCurrentPaxCount(null);
                                setFileDataProps({ fileIdRowIndex: null, columnIndex: null });
                              }
                            }}
                          />
                        </FormControl>
                        <Button 
                          type="button" 
                          onClick={handleSearchFile} 
                          variant="default" 
                          size="icon" 
                          disabled={!selectedFile || !field.value || isProcessingSearch}
                          aria-label="Buscar File"
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          {isProcessingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                      <FormMessage />
                      {fileSearchStatus === "found" && foundCellValue && (
                        <div className="mt-2 p-2 border rounded-md bg-green-100 dark:bg-green-900 border-green-500 text-green-800 dark:text-green-200 text-sm">
                          <CheckCircle2 className="inline-block mr-2 h-4 w-4 align-middle text-green-700 dark:text-green-300" />
                          Nombre de file: <strong>{foundCellValue}</strong>
                        </div>
                      )}
                      {fileSearchStatus === "not_found" && (
                        <div className="flex items-center text-sm text-destructive mt-1">
                          <XCircle className="mr-1 h-4 w-4" /> File no encontrado.
                        </div>
                      )}
                       {fileSearchStatus === "error" && !isFileMissingError && form.getValues("fileNumber") && ( 
                        <div className="flex items-center text-sm text-destructive mt-1">
                          <XCircle className="mr-1 h-4 w-4" /> Error en la búsqueda.
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="guideName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>3. Nombre del Guía</FormLabel>
                      <FormControl>
                        <Input placeholder="Ingresa nombre del guía" {...field} className="bg-muted"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit"
                  className="w-full" 
                  disabled={isProcessingGeneration || !selectedFile || fileSearchStatus !== 'found' || !form.formState.isValid || !currentPaxCount || currentPaxCount === "N/A"}
                >
                  {isProcessingGeneration ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generando...</>
                  ) : (
                    "Generar" 
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {generatedReports.length > 0 && (
        <Card className="w-full shadow-lg mt-8"> 
          <CardHeader>
            <CardTitle className="text-xl font-headline text-center text-primary">Reportes Generados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">N°</TableHead>
                  <TableHead className="w-[120px]">File N°</TableHead>
                  <TableHead className="w-[130px]">Guía</TableHead>
                  <TableHead className="w-[30%]">Grupo</TableHead>
                  <TableHead className="w-[200px] text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedReports.map((report, index) => (
                  <TableRow 
                    key={report.id}
                    className={cn(
                      report.isDuplicateInstance 
                        ? "bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800" 
                        : "hover:bg-muted/50"
                    )}
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{report.fileNumber}</TableCell>
                    <TableCell>{report.guideName}</TableCell>
                    <TableCell className="w-[30%]">
                      {report.groupName}
                      {report.occurrenceCount > 1 ? ` (${report.occurrenceCount})` : ''}
                    </TableCell>
                    <TableCell className="w-[200px] text-center space-x-1 whitespace-nowrap">
                      <Button variant="default" size="icon" onClick={() => handleViewReport(report)} title="Visualizar" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="default" 
                        size="default"
                        onClick={() => {
                            if (currentReportInDialog && currentReportInDialog.id === report.id) {
                                // Si el diálogo está abierto para este reporte, intentar descargar desde ahí
                                // Esto es un placeholder, la descarga real está en el diálogo
                               const dialogDownloadButton = document.getElementById('dialog-download-excel');
                               if(dialogDownloadButton) dialogDownloadButton.click();
                               else toast({ title: "Próximamente", description: "Abre el reporte para descargar.", variant: "default" });
                            } else {
                                // Si no, mostrar "Próximamente" o manejar descarga directa si se implementa aquí
                                toast({ title: "Próximamente", description: "Abre el reporte para descargar o la descarga directa estará disponible pronto.", variant: "default" });
                            }
                        }}
                        title="Descargar" 
                        className="bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500"
                      >
                        <FileDown className="mr-2 h-4 w-4" /> Descargar
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteReport(report.id)} title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {currentReportInDialog && (
        <Dialog open={isResultsDialogOpen} onOpenChange={setIsResultsDialogOpen}>
          <ResultsDialogContent
            report={currentReportInDialog}
            onClose={() => setIsResultsDialogOpen(false)} 
          />
        </Dialog>
      )}
    </div>
  );
}
