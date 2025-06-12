
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileSpreadsheet, Printer, FilePlus2, DoorOpen, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

interface ExpenseItem {
  date: string;
  quantity: string | number;
  detail: string;
  unitPrice: number | string; 
  total: number | string; 
  vobOps?: string;
}

const DUMMY_EXPENSE_DATA: ExpenseItem[] = [
  { date: "24/04/2025", quantity: 1, detail: "TAXI DOM - OFICINA", unitPrice: 30, total: 30 },
  { date: "24/04/2025", quantity: 1, detail: "BUS LPB - COPA", unitPrice: 40, total: 40 },
  { date: "24/04/2025", quantity: 1, detail: "DESAYUNO GUIA", unitPrice: 20, total: 20 },
  { date: "25/04/2025", quantity: 18, detail: "TELEFERICO", unitPrice: 7, total: 126 },
  { date: "25/04/2025", quantity: 17, detail: "VALLE", unitPrice: 20, total: 340 },
  { date: "26/04/2025", quantity: 1, detail: "TAXI DOM - HOTEL", unitPrice: 30, total: 30 },
  { date: "26/04/2025", quantity: 1, detail: "MALETAS AEROPUERTO", unitPrice: 3, total: 3 },
  { date: "26/04/2025", quantity: 17, detail: "AGUAS", unitPrice: 6, total: 102 },
];

const calculateGrandTotal = (data: ExpenseItem[]) => {
  return data.reduce((sum, item) => {
    const itemTotal = typeof item.total === 'number' ? item.total : parseFloat(String(item.total).replace(',', '.')) || 0;
    return sum + itemTotal;
  }, 0);
};

export default function ResultsPage() {
  const router = useRouter(); 
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [fileNumber, setFileNumber] = useState("");
  const [guideName, setGuideName] = useState("");
  const [groupName, setGroupName] = useState("GTA # 3 -2025");
  const [paxCount, setPaxCount] = useState("17"); 
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setIsClient(true);
    setFileNumber(searchParams.get("fileNumber") || "N/A");
    setGuideName(searchParams.get("guideName") || "N/A");
    setGroupName(searchParams.get("groupName") || "GTA # 3 -2025");
    setPaxCount(searchParams.get("paxCount") || "17");
    setCurrentDate(new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.'));
  }, [searchParams]);

  const grandTotal = calculateGrandTotal(DUMMY_EXPENSE_DATA);

  const handleDownloadExcel = async () => {
    setIsDownloadingExcel(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const excelHeader = [
      ["CAJA CHICA GUIA"],
      ["FILE:", fileNumber, "", "NOMBRE GUIA:", guideName],
      ["NOMBRE Y Nº DE PAX:", groupName, "", "", "Nº", paxCount],
      ["FECHA", "CANT", "DETALLE DEL GASTO", "PREC. UNI", "TOTAL", "VoB OPS"]
    ];

    const excelBody = DUMMY_EXPENSE_DATA.map(item => 
      [item.date, item.quantity, item.detail, item.unitPrice, item.total, item.vobOps || ""]
    );

    const excelFooter = [
      ["", "", "GASTO TOTAL", "", grandTotal.toFixed(2)]
    ];
    
    let csvContent = excelHeader.map(row => row.join(",")).join("\\n");
    csvContent += "\\n" + excelBody.map(row => row.join(",")).join("\\n");
    csvContent += "\\n" + excelFooter.map(row => row.join(",")).join("\\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = `G.O. ${currentDate} - ${groupName.replace(/[/\\s]/g, '_')} - ${guideName.replace(/\\s/g, '_')} - ${fileNumber}.csv`;
    
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

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    await new Promise(resolve => setTimeout(resolve, 500));
     toast({
      title: "Funcionalidad no disponible",
      description: "La descarga en formato PDF aún no está implementada.",
      variant: "destructive",
    });
    setIsDownloadingPdf(false);
  };


  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-5rem)] p-4 bg-background pt-8"> {/* Adjusted pt-8 */}
       <div className="w-full max-w-4xl mb-4"> {/* Container for back button */}
        <Button variant="default" size="icon" onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <Card className="w-full max-w-4xl shadow-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-headline text-primary text-center">Reporte de Caja Chica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 mb-4 text-sm p-3 border rounded-md bg-card">
            <div className="grid grid-cols-3 gap-x-4">
                <div className="col-span-2 font-bold text-lg">CAJA CHICA GUIA</div>
            </div>
            <div className="grid grid-cols-7 gap-x-2 items-center">
                <div className="font-semibold col-span-1">FILE:</div>
                <div className="col-span-2 border px-2 py-0.5 rounded bg-white text-foreground">{fileNumber}</div>
                <div className="font-semibold col-span-1 text-right pr-2">NOMBRE GUIA:</div>
                <div className="col-span-3 border px-2 py-0.5 rounded bg-white text-foreground">{guideName}</div>
            </div>
             <div className="grid grid-cols-7 gap-x-2 items-center">
                <div className="font-semibold col-span-2">NOMBRE Y Nº DE PAX:</div>
                <div className="col-span-2 border px-2 py-0.5 rounded bg-white text-foreground">{groupName}</div>
                <div className="font-semibold col-span-1 text-right pr-2">Nº</div>
                <div className="col-span-2 border px-2 py-0.5 rounded bg-white text-foreground">{paxCount}</div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">FECHA</TableHead>
                <TableHead className="w-[50px] text-right">CANT</TableHead>
                <TableHead>DETALLE DEL GASTO</TableHead>
                <TableHead className="w-[100px] text-right">PREC. UNI</TableHead>
                <TableHead className="w-[100px] text-right">TOTAL</TableHead>
                <TableHead className="w-[80px]">VoB OPS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DUMMY_EXPENSE_DATA.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.date}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
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

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button onClick={handleDownloadExcel} disabled={isDownloadingExcel} className="w-full bg-green-600 hover:bg-green-700 text-white">
              {isDownloadingExcel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Descargar Excel
            </Button>
            <Button onClick={handleDownloadPdf} disabled={isDownloadingPdf} className="w-full bg-red-600 hover:bg-red-700 text-white">
              {isDownloadingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Descargar PDF
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4">
            <Link href="/generator" passHref className="w-full">
              <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10">
                <FilePlus2 className="mr-2 h-4 w-4" />
                Generar Nueva CC
              </Button>
            </Link>
            <Link href="/" passHref className="w-full">
              <Button variant="secondary" className="w-full">
                <DoorOpen className="mr-2 h-4 w-4" />
                Finalizar (Ir a Inicio)
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
