
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
import type { GeneratedReportInfo } from "@/app/generator/page";

interface ExpenseItem {
  date: string;
  quantity: string | number;
  detail: string;
  unitPrice: number | string;
  total: number | string;
  vobOps?: string;
}

// TODO: Reemplazar con la lógica real de generación de gastos basada en el archivo Excel y el reporte.
const DUMMY_EXPENSE_DATA: ExpenseItem[] = [
  { date: "24/04/2025", quantity: 1, detail: "TAXI DOM - OFICINA", unitPrice: 30, total: 30 },
  { date: "24/04/2025", quantity: 1, detail: "BUS LPB - COPA", unitPrice: 40, total: 40 },
  { date: "24/04/2025", quantity: 1, detail: "DESAYUNO GUIA", unitPrice: 20, total: 20 },
  { date: "25/04/2025", quantity: "=17+1", detail: "TELEFERICO", unitPrice: 7, total: 126 }, // Ejemplo de formula
  { date: "25/04/2025", quantity: 17, detail: "VALLE", unitPrice: 20, total: 340 },
  { date: "26/04/2025", quantity: 1, detail: "TAXI DOM - HOTEL", unitPrice: 30, total: 30 },
  { date: "26/04/2025", quantity: 17, detail: "MALETAS AEROPUERTO", unitPrice: 3, total: 51 },
  { date: "", quantity: "=17+2", detail: "AGUAS", unitPrice: 6, total: 114 }, // Ejemplo
];

const calculateGrandTotal = (data: ExpenseItem[]) => {
  return data.reduce((sum, item) => {
    // Aquí se debería evaluar la cantidad si es una fórmula basada en PAX
    // Por ahora, asumimos que 'total' ya está calculado o es un número directo.
    const itemTotal = typeof item.total === 'number' ? item.total : parseFloat(String(item.total).replace(',', '.')) || 0;
    return sum + itemTotal;
  }, 0);
};

interface ResultsDialogContentProps {
  report: GeneratedReportInfo;
  onClose: () => void; 
}

export function ResultsDialogContent({ report, onClose }: ResultsDialogContentProps) {
  const { toast } = useToast();
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.'));
  }, []);

  // Aquí DUMMY_EXPENSE_DATA se usaría, o idealmente, se generarían los datos basados en `report` y el excel.
  const expenseDataToDisplay = DUMMY_EXPENSE_DATA; 
  const grandTotal = calculateGrandTotal(expenseDataToDisplay);

  const handleDownloadExcel = async () => {
    setIsDownloadingExcel(true);
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    const excelHeader = [
      ["CAJA CHICA GUIA"],
      ["FILE:", report.fileNumber, "", "NOMBRE GUIA:", report.guideName],
      ["NOMBRE Y Nº DE PAX:", report.groupName, "", "", "Nº", report.paxCount],
      ["FECHA", "CANT", "DETALLE DEL GASTO", "PREC. UNI", "TOTAL", "VoB OPS"]
    ];

    const excelBody = expenseDataToDisplay.map(item =>
      [item.date, item.quantity, item.detail, item.unitPrice, item.total, item.vobOps || ""]
    );

    const excelFooter = [
      ["", "", "GASTO TOTAL", "", grandTotal.toFixed(2)]
    ];

    // Construcción manual de CSV por simplicidad, idealmente usar una librería como xlsx para generar un .xlsx real
    let csvContent = excelHeader.map(row => row.join(",")).join("\\n");
    csvContent += "\\n" + excelBody.map(row => row.join(",")).join("\\n");
    csvContent += "\\n" + excelFooter.map(row => row.join(",")).join("\\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = `G.O. ${currentDate} - ${report.groupName.replace(/[/\s()]/g, '_')} - ${report.guideName.replace(/\s/g, '_')} - ${report.fileNumber}.csv`;
    
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
          Detalles del reporte generado para el File: {report.fileNumber}
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
                <div className="col-span-3 border px-2 py-0.5 rounded bg-muted text-foreground">{report.guideName}</div>
            </div>
             <div className="grid grid-cols-7 gap-x-2 items-center">
                <div className="font-semibold col-span-2">NOMBRE Y Nº DE PAX:</div>
                <div className="col-span-2 border px-2 py-0.5 rounded bg-muted text-foreground">{report.groupName}</div>
                <div className="font-semibold col-span-1 text-right pr-2">Nº</div>
                <div className="col-span-2 border px-2 py-0.5 rounded bg-muted text-foreground">{report.paxCount}</div>
            </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">FECHA</TableHead>
              <TableHead className="w-[80px] text-right">CANT</TableHead>
              <TableHead>DETALLE DEL GASTO</TableHead>
              <TableHead className="w-[100px] text-right">PREC. UNI</TableHead>
              <TableHead className="w-[100px] text-right">TOTAL</TableHead>
              <TableHead className="w-[80px]">VoB OPS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenseDataToDisplay.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.date}</TableCell>
                <TableCell className="text-right">{String(item.quantity)}</TableCell>
                <TableCell>{item.detail}</TableCell>
                <TableCell className="text-right">{typeof item.unitPrice === 'number' ? item.unitPrice.toFixed(2) : item.unitPrice}</TableCell>
                <TableCell className="text-right font-medium">{typeof item.total === 'number' ? item.total.toFixed(2) : item.total}</TableCell>
                <TableCell>{item.vobOps || ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}></TableCell>
              <TableCell className="text-right font-bold">GASTO TOTAL</TableCell>
              <TableCell className="text-right font-bold">{grandTotal.toFixed(2)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <DialogFooter className="p-6 pt-4 mt-auto border-t">
        <Button onClick={handleDownloadExcel} disabled={isDownloadingExcel} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
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
