
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { Upload, Loader2, ArrowLeft, Search, CheckCircle2, XCircle } from "lucide-react";
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
      setSelectedFile(event.target.files[0]);
      setIsFileMissingError(false);
      setFileSearchStatus("idle"); // Reset search status on new file
      form.setValue("fileNumber", ""); // Reset file number input
      toast({
        title: "Archivo Seleccionado",
        description: event.target.files[0].name,
        variant: "default",
      });
    } else {
      setSelectedFile(null);
    }
  };

  const handleSearchFile = async () => {
    const fileNumber = form.getValues("fileNumber");
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
    // Simulate API call or actual file processing
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    // SIMULATED LOGIC: Replace with actual Excel parsing and search in future steps
    if (fileNumber === "CTFI107098" || fileNumber.includes("found")) { // Example successful search
      setFileSearchStatus("found");
    } else {
      setFileSearchStatus("not_found");
    }
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
    if (fileSearchStatus !== "found") {
       toast({
        title: "Error de Generación",
        description: "Por favor, busca y confirma el número de file antes de generar.",
        variant: "destructive",
      });
      return;
    }

    setIsFileMissingError(false);
    setIsProcessingGeneration(true);
    
    // Simulate generation process
    await new Promise(resolve => setTimeout(resolve, 1000));

    const queryParams = new URLSearchParams({
      fileNumber: values.fileNumber,
      guideName: values.guideName,
      fileName: selectedFile.name, // Keep passing file name for now
      groupName: "Grupo Ejemplo (desde Excel)", // This will come from Excel data later
      paxCount: "10 (desde Excel)", // This will come from Excel data later
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
                      selectedFile && "bg-green-100 dark:bg-green-900 border-green-500 hover:bg-green-200 dark:hover:bg-green-800"
                    )}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {selectedFile ? selectedFile.name : "Seleccionar archivo"}
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".xlsx,.xls"
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
                          onChange={(e) => {
                            field.onChange(e);
                            if (fileSearchStatus !== "idle" && fileSearchStatus !== "searching") {
                              setFileSearchStatus("idle"); // Reset search if user types again
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
                    {fileSearchStatus === "found" && (
                      <div className="flex items-center text-sm text-green-600 dark:text-green-400 mt-1">
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        File encontrado.
                      </div>
                    )}
                    {fileSearchStatus === "not_found" && (
                      <div className="flex items-center text-sm text-destructive mt-1">
                        <XCircle className="mr-1 h-4 w-4" />
                        File no encontrado. Verifica el número o el archivo.
                      </div>
                    )}
                     {fileSearchStatus === "error" && ( // Though not used in simulation, good to have
                      <div className="flex items-center text-sm text-destructive mt-1">
                        <XCircle className="mr-1 h-4 w-4" />
                        Error al buscar el file.
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
