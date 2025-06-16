
"use client";

import { useState, useEffect } from "react";
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
import type { GeneratedReportInfo, ExpenseItem } from "@/app/generator/page"; // Importar ExpenseItem también
import { format } from 'date-fns'; // Para formatear la fecha de generación del reporte

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
  
  // La fecha del tour ya está en report.startDate (formateada dd/MM/yy)
  // La fecha de generación del reporte se puede tomar de report.generationDate
  const generationReportDateFormatted = format(report.generationDate, 'dd.MM.yyyy'); // ej: 23.07.2024

  const expenseDataToDisplay = report.expenseItems; 
  const grandTotal = calculateGrandTotal(expenseDataToDisplay);

  const handleDownloadExcel = async () => {
    setIsDownloadingExcel(true);
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    // Usar report.startDate que ya está formateada como dd/MM/yy
    // pero el nombre del archivo Excel usa dd.mm.yyyy
    // así que necesitamos reformatear report.startDate o usar una nueva variable para el nombre del archivo
    let startDateForFileName = report.startDate; // es dd/MM/yy
    try {
        const [d, m, y] = report.startDate.split('/');
        startDateForFileName = `${d}.${m}.${y.length === 2 ? '20'+y : y}`; // Convertir a dd.mm.yy o dd.mm.yyyy
    } catch (e) {
        console.error("Error formateando startDate para nombre de archivo", e);
        // Usar la fecha de generación si falla
        startDateForFileName = generationReportDateFormatted;
    }


    const excelHeader = [
      ["CAJA CHICA GUIA"],
      ["FILE:", report.fileNumber, "", "NOMBRE GUIA:", report.guideName.toUpperCase()],
      ["NOMBRE Y Nº DE PAX:", report.groupName, "", "", "Nº", report.paxCount],
      ["FECHA", "CANT", "DETALLE DEL GASTO", "PREC. UNIT Bs.", "TOTAL Bs.", "VoB OPS"] // Añadido Bs.
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
    
    // G.O. FECHA_INICIO_TOUR - NOMBRE_GRUPO - NOMBRE_GUIA - ID_FILE.csv
    // Ejemplo del Python: G.O. 20.07.2024 - GTA SANTA CRUZ X 25 - VICTOR HUGO - CTFI107585.xlsx
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
                <TableRow key={index}>
                  <TableCell>{item.date}</TableCell>
                  <TableCell className="text-right">{String(item.quantity)}</TableCell>
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

