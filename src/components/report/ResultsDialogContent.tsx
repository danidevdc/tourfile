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
import { type GeneratedReportInfo, type ExpenseItem, resolveQuantity } from "@/lib/report-generator"; 
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

const calculateGrandTotal = (expenseItems: ExpenseItem[], paxCount: number): number => {
  return expenseItems.reduce((sum, item) => {
    // Recalculate total for display based on resolved quantity
    const resolvedQty = resolveQuantity(item.quantity, paxCount);
    const itemTotal = resolvedQty * item.unitPrice;
    return sum + itemTotal;
  }, 0);
};

interface ResultsDialogContentProps {
  report: GeneratedReportInfo;
  onClose: () => void; 
  onDownloadExcel: (report: GeneratedReportInfo) => Promise<void>;
}

export function ResultsDialogContent({ report, onClose, onDownloadExcel }: ResultsDialogContentProps) {
  const { toast } = useToast(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  
  const paxCountNumber = parseInt(report.paxCount, 10) || 0;
  const expenseDataToDisplay = report.expenseItems; 
  const grandTotal = calculateGrandTotal(expenseDataToDisplay, paxCountNumber);


  const handleDownloadClick = async () => {
    setIsDownloadingExcel(true);
    try {
      await onDownloadExcel(report);
    } catch (error) {
      // Error handling is done by the caller (onDownloadExcel)
    } finally {
      setIsDownloadingExcel(false);
    }
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
              {expenseDataToDisplay.map((item, index) => {
                const displayQuantity = resolveQuantity(item.quantity, paxCountNumber);
                const displayTotal = displayQuantity * item.unitPrice;
                return (
                  <TableRow 
                    key={index}
                    className={cn(
                      item.detail.toUpperCase() === "AGUAS" && "text-sky-600 dark:text-sky-400 font-medium"
                    )}
                  >
                    <TableCell>{item.date}</TableCell>
                    <TableCell className="text-right">{displayQuantity}</TableCell>
                    <TableCell>{item.detail}</TableCell>
                    <TableCell className="text-right">{item.unitPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">{displayTotal.toFixed(2)}</TableCell>
                    <TableCell>{item.vobOps || ''}</TableCell>
                  </TableRow>
                );
              })}
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
          onClick={handleDownloadClick} 
          disabled={isDownloadingExcel || expenseDataToDisplay.length === 0} 
          className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
        >
          {isDownloadingExcel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
          Descargar Excel
        </Button>
        <DialogClose asChild>
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>Cerrar</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}
