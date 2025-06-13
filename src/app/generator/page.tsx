
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from 'xlsx'; 

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

const formSchema = z.object({
  fileNumber: z.string().min(1, "El número de file es requerido."),
  guideName: z.string().min(1, "El nombre del guía es requerido."),
});

type FormValues = z.infer<typeof formSchema>;
type FileSearchStatus = "idle" | "searching" | "found" | "not_found" | "error";

interface GeneratedReportInfo {
  id: string;
  fileNumber: string;
  guideName: string; 
  originalProgramFileName: string;
  groupName: string; 
  paxCount: string;
  generationDate: Date;
  occurrenceCount: number;
  isDuplicateInstance: boolean;
}


export default function GeneratorPage() {
  const { toast } = useToast();
  const router = useRouter();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any[][] | null>(null); 


  const [foundColumnIndex, setFoundColumnIndex] = useState<number | null>(null);
  const [foundCellValue, setFoundCellValue] = useState<string | null>(null); 
  const [currentPaxCount, setCurrentPaxCount] = useState<string | null>(null);

  const [isFileMissingError, setIsFileMissingError] = useState(false); 
  const [isProcessingSearch, setIsProcessingSearch] = useState(false);
  const [isProcessingGeneration, setIsProcessingGeneration] = useState(false);
  const [fileSearchStatus, setFileSearchStatus] = useState<FileSearchStatus>("idle");
  
  const [generatedReports, setGeneratedReports] = useState<GeneratedReportInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fileNumber: "",
      guideName: "",
    },
  });

  useEffect(() => {
    if (selectedFile) {
      setIsFileMissingError(false); 
    } else {
      // This else block handles reset when selectedFile becomes null (e.g., via handleClearFile)
      setExcelData(null);
      setFoundColumnIndex(null);
      setFoundCellValue(null);
      setCurrentPaxCount(null);
      setFileSearchStatus("idle");
      form.reset({ fileNumber: "", guideName: "" });
      setGeneratedReports([]); // Clear reports when the main file is cleared
    }
  }, [selectedFile, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      
      // Reset all relevant states before processing the new file
      setSelectedFile(null); // Temporarily set to null to trigger useEffect if the same file is re-selected
      setExcelData(null);
      setFoundColumnIndex(null);
      setFoundCellValue(null);
      setCurrentPaxCount(null);
      setFileSearchStatus("idle");
      form.reset({ fileNumber: "", guideName: "" }); 
      setGeneratedReports([]);
      setIsFileMissingError(false); 

      setSelectedFile(file); // Set the new file

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
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
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
          if (fileInputRef.current) {
            fileInputRef.current.value = ""; 
          }
          setSelectedFile(null); 
        }
      };
      reader.onerror = (e) => {
        console.error("Error al leer el archivo:", e);
        toast({ title: "Error de Lectura", description: "Hubo un problema al leer el archivo.", variant: "destructive" });
        if (fileInputRef.current) {
            fileInputRef.current.value = ""; 
        }
        setSelectedFile(null); 
      };
      reader.readAsArrayBuffer(file);

    } else {
      // This case handles if the user cancels the file dialog after a file was already selected.
      // Or if no file is selected from the dialog.
      if (selectedFile) { // If a file was previously selected, clear it.
        handleClearFile();
      }
    }
  };

  const handleClearFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
    setSelectedFile(null); // This will trigger the useEffect to reset other states.
    setIsFileMissingError(false); 
    
    toast({
      title: "Archivo Limpiado",
      description: "Se ha quitado el archivo de programa seleccionado.",
      variant: "default",
    });
  };
  
  const getFileNumberInputClasses = (): string => {
    if (fileSearchStatus === "found") {
      return "bg-green-100 dark:bg-green-900 border-green-500 text-green-800 dark:text-green-200 focus-visible:ring-green-500 dark:focus-visible:ring-green-500";
    } else if (fileSearchStatus === "not_found" || fileSearchStatus === "error") {
      return "bg-red-100 dark:bg-red-900 border-destructive text-destructive focus-visible:ring-destructive dark:focus-visible:ring-destructive";
    }
    return "bg-muted"; // For "idle" or "searching"
  };
  

  const handleSearchFile = async () => {
    const fileNumberToSearch = form.getValues("fileNumber");
    if (!selectedFile || !excelData) {
      setIsFileMissingError(true); 
      toast({ title: "Error de Búsqueda", description: "Sube y procesa un archivo de programa primero.", variant: "destructive" });
      setFileSearchStatus("error");
      return;
    }
    setIsFileMissingError(false); 

    if (!fileNumberToSearch) {
      toast({ title: "Error de Búsqueda", description: "Ingresa un número de file para buscar.", variant: "destructive" });
      setFileSearchStatus("error"); 
      return;
    }

    setIsProcessingSearch(true);
    setFileSearchStatus("searching");
    setFoundCellValue(null);
    setCurrentPaxCount(null);
    setFoundColumnIndex(null);
    
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
      setFoundColumnIndex(colIdx);
      
      const groupName = (excelData[rowIdxWhereFileNumberFound + 1] && excelData[rowIdxWhereFileNumberFound + 1][colIdx] !== undefined) 
                        ? String(excelData[rowIdxWhereFileNumberFound + 1][colIdx]).trim() 
                        : "No se encontró nombre debajo del file.";
      setFoundCellValue(groupName);

      const pax = (excelData[4] && excelData[4][colIdx] !== undefined) 
                  ? String(excelData[4][colIdx]).trim() 
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

    if (fileSearchStatus !== "found" || !foundCellValue || !currentPaxCount) {
       toast({ title: "Error", description: "Busca y confirma el file antes de generar. Asegúrate que se extrajo el nombre.", variant: "destructive" });
      return;
    }

    setIsProcessingGeneration(true);
    await new Promise(resolve => setTimeout(resolve, 300)); 

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
    };

    setGeneratedReports(prev => [...prev, newReport]);
    
    form.reset({ fileNumber: "", guideName: "" }); 
    setFileSearchStatus("idle");
    
    toast({
      title: "Reporte Añadido",
      description: `Se añadió el reporte para el file ${newReport.fileNumber} a la lista.`,
    });
    setIsProcessingGeneration(false);
  }

  const handleViewReport = (report: GeneratedReportInfo) => {
    const displayGroupName = report.occurrenceCount > 1 
      ? `${report.groupName} (${report.occurrenceCount})` 
      : report.groupName;

    const queryParams = new URLSearchParams({
      fileNumber: report.fileNumber,
      guideName: report.guideName,
      fileName: report.originalProgramFileName, 
      groupName: displayGroupName,
      paxCount: report.paxCount,
    });
    router.push(`/results?${queryParams.toString()}`);
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
                       {fileSearchStatus === "error" && !isFileMissingError && ( // Only show if not file missing error
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
                  disabled={isProcessingGeneration || !selectedFile || fileSearchStatus !== 'found' || !form.formState.isValid}
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
                  <TableHead>File N°</TableHead>
                  <TableHead>Guía</TableHead>
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
                      <Button variant="outline" onClick={() => toast({ title: "Próximamente", description: "La descarga estará disponible pronto.", variant: "default" })} title="Descargar" className="bg-green-600 hover:bg-green-700 text-white border-green-600 px-3 py-2 h-auto text-sm">
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
    </div>
  );
}
    

    

      

    

  



    

    
