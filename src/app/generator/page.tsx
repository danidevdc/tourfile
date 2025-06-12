
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useRef } from "react";
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
import { Upload, Loader2, ArrowLeft, Search, CheckCircle2, XCircle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  fileNumber: z.string().min(1, "File number is required."),
  guideName: z.string().min(1, "Guide name is required."),
});

type FormValues = z.infer<typeof formSchema>;

type FileSearchStatus = "idle" | "searching" | "found" | "not_found" | "error";

export default function GeneratorPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any[][] | null>(null); 
  const [foundColumnIndex, setFoundColumnIndex] = useState<number | null>(null);
  const [foundCellValue, setFoundCellValue] = useState<string | null>(null); 
  const [isFileMissingError, setIsFileMissingError] = useState(false);
  const [isProcessingGeneration, setIsProcessingGeneration] = useState(false);
  const [fileSearchStatus, setFileSearchStatus] = useState<FileSearchStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fileNumber: "",
      guideName: "",
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      setIsFileMissingError(false);
      setFileSearchStatus("idle"); 
      form.setValue("fileNumber", ""); 
      setExcelData(null); 
      setFoundColumnIndex(null);
      setFoundCellValue(null);
      toast({
        title: "Archivo Seleccionado",
        description: file.name,
        variant: "default",
      });
    } else {
      setSelectedFile(null);
      setExcelData(null);
      setFoundColumnIndex(null);
      setFoundCellValue(null);
    }
  };

  const handleSearchFile = async () => {
    const fileNumber = form.getValues("fileNumber").trim();
    if (!selectedFile) {
      toast({
        title: "Error de Búsqueda",
        description: "Por favor, primero sube un archivo de programa.",
        variant: "destructive",
      });
      return;
    }
    if (!fileNumber) {
      toast({
        title: "Error de Búsqueda",
        description: "Por favor, ingresa un número de file para buscar.",
        variant: "destructive",
      });
      return;
    }

    setFileSearchStatus("searching");
    setExcelData(null); 
    setFoundColumnIndex(null);
    setFoundCellValue(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result;
        if (!arrayBuffer) {
          throw new Error("Error al leer el archivo.");
        }
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
        
        setExcelData(data); 

        let found = false;
        let colIdx = -1;
        let cellValueForName = null;

        if (data && data.length > 0) {
          const numCols = data.reduce((max, row) => Math.max(max, row.length), 0);

          for (let j = 0; j < numCols; j++) { 
            for (let i = 0; i < data.length; i++) { 
              if (data[i] && data[i][j] !== undefined && data[i][j] !== null) {
                if (String(data[i][j]).trim().includes(fileNumber)) {
                  colIdx = j;
                  // Try to get the value from the cell below
                  if (i + 1 < data.length && data[i+1] && data[i+1][j] !== undefined && data[i+1][j] !== null) {
                    cellValueForName = String(data[i+1][j]).trim();
                  } else {
                    cellValueForName = "No se encontró nombre debajo del file.";
                  }
                  found = true;
                  break; 
                }
              }
            }
            if (found) break; 
          }
        }

        if (found) {
          setFoundColumnIndex(colIdx);
          setFoundCellValue(cellValueForName);
          setFileSearchStatus("found");
          toast({
            title: "Búsqueda Exitosa",
            description: `File "${fileNumber}" encontrado en la columna ${colIdx + 1}.`,
            variant: "default",
            className: "bg-green-100 dark:bg-green-900 border-green-500",
          });
        } else {
          setFileSearchStatus("not_found");
          toast({
            title: "Búsqueda Fallida",
            description: `File "${fileNumber}" no encontrado en el archivo.`,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error al procesar el archivo Excel:", error);
        setFileSearchStatus("error");
        toast({
          title: "Error de Procesamiento",
          description: "No se pudo procesar el archivo Excel. Asegúrate de que sea un formato válido.",
          variant: "destructive",
        });
      }
    };
    reader.onerror = (e) => {
      console.error("Error al leer el archivo:", e);
      setFileSearchStatus("error");
      toast({
        title: "Error de Lectura",
        description: "Hubo un problema al leer el archivo.",
        variant: "destructive",
      });
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  async function onSubmit(values: FormValues) {
    if (!selectedFile) {
      setIsFileMissingError(true);
      toast({
        title: "Error de Generación",
        description: "Por favor, sube un archivo de programa de turismo.",
        variant: "destructive",
      });
      return;
    }
    if (fileSearchStatus !== "found" || excelData === null || foundColumnIndex === null) {
       toast({
        title: "Error de Generación",
        description: "Por favor, busca y confirma el número de file antes de generar. Asegúrate que el file fue encontrado en el archivo.",
        variant: "destructive",
      });
      return;
    }

    setIsFileMissingError(false);
    setIsProcessingGeneration(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    const queryParams = new URLSearchParams({
      fileNumber: values.fileNumber,
      guideName: values.guideName,
      fileName: selectedFile.name, 
      groupName: foundCellValue || "Grupo Ejemplo (desde Excel)", 
      paxCount: "10 (desde Excel)", // Placeholder, will be extracted later
    });
    
    router.push(`/results?${queryParams.toString()}`);
    setIsProcessingGeneration(false); 
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8">
      <div className="w-full max-w-lg mb-4">
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back" className="hover:bg-primary/90">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center text-primary">Generador de Cajas Chicas</CardTitle>
          <CardDescription className="text-center">
            Sube tu archivo de programa, ingresa los detalles y genera tu reporte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormItem>
                <FormLabel>Archivo de Programa de Turismo Mensual</FormLabel>
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      selectedFile && "bg-green-100 dark:bg-green-900 border-green-500 hover:bg-green-200 dark:hover:bg-green-800 text-green-800 dark:text-green-200"
                    )}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {selectedFile ? selectedFile.name : "Seleccionar archivo (.xlsx, .xls)"}
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  />
                </div>
                {isFileMissingError && (
                     <p className="text-sm font-medium text-destructive">Por favor, selecciona un archivo.</p>
                )}
              </FormItem>

              <FormField
                control={form.control}
                name="fileNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de File (ej: CTFI107098)</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input 
                          placeholder="Ingresa número de file" 
                          {...field} 
                          className={cn(
                            fileSearchStatus === "found" && "bg-green-100 dark:bg-green-900 border-green-500 text-green-800 dark:text-green-200 focus-visible:ring-green-500"
                          )}
                          onChange={(e) => {
                            field.onChange(e);
                            if (fileSearchStatus !== "idle" && fileSearchStatus !== "searching") {
                              setFileSearchStatus("idle"); 
                              setFoundColumnIndex(null);
                              setFoundCellValue(null);
                            }
                          }}
                        />
                      </FormControl>
                      <Button 
                        type="button" 
                        onClick={handleSearchFile} 
                        variant="outline" 
                        size="icon" 
                        disabled={!selectedFile || !field.value || fileSearchStatus === "searching"}
                        aria-label="Buscar File"
                      >
                        {fileSearchStatus === "searching" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                    <FormMessage />
                    {fileSearchStatus === "found" && foundCellValue && (
                      <div className="mt-2">
                        <FormLabel htmlFor="foundValueDisplay" className="text-sm">Nombre del File:</FormLabel>
                        <div 
                          id="foundValueDisplay"
                          className="mt-1 p-2 border rounded-md bg-green-100 dark:bg-green-900 border-green-500 text-green-800 dark:text-green-200 text-sm"
                        >
                          <FileText className="inline-block mr-2 h-4 w-4 align-middle" />
                          {foundCellValue}
                        </div>
                      </div>
                    )}
                    {fileSearchStatus === "found" && !foundCellValue && (
                       <div className="flex items-center text-sm text-green-600 dark:text-green-400 mt-1">
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        File encontrado. No se encontró nombre debajo.
                      </div>
                    )}
                    {fileSearchStatus === "not_found" && (
                      <div className="flex items-center text-sm text-destructive mt-1">
                        <XCircle className="mr-1 h-4 w-4" />
                        File no encontrado. Verifica el número o el archivo.
                      </div>
                    )}
                     {fileSearchStatus === "error" && (
                      <div className="flex items-center text-sm text-destructive mt-1">
                        <XCircle className="mr-1 h-4 w-4" />
                        Error al buscar el file. Intenta con otro archivo o verifica el formato.
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
                    <FormLabel>Nombre del Guía Turístico</FormLabel>
                    <FormControl>
                      <Input placeholder="Ingresa nombre del guía" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isProcessingGeneration || fileSearchStatus !== 'found'}>
                {isProcessingGeneration ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  "Generate File"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

    