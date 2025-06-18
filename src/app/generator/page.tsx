
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
  quantity: string; 
  detail: string;
  unitPrice: number;
  total: number; 
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
  startDate: string;
}

interface FileDataProps {
  fileIdRowIndex: number | null;
  columnIndex: number | null;
}

function resolveQuantity(quantityStr: string, paxNumber: number): number {
  if (paxNumber === 0 && quantityStr.toUpperCase().includes("G3")) return 0;
  if (!isNaN(Number(quantityStr))) {
    return Number(quantityStr);
  }

  const cleanedQuantity = quantityStr.toUpperCase().replace(/\s/g, '');
  const formulaWithPax = cleanedQuantity.replace(/(?<![A-Z])G3(?![0-9A-Z])|\$G\$3/g, String(paxNumber));


  if (formulaWithPax.startsWith('=')) {
    try {
      const expression = formulaWithPax.substring(1);
      if (/^[\d\s()+\-*/.]+$/.test(expression)) {
        // Ensure that the expression is safe before evaluating
        // For example, check for allowed characters or structure
        const result = new Function(`return ${expression}`)() as number;
        return isNaN(result) ? 1 : result; // Default to 1 if evaluation fails or results in NaN
      } else {
        // console.warn(`Fórmula de cantidad no segura o no válida: ${expression} (original: ${quantityStr})`);
        return 1; // Default if potentially unsafe
      }
    } catch (e) {
      // console.error(`Error evaluando cantidad "${quantityStr}" con expresión "${formulaWithPax.substring(1)}":`, e);
      return 1; // Default to 1 on error
    }
  }
  // console.warn(`Cantidad no reconocida: ${quantityStr}`);
  return 1; // Default if not a number or recognized formula
}


function generateExpenseDetails(
  excelData: any[][] | null,
  fileData: FileDataProps,
  paxCountString: string,
  groupName: string // Added groupName to potentially customize expenses further if needed
): { expenses: ExpenseItem[], tourStartDate: string } {

  const expenseItems: ExpenseItem[] = [];
  if (!excelData || fileData.columnIndex === null || fileData.fileIdRowIndex === null) {
    return { expenses: [], tourStartDate: "N/A" };
  }

  const columnIndex = fileData.columnIndex;
  const fileIdRowIndex = fileData.fileIdRowIndex; // This is the row where FILE ID (e.g., CTFI107098) was found

  // Attempt to parse PAX count safely
  const paxNum = parseInt(paxCountString, 10);
  if (isNaN(paxNum)) {
    console.error("Número de PAX no válido:", paxCountString);
    return { expenses: [], tourStartDate: "N/A" };
  }

  const guia = 1; // Standard quantity for guide-specific expenses

  // Extracting Tour Start Date more robustly
  let tourStartDate = "N/A";
  const fechaInicioRaw = excelData[fileIdRowIndex + 3]?.[columnIndex]; // Date is usually 3 rows below FILE ID row

  if (fechaInicioRaw instanceof Date) {
    tourStartDate = format(fechaInicioRaw, 'dd/MM/yy');
  } else if (typeof fechaInicioRaw === 'number') {
     // Excel date serial number
     const dateObj = XLSX.SSF.parse_date_code(fechaInicioRaw);
     if (dateObj) {
        // Month in JS Date is 0-indexed, SSF gives 1-indexed
        tourStartDate = format(new Date(dateObj.y, dateObj.m - 1, dateObj.d, dateObj.H || 0, dateObj.M || 0, dateObj.S || 0), 'dd/MM/yy');
     } else {
        // console.warn("No se pudo parsear el número de fecha de Excel:", fechaInicioRaw);
     }
  } else if (typeof fechaInicioRaw === 'string') {
    // Try parsing string date (less reliable, depends on format)
    try {
        // Attempt to parse common date formats or specific ones if known
        const parsedDate = new Date(fechaInicioRaw); // General purpose parsing
        if (!isNaN(parsedDate.valueOf())) { // Check if valid date
            tourStartDate = format(parsedDate, 'dd/MM/yy');
        } else {
            // Fallback for formats like dd.mm.yy or dd/mm/yy if new Date() fails
            const parts = fechaInicioRaw.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
            if (parts) {
                const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
                // Assuming day/month/year or month/day/year - be careful with regional formats
                // For dd/mm/yy:
                const parsedFromParts = new Date(`${year}-${parts[2]}-${parts[1]}`);
                 if (!isNaN(parsedFromParts.valueOf())) {
                    tourStartDate = format(parsedFromParts, 'dd/MM/yy');
                } else {
                    // console.warn("String de fecha no reconocido (formato especial):", fechaInicioRaw);
                }
            } else {
                 // console.warn("String de fecha no reconocido:", fechaInicioRaw);
            }
        }
    } catch(e){
        // console.warn("Error parseando string de fecha:", fechaInicioRaw, e);
    }
  }


  // Helper to check if a keyword exists in the specific column's data
  const columnData = excelData.map(row => String(row[columnIndex] || '').toLowerCase());

  const contiene = (keyword: string) => columnData.some(cell => cell.includes(keyword.toLowerCase()));

  // Define keywords for different expenses
  const contiene_desaguadero = contiene("desaguadero");
  const contiene_puno = contiene("Puno/Kasani"); // For Puno to Kasani (Bolivia to Peru)
  const contiene_isla = contiene("I.Sol") || contiene("Isla del Sol");
  const contiene_trf_in = contiene("CT-Private transfer from airport to hotel");
  const contiene_tiwa = contiene("Tiwanaku");
  const contiene_teleferico = contiene("Cable Car") || contiene("teleferico"); // teleférico
  const contiene_valle = contiene("Moon Valley") || contiene("valle de la luna");
  const contiene_city_continuado_am = contiene("AM"); // Check for AM to imply full day city tour needing lunch
  const contiene_kasani = contiene("Kasani/Puno"); // For Kasani to Puno (Peru to Bolivia)
  const contiene_trf_out = contiene("CT-Private transfer from hotel to airport");
  const contiene_aguas_ct_city_tour = contiene("CT-City Tour"); // Specific "CT-City Tour" for waters
  const contiene_city_tour_general = contiene("City Tour"); // General "City Tour" phrase

  // Add expenses based on keywords
  if (contiene_desaguadero) {
    const quantityStr = "=$G$3"; // Assumes G3 in Excel sheet holds PAX count
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "MALETAS FRONTERA", unitPrice: 3.00, total: resolveQuantity(quantityStr, paxNum) * 3.00 });
  }

  if (contiene_puno) { // Puno/Kasani -> from Bolivia to Peru
    const itemsPuno = [
      { quantityStr: String(guia), detail: "TAXI DOM - OFICINA", unitPrice: 30.00 },
      { quantityStr: String(guia), detail: "BUS LPB - COPA", unitPrice: 40.00 },
      { quantityStr: String(guia), detail: "DESAYUNO GUIA", unitPrice: 20.00 },
    ];
    itemsPuno.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  if (contiene_isla) {
    const itemsIsla = [
      { quantityStr: String(guia), detail: "TAXI DOM - HOTEL", unitPrice: 30.00 }, // Taxi to Hotel for Isla del Sol trip start
      { quantityStr: "=$G$3", detail: "ISLA DEL SOL", unitPrice: 10.00 },
      { quantityStr: "=$G$3", detail: "ISLA DE LA LUNA", unitPrice: 10.00 }, // Often visited together
    ];
    itemsIsla.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  if (contiene_trf_in) {
    const itemsTrfIn = [
      { quantityStr: String(guia), detail: "TAXI DOM - OFICINA", unitPrice: 30.00 }, // Guide's taxi to office for TRF IN
      { quantityStr: "=$G$3", detail: "MALETAS AEROPUERTO", unitPrice: 3.00 },
      { quantityStr: String(guia), detail: "TAXI HOTEL - DOM", unitPrice: 30.00 }, // Guide's taxi from hotel after TRF IN
    ];
    itemsTrfIn.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  if (contiene_tiwa) {
    const quantityStr = "=$G$3";
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "TIWANAKU", unitPrice: 100.00, total: resolveQuantity(quantityStr, paxNum) * 100.00 });
  }

  if (contiene_teleferico) {
    const quantityStr = "=$G$3+1"; // PAX + Guide
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "TELEFERICO", unitPrice: 7.00, total: resolveQuantity(quantityStr, paxNum) * 7.00 });
  }

  if (contiene_valle) {
    const quantityStr = "=$G$3";
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "VALLE", unitPrice: 20.00, total: resolveQuantity(quantityStr, paxNum) * 20.00 });
  }

  // Lunch for guide if City Tour is AM (implying a full day or continuing tour)
  if (contiene_city_continuado_am && contiene_city_tour_general) { // Ensure it's actually a city tour context
    const quantityStr = String(guia);
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "ALMUERZO GUIA", unitPrice: 35.00, total: resolveQuantity(quantityStr, paxNum) * 35.00 });
  }


  if (contiene_kasani) { // Kasani/Puno -> from Peru to Bolivia
     const itemsKasani = [
      { quantityStr: "=$G$3", detail: "MALETAS FRONTERA", unitPrice: 3.00 },
      { quantityStr: String(guia), detail: "BUS COPA - LPB", unitPrice: 40.00 }, // Guide's bus from Copacabana to La Paz
    ];
    itemsKasani.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  if (contiene_trf_out) {
    const itemsTrfOut = [
      { quantityStr: String(guia), detail: "TAXI DOM - HOTEL", unitPrice: 30.00 }, // Guide's taxi to hotel for TRF OUT
      { quantityStr: "=$G$3", detail: "MALETAS AEROPUERTO", unitPrice: 3.00 },
      { quantityStr: String(guia), detail: "TAXI CENTRO - DOM", unitPrice: 30.00 }, // Guide's taxi from city center/airport area to home
    ];
    itemsTrfOut.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  // Waters for "CT-City Tour"
  if (contiene_aguas_ct_city_tour) {
    let cantidadFormulaAguas = "=$G$3+2"; // PAX + Guide + Driver (common for private City Tours)
    // If Tiwanaku is also on the same day (often a combined tour), potentially more waters
    if (contiene_city_tour_general && contiene_tiwa) { // Check if it's a combined City Tour + Tiwanaku
        // This logic might need refinement based on how combined tours are listed.
        // Assuming waters are for both segments if listed together.
        cantidadFormulaAguas = "=($G$3+2)*2"; // Example: waters for city tour and waters for Tiwanaku part
    }
    expenseItems.push({
        date: "", // Waters are often bought as needed, date might not be fixed to start date
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

  const [foundCellValue, setFoundCellValue] = useState<string | null>(null); // Stores Group Name
  const [currentPaxCount, setCurrentPaxCount] = useState<string | null>(null);

  const [isFileMissingError, setIsFileMissingError] = useState(false);
  const [isProcessingSearch, setIsProcessingSearch] = useState(false);
  const [isProcessingGeneration, setIsProcessingGeneration] = useState(false);
  const [fileSearchStatus, setFileSearchStatus] = useState<FileSearchStatus>("idle");

  const [generatedReports, setGeneratedReports] = useState<GeneratedReportInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isResultsDialogOpen, setIsResultsDialogOpen] = useState(false);
  const [currentReportInDialog, setCurrentReportInDialog] = useState<GeneratedReportInfo | null>(null);
  const [isDownloadingReportId, setIsDownloadingReportId] = useState<string | null>(null);


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fileNumber: "",
      guideName: "",
    },
  });

  // Effect to reset dependent states when the Excel file changes or is cleared
  useEffect(() => {
    if (!selectedFile) {
      setExcelData(null);
      setFoundCellValue(null);
      setCurrentPaxCount(null);
      setFileSearchStatus("idle");
      setFileDataProps({ fileIdRowIndex: null, columnIndex: null });
      // Optionally, clear generated reports if the source file changes
      // if (generatedReports.length > 0) {
      //   // toast({ title: "Fuente Cambiada", description: "Los reportes generados anteriormente fueron basados en otro archivo." });
      // }
      // setGeneratedReports([]); // Uncomment to clear reports when file changes
      form.reset({ fileNumber: "", guideName: "" }); // Reset form fields related to search
    }
  }, [selectedFile, form, generatedReports.length]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    
    // If a file was already selected and a new one is chosen, or if selection is cancelled
    if (selectedFile || !file) {
        // Reset all related states as if clearing the file
        setSelectedFile(null); // This will trigger the useEffect above
    }

    if (file) {
      // Process the new file
      // Wrap in a microtask to ensure state updates from clearing are processed first
      Promise.resolve().then(() => {
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
            const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            // Ensure blank rows are truly ignored and nulls are used for empty cells
            const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: null });
            
            setExcelData(data);
            // Reset search-specific states, as they depend on the new file content
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
            handleClearFile(); // Clear all states if processing fails
          }
        };
        reader.onerror = (e) => {
          console.error("Error al leer el archivo:", e);
          toast({ title: "Error de Lectura", description: "Hubo un problema al leer el archivo.", variant: "destructive" });
          handleClearFile(); // Clear all states if reading fails
        };
        reader.readAsArrayBuffer(file);
      });
    }

    // Reset the input field's value to allow re-selecting the same file
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleClearFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear the file input
    }
    setSelectedFile(null); // This will trigger the useEffect to reset other states
    setIsFileMissingError(false); // Reset error state
    if (!isFileMissingError) { // Avoid double toast if already showing error
      toast({
        title: "Archivo Limpiado",
        description: "Se ha quitado el archivo de programa seleccionado.",
        variant: "default",
      });
    }
  };

  const getFileNumberInputClasses = (): string => {
    let baseClasses = "bg-muted"; // Default
    if (fileSearchStatus === "found") {
      baseClasses = "bg-green-100 dark:bg-green-900 border-green-500 text-green-800 dark:text-green-200 focus-visible:ring-green-500 dark:focus-visible:ring-green-500";
    } else if (fileSearchStatus === "not_found" || (fileSearchStatus === "error" && form.getValues("fileNumber"))) { // Only show red if there was a search term
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
      setFileSearchStatus("error"); // Set status to error but don't reset found cell value yet
      form.setError("fileNumber", { type: "manual", message: "Ingresa un número de file para buscar."});
      toast({ title: "Error de Búsqueda", description: "Ingresa un número de file para buscar.", variant: "destructive" });
      return;
    }

    setIsProcessingSearch(true);
    setFileSearchStatus("searching");
    // Don't reset foundCellValue and currentPaxCount immediately here, only if not found or new search
    // setFoundCellValue(null); 
    // setCurrentPaxCount(null);
    // setFileDataProps({ fileIdRowIndex: null, columnIndex: null });

    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate search delay

    let found = false;
    let colIdx = -1;
    let rowIdxWhereFileNumberFound = -1; // This is the row of the FILE ID itself.

    // Search logic (assuming excelData is [rows][columns])
    if (excelData && excelData.length > 0) {
      const numCols = excelData.reduce((max, row) => Math.max(max, row ? row.length : 0), 0);
      for (let j = 0; j < numCols; j++) { // Iterate columns
        for (let i = 0; i < excelData.length; i++) { // Iterate rows
          if (excelData[i] && excelData[i][j] !== undefined && excelData[i][j] !== null) {
             if (String(excelData[i][j]).trim().toUpperCase() === fileNumberToSearch.trim().toUpperCase()) {
              colIdx = j;
              rowIdxWhereFileNumberFound = i; // Store the row index where the FILE ID was found
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

      // Group Name is typically 1 row below the FILE ID
      const groupNameRaw = excelData[rowIdxWhereFileNumberFound + 1]?.[colIdx];
      const groupName = groupNameRaw !== undefined && groupNameRaw !== null ? String(groupNameRaw).trim() : "No encontrado";
      setFoundCellValue(groupName);

      // PAX count is typically 4 rows below the FILE ID
      const paxRaw = excelData[rowIdxWhereFileNumberFound + 4]?.[colIdx];
      const pax = paxRaw !== undefined && paxRaw !== null ? String(paxRaw).trim() : "N/A";
      setCurrentPaxCount(pax);

      setFileSearchStatus("found");
      toast({
        title: "Búsqueda Exitosa",
        description: `Nombre de file: ${groupName}`,
        variant: "default",
        className: "bg-green-100 dark:bg-green-900 border-green-500", // Custom success style
      });
    } else {
      setFileSearchStatus("not_found");
      setFoundCellValue(null); // Clear previous found data if not found
      setCurrentPaxCount(null);
      setFileDataProps({ fileIdRowIndex: null, columnIndex: null });
      toast({ title: "Búsqueda Fallida", description: `File "${fileNumberToSearch}" no encontrado.`, variant: "destructive" });
    }
    setIsProcessingSearch(false);
  };

  // Function to handle form submission for generating the report
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
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate generation delay

    const { expenses, tourStartDate } = generateExpenseDetails(
      excelData,
      fileDataProps, 
      currentPaxCount,
      foundCellValue // Pass group name
    );

    // Check if essential data for the report is missing
     if (tourStartDate === "N/A") {
         // Allow generation if some expenses exist or if it's a City Tour (which might not have a start date in the same way)
         if (expenses.length === 0 && !excelData[fileDataProps.fileIdRowIndex!].some((cell: any) => String(cell).toLowerCase().includes("ct-city tour"))) {
             toast({ title: "Error de Generación", description: "No se pudo determinar la fecha de inicio del tour. Verifica el archivo Excel.", variant: "destructive" });
             setIsProcessingGeneration(false);
             return;
         }
         // If it proceeds, it means it's likely a City Tour or has some expenses despite no clear start date
         toast({ title: "Advertencia de Generación", description: "No se pudo determinar la fecha de inicio del tour, se usará una fecha por defecto o estará vacía donde sea aplicable.", variant: "default" });
    }
    if (expenses.length === 0) {
        // This is more of a warning, as a report can still be generated with headers only
        toast({ title: "Advertencia de Generación", description: "No se generaron detalles de gastos. El reporte estará vacío o solo con cabeceras.", variant: "default" });
    }


    const currentInputFileNumber = values.fileNumber;
    const currentInputGuideName = values.guideName.toUpperCase(); // Standardize guide name for comparison

    // Check for duplicate report generation attempts (same File Number and Guide Name)
    const existingOccurrences = generatedReports.filter(
      report => report.fileNumber === currentInputFileNumber && report.guideName.toUpperCase() === currentInputGuideName
    ).length;

    const occurrenceCount = existingOccurrences + 1;
    const isDuplicateInstance = occurrenceCount > 1;

    // Create the new report object
    const newReport: GeneratedReportInfo = {
      id: new Date().toISOString() + Math.random().toString(36).substring(2, 9), // Unique ID
      fileNumber: currentInputFileNumber,
      guideName: currentInputGuideName,
      originalProgramFileName: selectedFile.name,
      groupName: foundCellValue, // From search
      paxCount: currentPaxCount, // From search
      generationDate: new Date(),
      occurrenceCount: occurrenceCount,
      isDuplicateInstance: isDuplicateInstance,
      expenseItems: expenses,
      startDate: tourStartDate, // From expense generation
    };

    setGeneratedReports(prev => [newReport, ...prev]); // Add to the beginning of the list

    // Reset form and search states for the next generation
    form.reset({ fileNumber: "", guideName: "" });
    setFileSearchStatus("idle");
    setFoundCellValue(null);
    setCurrentPaxCount(null);
    setFileDataProps({ fileIdRowIndex: null, columnIndex: null });

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

  // Function to handle downloading the report via API
  const handleApiExcelDownload = async (reportToDownload: GeneratedReportInfo) => {
    if (!reportToDownload) {
      toast({ title: "Error", description: "No hay información del reporte para descargar.", variant: "destructive" });
      return;
    }
    
    // Basic check for minimal data before attempting download
    if (reportToDownload.startDate === "N/A" && reportToDownload.paxCount === "N/A" && reportToDownload.expenseItems.length === 0) {
      toast({
          title: "Datos insuficientes",
          description: "El reporte no contiene suficiente información para generar un archivo útil.",
          variant: "destructive", 
      });
      return;
    }
    
    setIsDownloadingReportId(reportToDownload.id);
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay for UI update

    try {
      const response = await fetch('/api/generate-excel-python', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportToDownload), // Send the specific report data
      });

      if (!response.ok) {
        // Attempt to parse error details from the server response
        let errorDisplayMessage = "No se pudo generar el archivo Excel desde el servidor.";
        try {
          const errorData = await response.json();
          errorDisplayMessage = errorData.error || errorData.details || errorDisplayMessage;
          if (errorData.details && errorData.error) errorDisplayMessage = `${errorData.error}: ${errorData.details}`;
          console.error("API Error Data:", errorData);
        } catch (e) {
          // If response is not JSON, use status text or a generic message
          errorDisplayMessage = response.statusText || errorDisplayMessage;
          console.error("API Error (not JSON):", await response.text());
        }
        
        toast({
          title: `Error de Descarga (${response.status})`,
          description: errorDisplayMessage,
          variant: "destructive",
          duration: 10000, 
        });
        setIsDownloadingReportId(null);
        return;
      }

      // Success case: process the file download
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let fileName = "reporte_caja_chica.xlsx"; // Default filename

      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);
        if (fileNameMatch && fileNameMatch[1]) {
          fileName = fileNameMatch[1]; // Extracted filename from header
          // Clean the filename from potential issues from header parsing
          if (fileName.endsWith('"')) { // Remove trailing quote if any
            fileName = fileName.slice(0, -1);
          }
          if (fileName.endsWith('_')) { // Remove trailing underscore if any
             fileName = fileName.slice(0, -1);
          }
           // Ensure it ends with .xlsx
          if (!fileName.toLowerCase().endsWith('.xlsx')) {
            const dotIndex = fileName.lastIndexOf('.');
            if (dotIndex > 0) {
              fileName = fileName.substring(0, dotIndex) + '.xlsx';
            } else {
              fileName = fileName + '.xlsx';
            }
          }
        }
      }
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName; // Use the cleaned filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({
        title: "Descarga Iniciada",
        description: `El archivo ${fileName} ha comenzado a descargarse.`,
      });
    } catch (error) {
      console.error("Error descargando Excel vía API:", error);
      toast({ title: "Error de Descarga", description: "No se pudo conectar con el servidor para generar el archivo Excel.", variant: "destructive" });
    }
    setIsDownloadingReportId(null); // Reset download state
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
              {/* File Upload Section */}
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
                        : "bg-muted", // Default style when no file is selected
                      isFileMissingError && !selectedFile ? "border-destructive" : "" // Error style if file is required but not selected
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
                {isFileMissingError && !selectedFile && ( // Show error message if applicable
                     <p className="text-sm font-medium text-destructive mt-1">Por favor, selecciona un archivo para buscar.</p>
                )}
              </FormItem>

              {/* Form Fields for File Number and Guide Name */}
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
                            className={getFileNumberInputClasses()} // Dynamic classes based on search status
                            onChange={(e) => {
                              field.onChange(e);
                              // If user types, reset search status to allow new search, but keep old results visible until new search
                              if (fileSearchStatus !== "idle" && fileSearchStatus !== "searching") {
                                setFileSearchStatus("idle"); 
                                // Do not clear foundCellValue/currentPaxCount here, let handleSearchFile do it on a new search
                              }
                            }}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          onClick={handleSearchFile}
                          variant="default"
                          size="icon"
                          disabled={!selectedFile || !field.value || isProcessingSearch} // Disable if no file/value or searching
                          aria-label="Buscar File"
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          {isProcessingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                      <FormMessage /> {/* Displays Zod validation errors */}
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
                       {fileSearchStatus === "error" && !isFileMissingError && form.getValues("fileNumber") && ( // Show error if search term exists
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

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isProcessingGeneration || !selectedFile || fileSearchStatus !== 'found' || !form.formState.isValid || !currentPaxCount || currentPaxCount === "N/A"}
                >
                  {isProcessingGeneration ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generando...</>
                  ) : (
                    "Generar y Añadir a Lista"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Generated Reports Table */}
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
                  <TableHead className="w-[30%]">Grupo</TableHead> {/* Adjusted width */}
                  <TableHead className="w-[200px] text-center">Acciones</TableHead> {/* Adjusted width for actions */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedReports.map((report, index) => (
                  <TableRow
                    key={report.id}
                    className={cn(
                      report.isDuplicateInstance // Highlight duplicate generations
                        ? "bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800" // Custom style for duplicates
                        : "hover:bg-muted/50" // Standard hover
                    )}
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{report.fileNumber}</TableCell>
                    <TableCell>{report.guideName}</TableCell>
                    <TableCell className="w-[30%]"> {/* Ensure this width matches header */}
                      {report.groupName}
                      {report.occurrenceCount > 1 ? ` (${report.occurrenceCount})` : ''}
                    </TableCell>
                    <TableCell className="w-[200px] text-center space-x-1 whitespace-nowrap"> {/* Ensure this width matches header */}
                      <Button variant="default" size="icon" onClick={() => handleViewReport(report)} title="Visualizar" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="default"
                        size="default" // Changed from icon to default to fit text
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
                         Descargar {/* Text added */}
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

      {/* Dialog for Viewing Report Details */}
      {currentReportInDialog && (
        <Dialog open={isResultsDialogOpen} onOpenChange={setIsResultsDialogOpen}>
          <ResultsDialogContent
            report={currentReportInDialog}
            onClose={() => setIsResultsDialogOpen(false)}
            onDownloadExcel={handleApiExcelDownload} // Pass the download handler
          />
        </Dialog>
      )}
    </div>
  );
}

