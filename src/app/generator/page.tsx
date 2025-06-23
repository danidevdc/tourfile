
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import JSZip from 'jszip';

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, ArrowLeft, Search, CheckCircle2, XCircle, Eye, FileDown, Trash2, Files } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
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
import { ResultsDialogContent } from "@/components/report/ResultsDialogContent";
import { 
  generateExpenseDetails, 
  type GeneratedReportInfo, 
  type FileDataProps,
  type FileSearchStatus 
} from "@/lib/report-generator";


const formSchema = z.object({
  fileNumber: z.string().min(1, "El número de file es requerido."),
  guideName: z.string().min(1, "El nombre del guía es requerido."),
});

type FormValues = z.infer<typeof formSchema>;


export default function GeneratorPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any[][] | null>(null);
  const [fileDataProps, setFileDataProps] = useState<FileDataProps>({ fileIdRowIndex: null, columnIndex: null });

  const [foundCellValue, setFoundCellValue] = useState<string | null>(null); // Stores Group Name
  const [currentPaxCount, setCurrentPaxCount] = useState<string | null>(null);

  const [isFileMissingError, setIsFileMissingError] = useState(false);
  const [isProcessingSearch, setIsProcessingSearch] = useState(false);
  const [fileSearchStatus, setFileSearchStatus] = useState<FileSearchStatus>("idle");

  const [generatedReports, setGeneratedReports] = useState<GeneratedReportInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isResultsDialogOpen, setIsResultsDialogOpen] = useState(false);
  const [currentReportInDialog, setCurrentReportInDialog] = useState<GeneratedReportInfo | null>(null);
  const [isDownloadingReportId, setIsDownloadingReportId] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isClearListAlertOpen, setIsClearListAlertOpen] = useState(false);


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
    }
  }, [selectedFile, form]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    
    if (selectedFile || !file) {
        setSelectedFile(null);
    }

    if (file) {
      Promise.resolve().then(() => {
        setSelectedFile(file);
        setIsFileMissingError(false);
        toast({
          title: "Archivo Seleccionado",
          description: file.name,
          className: "bg-green-100 dark:bg-green-900 border-green-500",
        });

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const arrayBuffer = e.target?.result;
            if (!arrayBuffer) throw new Error("Error al leer el archivo.");
            const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: null });
            
            setExcelData(data);
            setFileSearchStatus("idle");
            setFoundCellValue(null);
            setCurrentPaxCount(null);
            setFileDataProps({ fileIdRowIndex: null, columnIndex: null });
            
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
      });
    }

    if (event.target) {
      event.target.value = "";
    }
  };

  const handleClearFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSelectedFile(null);
    setIsFileMissingError(false);
    if (!isFileMissingError) {
      toast({
        title: "Archivo Limpiado",
        description: "Se ha quitado el archivo de programa seleccionado.",
      });
    }
  };

  const handleClearList = () => {
    setGeneratedReports([]);
    setIsClearListAlertOpen(false);
    toast({
      title: "Lista Limpiada",
      description: "Todos los reportes generados han sido eliminados de la lista.",
      className: "bg-green-100 dark:bg-green-900 border-green-500",
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

    await new Promise(resolve => setTimeout(resolve, 300));

    let found = false;
    let colIdx = -1;
    let rowIdxWhereFileNumberFound = -1;

    if (excelData && excelData.length > 0) {
      const numCols = excelData.reduce((max, row) => Math.max(max, row ? row.length : 0), 0);
      for (let j = 0; j < numCols; j++) {
        for (let i = 0; i < excelData.length; i++) {
          if (excelData[i] && excelData[i][j] !== undefined && excelData[i][j] !== null) {
             if (String(excelData[i][j]).trim().toUpperCase() === fileNumberToSearch.trim().toUpperCase()) {
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

      const groupNameRaw = excelData[rowIdxWhereFileNumberFound + 1]?.[colIdx];
      const groupName = groupNameRaw !== undefined && groupNameRaw !== null ? String(groupNameRaw).trim() : "No encontrado";
      setFoundCellValue(groupName);

      // --- Nueva lógica dinámica para encontrar fecha y PAX ---
      let dateRowIndex = -1;
      let dateFound = false;

      for (let i = rowIdxWhereFileNumberFound; i < excelData.length; i++) {
          const cellValue = excelData[i]?.[colIdx];
          if (!cellValue) continue;

          let parsedDateObj: Date | null = null;
          if (cellValue instanceof Date) {
              parsedDateObj = cellValue;
          } else if (typeof cellValue === 'number' && cellValue > 25569) { // Excel serial date check
              const parsed = XLSX.SSF.parse_date_code(cellValue);
              if (parsed) {
                  parsedDateObj = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0);
              }
          }

          if (parsedDateObj && !isNaN(parsedDateObj.valueOf())) {
              dateFound = true;
              dateRowIndex = i;
              break; // Encontramos la primera fecha válida y la usamos
          }
      }

      if (dateFound) {
          const paxRaw = excelData[dateRowIndex + 1]?.[colIdx];
          const pax = (paxRaw !== null && paxRaw !== undefined) ? String(paxRaw).trim() : "N/A";
          setCurrentPaxCount(pax);
          setFileSearchStatus("found");
          toast({
            title: "Búsqueda Exitosa",
            description: `Nombre de file: ${groupName}`,
            className: "bg-green-100 dark:bg-green-900 border-green-500",
          });
      } else {
          setFileSearchStatus("not_found");
          setCurrentPaxCount(null);
          toast({ title: "Búsqueda Parcial", description: `File encontrado, pero no se pudo localizar la fecha o el N° de PAX.`, variant: "destructive" });
      }
      // --- Fin de la nueva lógica ---

    } else {
      setFileSearchStatus("not_found");
      setFoundCellValue(null);
      setCurrentPaxCount(null);
      setFileDataProps({ fileIdRowIndex: null, columnIndex: null });
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
       toast({ title: "Error", description: "Busca y confirma el file antes de generar. Asegúrate que se extrajo el nombre y el número de PAX.", variant: "destructive" });
      return;
    }

    if (currentPaxCount === "N/A" || isNaN(parseInt(currentPaxCount, 10))) {
        toast({ title: "Error de Datos", description: "El número de PAX no es válido o no fue encontrado. Verifica el archivo Excel y la búsqueda del file.", variant: "destructive" });
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

     if (tourStartDate === "N/A") {
         if (expenses.length === 0 && !excelData[fileDataProps.fileIdRowIndex!].some((cell: any) => String(cell).toLowerCase().includes("ct-city tour"))) {
             toast({ title: "Error de Generación", description: "No se pudo determinar la fecha de inicio del tour. Verifica el archivo Excel.", variant: "destructive" });
             setIsProcessingGeneration(false);
             return;
         }
         toast({ title: "Advertencia de Generación", description: "No se pudo determinar la fecha de inicio del tour, se usará una fecha por defecto o estará vacía donde sea aplicable.", variant: "default" });
    }
    if (expenses.length === 0) {
        toast({ title: "Advertencia de Generación", description: "No se generaron detalles de gastos. El reporte estará vacío o solo con cabeceras.", variant: "default" });
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

    setGeneratedReports(prev => [...prev, newReport].sort((a, b) => a.generationDate.getTime() - b.generationDate.getTime()));
    form.reset({ fileNumber: "", guideName: "" });
    setFileSearchStatus("idle");
    setFoundCellValue(null);
    setCurrentPaxCount(null);
    setFileDataProps({ fileIdRowIndex: null, columnIndex: null });

    toast({
      title: "Reporte Añadido",
      description: `Se añadió el reporte para el file ${newReport.fileNumber} a la lista.`,
      className: "bg-green-100 dark:bg-green-900 border-green-500",
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
      className: "bg-green-100 dark:bg-green-900 border-green-500",
    });
  };

  const handleApiExcelDownload = async (report: GeneratedReportInfo) => {
    setIsDownloadingReportId(report.id);
    try {
      const response = await fetch('/api/generate-excel-python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to generate Excel file');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `reporte_${report.fileNumber}.xlsx`; // fallback
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/i);
        if (match && match[1]) {
          filename = match[1];
        }
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Descarga Exitosa',
        description: `Se descargó el reporte para el file ${report.fileNumber}.`,
        className: 'bg-green-100 dark:bg-green-900 border-green-500',
      });
      
    } catch (error) {
      console.error('Error downloading Excel file:', error);
      toast({
        title: 'Error de Descarga',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingReportId(null);
    }
  };

  const handleDownloadAll = async () => {
    if (generatedReports.length < 2) return;
    setIsDownloadingAll(true);
    toast({
        title: "Iniciando Compresión",
        description: `Preparando ${generatedReports.length} reportes...`,
        duration: 3000
    });

    const zip = new JSZip();

    try {
        const filePromises = generatedReports.map(async (report) => {
            const response = await fetch('/api/generate-excel-python', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(report),
            });

            if (!response.ok) {
                throw new Error(`Fallo al generar el reporte para el file ${report.fileNumber}`);
            }

            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            let fileName = `reporte_${report.fileNumber}.xlsx`; // fallback
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="([^"]+)"/i);
                if (match && match[1]) {
                    fileName = match[1];
                }
            }
            return { fileName, blob };
        });

        const files = await Promise.all(filePromises);

        files.forEach(file => {
            zip.file(file.fileName, file.blob);
        });

        const zipBlob = await zip.generateAsync({ type: "blob" });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
        link.download = `Reportes_Caja_Chica_${timestamp}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        toast({
            title: "Descarga Completa",
            description: `El archivo .zip con ${files.length} reportes ha sido descargado.`,
            className: "bg-green-100 dark:bg-green-900 border-green-500",
        });

    } catch (error) {
        console.error("Error al descargar todos los reportes:", error);
        toast({
            title: "Error en Descarga Múltiple",
            description: (error as Error).message || "No se pudieron descargar todos los reportes.",
            variant: "destructive",
        });
    } finally {
        setIsDownloadingAll(false);
    }
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
                      <FormLabel>Número de File</FormLabel>
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
                           {currentPaxCount && currentPaxCount !== "N/A" && <span className="ml-2"> (PAX: <strong>{currentPaxCount}</strong>)</span>}
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
                      <FormLabel>Nombre del Guía</FormLabel>
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
        <Card className="w-full shadow-lg mt-8 max-w-3xl">
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
                        onClick={() => handleApiExcelDownload(report)}
                        disabled={isDownloadingReportId === report.id}
                        title="Descargar Excel"
                        className="bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500"
                      >
                        {isDownloadingReportId === report.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FileDown className="mr-2 h-4 w-4" />
                        )}
                         Descargar
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
          {generatedReports.length >= 2 && (
            <CardFooter className="p-6 pt-4 border-t flex justify-end gap-2">
                <Button
                  onClick={handleDownloadAll}
                  disabled={isDownloadingAll}
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10 hover:text-primary"
                >
                  {isDownloadingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Files className="mr-2 h-4 w-4" />}
                  Descargar Todo
                </Button>
                <AlertDialog open={isClearListAlertOpen} onOpenChange={setIsClearListAlertOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Limpiar Lista
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción eliminará los {generatedReports.length} reportes de la lista. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearList} className="bg-destructive hover:bg-destructive/90">
                          Sí, limpiar lista
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
          )}
        </Card>
      )}

      {currentReportInDialog && (
        <Dialog open={isResultsDialogOpen} onOpenChange={setIsResultsDialogOpen}>
          <ResultsDialogContent
            report={currentReportInDialog}
            onClose={() => setIsResultsDialogOpen(false)}
            onDownloadExcel={handleApiExcelDownload}
          />
        </Dialog>
      )}
    </div>
  );
}


    