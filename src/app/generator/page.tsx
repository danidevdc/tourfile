
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
import { Upload, Loader2, ArrowLeft } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  fileNumber: z.string().min(1, "File number is required."),
  guideName: z.string().min(1, "Guide name is required."),
});

type FormValues = z.infer<typeof formSchema>;

export default function GeneratorPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isFileMissingError, setIsFileMissingError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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
    } else {
      setSelectedFile(null);
    }
  };

  async function onSubmit(values: FormValues) {
    if (!selectedFile) {
      setIsFileMissingError(true);
      toast({
        title: "Error",
        description: "Por favor, sube un archivo de programa de turismo.",
        variant: "destructive",
      });
      return;
    }
    setIsFileMissingError(false);
    setIsProcessing(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    const queryParams = new URLSearchParams({
      fileNumber: values.fileNumber,
      guideName: values.guideName,
      fileName: selectedFile.name,
      groupName: "Grupo Ejemplo", 
      paxCount: "15", 
    });

    router.push(`/results?${queryParams.toString()}`);
    setIsProcessing(false); 
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-5rem)] p-4 bg-background pt-8"> {/* Adjusted justify-center to justify-start and added pt-8 */}
      <div className="w-full max-w-lg mb-4"> {/* Container for back button */}
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back" className="hover:bg-primary/90">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center text-primary">Generador de Cajas Chicas</CardTitle>
          <CardDescription className="text-center">
            Sube tu archivo de programa de turismo, ingresa los detalles y genera tu reporte.
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
                    className="w-full justify-start text-left font-normal"
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
                    <FormControl>
                      <Input placeholder="Ingresa número de file" {...field} />
                    </FormControl>
                    <FormMessage />
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

              <Button type="submit" className="w-full" disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
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
