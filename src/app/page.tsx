"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useRef, useEffect } from "react";
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
import { Upload, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  fileNumber: z.string().min(1, "File number is required."),
  guideName: z.string().min(1, "Guide name is required."),
});

type FormValues = z.infer<typeof formSchema>;

export default function TourFileProcessorPage() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isFileMissingError, setIsFileMissingError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedExcelData, setGeneratedExcelData] = useState<Blob | null>(null);
  const [generatedFileName, setGeneratedFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effect to handle client-side specific logic like Date
  const [currentDate, setCurrentDate] = useState('');
  useEffect(() => {
    setCurrentDate(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  }, []);


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
      setGeneratedExcelData(null); 
      setGeneratedFileName("");
    } else {
      setSelectedFile(null);
    }
  };

  async function onSubmit(values: FormValues) {
    if (!selectedFile) {
      setIsFileMissingError(true);
      toast({
        title: "Error",
        description: "Please upload a tourism program file.",
        variant: "destructive",
      });
      return;
    }
    setIsFileMissingError(false);
    setIsProcessing(true);
    setGeneratedExcelData(null);

    // Simulate data extraction and Excel generation
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const mockExcelContent = `File Number: ${values.fileNumber}\nGuide Name: ${values.guideName}\nProcessed File: ${selectedFile.name}\nOriginal File Date (if available in metadata): Not Implemented\nGroup Name (if available in metadata): Not Implemented\nThis is a mock Excel file.`;
      const blob = new Blob([mockExcelContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      setGeneratedExcelData(blob);
      
      const groupName = "SampleGroup"; // Mocked group name, real version would extract this
      // Use the client-side safe currentDate
      const fileName = `G.O. ${currentDate} - ${groupName} - ${values.guideName} - ${values.fileNumber}.xlsx`;
      setGeneratedFileName(fileName);

      toast({
        title: "Success!",
        description: "File processed and Excel generated.",
      });
    } catch (error) {
      toast({
        title: "Processing Error",
        description: "Could not process the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }

  const handleDownload = () => {
    if (generatedExcelData && generatedFileName) {
      const url = URL.createObjectURL(generatedExcelData);
      const a = document.createElement('a');
      a.href = url;
      a.download = generatedFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Download Started",
        description: `Downloading ${generatedFileName}`,
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center text-primary">Tour File Processor</CardTitle>
          <CardDescription className="text-center">
            Upload your tourism program file, enter details, and generate your Excel report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormItem>
                <FormLabel>Monthly Tourism Program File</FormLabel>
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full justify-start text-left font-normal"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {selectedFile ? selectedFile.name : "Select file"}
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".xlsx,.xls,.csv,.doc,.docx,.pdf" 
                  />
                </div>
                {isFileMissingError && (
                     <p className="text-sm font-medium text-destructive">Please select a file.</p>
                )}
              </FormItem>

              <FormField
                control={form.control}
                name="fileNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>File Number (e.g., abcd12344)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter file number" {...field} />
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
                    <FormLabel>Tour Guide's Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter tour guide's name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Process File"
                )}
              </Button>

              {generatedExcelData && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full mt-4 bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={handleDownload}
                  disabled={isProcessing}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Generated Excel
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
