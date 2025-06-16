
"use client";

import { useState } from "react";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { GeneratedReportInfo, ExpenseItem } from "@/app/generator/page"; 
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

// Helper function to resolve quantity strings like "=$G$3+1" or "17"
// Copied from generator/page.tsx to be used locally
function resolveQuantity(quantityStr: string, paxNumber: number): number {
  if (!isNaN(Number(quantityStr))) {
    return Number(quantityStr);
  }

  const cleanedQuantity = quantityStr.toUpperCase().replace(/\s/g, '');
  const formulaWithPax = cleanedQuantity.replace(/(?<![A-Z])G3(?![0-9A-Z])|\$G\$3/g, String(paxNumber));

  if (formulaWithPax.startsWith('=')) {
    try {
      const expression = formulaWithPax.substring(1);
      if (/^[\d\s()+\-*/.]+$/.test(expression)) {
        // Ensure the expression is safe to evaluate
        // This basic regex allows numbers, operators, parentheses, and decimal points.
        // For more complex scenarios, a more robust parsing/evaluation library would be needed.
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


const calculateGrandTotal = (expenseItems: ExpenseItem[]): number => {
  return expenseItems.reduce((sum, item) => sum + item.total, 0);
};

interface ResultsDialogContentProps {
  report: GeneratedReportInfo;
  onClose: () => void; 
}

export function ResultsDialogContent({ report, onClose }: ResultsDialogContentProps) {
  const { toast } = useToast();
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  
  const generationReportDateFormatted = format(report.generationDate, 'dd.MM.yyyy'); 

  const expenseDataToDisplay = report.expenseItems; 
  const grandTotal = calculateGrandTotal(expenseDataToDisplay);
  const paxCountNumber = parseInt(report.paxCount, 10) || 0;

  const handleDownloadExcel = async () => {
    setIsDownloadingExcel(true);
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    let startDateForFileName = report.startDate; 
    try {
        const [d, m, y] = report.startDate.split('/');
        startDateForFileName = `${d}.${m}.${y.length === 2 ? '20'+y : y}`; 
    } catch (e) {
        console.error("Error formateando startDate para nombre de archivo", e);
        startDateForFileName = generationReportDateFormatted;
    }

    const excelHeader = [
      ["CAJA CHICA GUIA"],
      ["FILE:", report.fileNumber, "", "NOMBRE GUIA:", report.guideName.toUpperCase()],
      ["NOMBRE Y Nº DE PAX:", report.groupName, "", "", "Nº", report.paxCount],
      ["FECHA", "CANT", "DETALLE DEL GASTO", "PREC. UNIT Bs.", "TOTAL Bs.", "VoB OPS"] 
    ];

    const excelBody = expenseDataToDisplay.map(item =>
      [item.date, item.quantity, item.detail, item.unitPrice.toFixed(2), item.total.toFixed(2), item.vobOps || ""]
    );

    const excelFooter = [
      ["", "", "GASTO TOTAL", "", grandTotal.toFixed(2)]
    ];

    let csvContent = excelHeader.map(row => row.join(",")).join("\\n");
    csvContent += "\\n" + excelBody.map(row => row.join(",")).join("\\n");
    csvContent += "\\n" + excelFooter.map(row => row.join(",")).join("\\n");
    
    const fileName = `G.O. ${startDateForFileName} - ${report.groupName.replace(/[/\s()]/g, '_')} - ${report.guideName.toUpperCase().replace(/\s/g, '_')} - ${report.fileNumber}.csv`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    toast({
      title: "Descarga Iniciada",
      description: `Descargando ${fileName}`,
    });
    setIsDownloadingExcel(false);
  };


  return (
    <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0">
      <DialogHeader className="p-6 pb-2">
        <DialogTitle className="text-2xl font-headline text-primary text-center">Reporte de Caja Chica</DialogTitle>
        <DialogDescription className="text-center">
          Detalles del reporte generado para el File: {report.fileNumber} (Generado: {format(report.generationDate, 'dd/MM/yyyy HH:mm')})
        </DialogDescription>
      </DialogHeader>

      <div className="overflow-y-auto flex-grow px-6">
        <div className="space-y-1 mb-4 text-sm p-3 border rounded-md bg-card">
            <div className="grid grid-cols-3 gap-x-4">
                <div className="col-span-2 font-bold text-lg">CAJA CHICA GUIA</div>
            </div>
            <div className="grid grid-cols-7 gap-x-2 items-center">
                <div className="font-semibold col-span-1">FILE:</div>
                <div className="col-span-2 border px-2 py-0.5 rounded bg-muted text-foreground">{report.fileNumber}</div>
                <div className="font-semibold col-span-1 text-right pr-2">NOMBRE GUIA:</div>
                <div className="col-span-3 border px-2 py-0.5 rounded bg-muted text-foreground">{report.guideName.toUpperCase()}</div>
            </div>
             <div className="grid grid-cols-7 gap-x-2 items-center">
                <div className="font-semibold col-span-2">NOMBRE Y Nº DE PAX:</div>
                <div className="col-span-2 border px-2 py-0.5 rounded bg-muted text-foreground">{report.groupName}</div>
                <div className="font-semibold col-span-1 text-right pr-2">Nº</div>
                <div className="col-span-2 border px-2 py-0.5 rounded bg-muted text-foreground">{report.paxCount}</div>
            </div>
        </div>

        {expenseDataToDisplay.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">FECHA</TableHead>
                <TableHead className="w-[80px] text-right">CANT</TableHead>
                <TableHead>DETALLE DEL GASTO</TableHead>
                <TableHead className="w-[120px] text-right">PREC. UNIT Bs.</TableHead>
                <TableHead className="w-[100px] text-right">TOTAL Bs.</TableHead>
                <TableHead className="w-[80px]">VoB OPS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseDataToDisplay.map((item, index) => (
                <TableRow 
                  key={index}
                  className={cn(
                    item.detail === "AGUAS" && "text-sky-600 dark:text-sky-400 font-medium"
                  )}
                >
                  <TableCell>{item.date}</TableCell>
                  <TableCell className="text-right">{resolveQuantity(item.quantity, paxCountNumber)}</TableCell>
                  <TableCell>{item.detail}</TableCell>
                  <TableCell className="text-right">{item.unitPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">{item.total.toFixed(2)}</TableCell>
                  <TableCell>{item.vobOps || ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}></TableCell>
                <TableCell className="text-right font-bold">GASTO TOTAL Bs.</TableCell>
                <TableCell className="text-right font-bold">{grandTotal.toFixed(2)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-4">No se generaron detalles de gastos para este reporte.</p>
        )}
      </div>

      <DialogFooter className="p-6 pt-4 mt-auto border-t">
        <Button 
          id="dialog-download-excel"
          onClick={handleDownloadExcel} 
          disabled={isDownloadingExcel || expenseDataToDisplay.length === 0} 
          className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
        >
          {isDownloadingExcel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
          Descargar Excel (.csv)
        </Button>
        <DialogClose asChild>
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>Cerrar</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}

