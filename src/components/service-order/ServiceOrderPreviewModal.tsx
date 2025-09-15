
"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { parse } from "date-fns";
import { FaWhatsapp } from "react-icons/fa";

import { type StoredServiceOrder } from "@/lib/serviceOrderStorage";
import { cn } from "@/lib/utils";
import { copiarVistaPreviaAlClipboard } from "@/lib/copyPreview";

import { Dialog, DialogContent, DialogFooter, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Camera, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PDFViewerModal from "./PDFViewerModal";


interface ServiceOrderPreviewModalProps {
  order: StoredServiceOrder;
  onClose: () => void;
}

function PrintableView({ order, onClose }: { order: StoredServiceOrder, onClose: () => void }) {
  const { data } = order;
  const captureRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isCopying, setIsCopying] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>('');


  const services = useMemo(() => {
    if (!data.services) return [];
    return [...data.services].sort((a, b) => {
      try {
        const dateA = parse(a.fecha, "dd/MM/yyyy", new Date()).getTime();
        const dateB = parse(b.fecha, "dd/MM/yyyy", new Date()).getTime();
        if (dateA !== dateB) return dateA - dateB;
      } catch {}

      const hasTimeA = a.hora && a.hora.trim() !== '';
      const hasTimeB = b.hora && b.hora.trim() !== '';

      if (hasTimeA && hasTimeB) return a.hora.localeCompare(b.hora);
      if (hasTimeA) return -1;
      if (hasTimeB) return 1;
      return 0;
    });
  }, [data.services]);
  
  const handleCopy = async () => {
    setIsCopying(true);
    if (document.hasFocus()) {
        await copiarVistaPreviaAlClipboard(captureRef, toast);
    } else {
        toast({
            title: "Acción Requerida",
            description: "Por favor, haz clic en la página para enfocarla y luego intenta copiar de nuevo.",
            variant: "destructive",
            duration: 5000,
        });
    }
    setIsCopying(false);
  };
  
  const handleGenerateAndShowPdf = async () => {
    setIsGeneratingPdf(true);
    try {
        const response = await fetch(`/api/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });
        
        if (!response.ok) {
          let errorMessage = `Server responded with ${response.status}`;
          try {
              const errorData = await response.json();
              errorMessage = errorData.details || errorData.error || errorMessage;
          } catch {
             // If parsing JSON fails, the body might be plain text or HTML
             errorMessage = await response.text();
          }
          throw new Error(errorMessage);
        }
        
        const pdfBlob = await response.blob();
        const url = URL.createObjectURL(pdfBlob);
        setPdfUrl(url);
        setShowPdfViewer(true);

    } catch (err) {
        const errorMessage = (err as Error).message;
        console.error("PDF Generation Error:", errorMessage);
        toast({
            title: "Error de Generación",
            description: `No se pudo generar el PDF. Detalles: ${errorMessage}`,
            variant: "destructive",
            duration: 7000,
        });
    } finally {
        setIsGeneratingPdf(false);
    }
  };
  

  return (
    <>
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
       <DialogContent className="max-w-[1250px] w-full flex flex-col max-h-[95vh]">
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <DialogTitle className="sr-only">Orden de Servicio: {order.orderName}</DialogTitle>
        </DialogHeader>
        
         <div className="overflow-auto min-h-0">
            <div ref={captureRef} className={cn(
                "bg-white text-zinc-900 uppercase w-[1120px] mx-auto pt-[3px] pb-[5px] px-[10px]",
              )}>
                <div className="relative">
                   <div className="pt-4 pb-3 flex items-center justify-center font-bold text-2xl">
                     ORDEN DE SERVICIO
                  </div>
                </div>

                <div className="border-2 border-gray-400 rounded-lg mt-1 p-4">
                    <Table className="mb-4">
                        <TableBody>
                            <TableRow className="hover:bg-white border-none">
                                <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto w-24 align-middle">Guía:</TableCell>
                                <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{data.guia || "—"}</TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-white border-none">
                                <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto align-middle">File:</TableCell>
                                <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{data.file || "—"}</TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-white border-none">
                                <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto align-middle">Ref:</TableCell>
                                <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{data.ref || "—"}</TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-white border-none">
                                <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto align-middle">Nº Pax:</TableCell>
                                <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{data.nPax || "—"}</TableCell>
                            </TableRow>
                             <TableRow className="hover:bg-white border-none">
                                <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto align-middle">Hotel:</TableCell>
                                <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{data.hotel || "—"}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>

                    <div className="mt-4">
                      <div className="rounded-lg border border-gray-300 overflow-hidden">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow className="bg-gray-100 hover:bg-gray-100 h-auto whitespace-nowrap">
                              <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[86px] text-center align-middle text-[11px]">Fecha</TableHead>
                              <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[56px] text-center align-middle text-[11px]">Hora</TableHead>
                              <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto text-left align-middle w-[250px] text-[11px]">Servicio</TableHead>
                              <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[78px] text-center align-middle text-[11px]">Vuelo</TableHead>
                              <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[90px] text-center align-middle text-[11px]">Guía</TableHead>
                              <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[70px] text-center align-middle text-[11px]">Bus</TableHead>
                              <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[85px] text-center align-middle text-[11px]">Chofer</TableHead>
                              <TableHead className="text-black font-bold py-1 px-2 h-auto text-left align-middle text-[11px]">Observaciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {services.length > 0 ? (
                              services.map((s, i) => {
                                const showDate = i === 0 || services[i - 1].fecha !== s.fecha;
                                const guiaCompleto = s.guia || data.guia;
                                const guiaFirstName = (guiaCompleto || '').split(' ')[0];
                                const choferCompleto = s.chofer || '';
                                const choferSanitized = choferCompleto.replace(/^CONT\s/i, '');
                                const choferFirstName = choferSanitized.split(' ')[0];

                                return (
                                  <TableRow key={i} className="h-10 bg-white hover:bg-white text-xs whitespace-nowrap">
                                     <TableCell className="p-2 border-r border-gray-200 text-center font-semibold align-middle text-xs">
                                        {showDate && s.fecha ? s.fecha : ""}
                                     </TableCell>
                                     <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                                       {s.hora}
                                     </TableCell>
                                     <TableCell className="p-2 border-r border-gray-200 text-left align-middle text-xs">
                                       {s.servicio}
                                      </TableCell>
                                     <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                                       {s.vuelo || "—"}
                                     </TableCell>
                                     <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                                       {guiaFirstName}
                                      </TableCell>
                                     <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                                       {s.bus}
                                      </TableCell>
                                     <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                                       {choferFirstName}
                                      </TableCell>
                                     <TableCell className="p-2 text-left align-middle text-xs">
                                       {s.observaciones}
                                      </TableCell>
                                  </TableRow>
                                );
                              })
                            ) : (
                              <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No hay servicios en esta orden.</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                     <div className="mt-4 grid grid-cols-1 gap-4 uppercase">
                        <InfoBlock title="OBSERVACIONES:" text={data.observations} />
                        <InfoBlock title="NOTA:" text={data.nota} />
                    </div>
                </div>
            </div>
          </div>
        <DialogFooter className="flex-shrink-0 flex justify-start gap-2 border-t bg-background p-4">
          <Button
            type="button"
            className="bg-green-600 hover:bg-green-700 text-white"
            size="sm"
            onClick={handleCopy}
            disabled={isCopying}
          >
            {isCopying ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FaWhatsapp className="mr-2 h-4 w-4" />}
            Copiar (WhatsApp)
          </Button>
           <Button
            type="button"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            size="sm"
            onClick={handleGenerateAndShowPdf}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4" />}
            Ver PDF (Beta)
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={onClose}>Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    <PDFViewerModal 
        isOpen={showPdfViewer}
        onClose={() => setShowPdfViewer(false)}
        pdfUrl={pdfUrl}
        title={`PDF: ${order.orderName}`}
    />
    </>
  );
}

function InfoBlock({ title, text }: { title: string; text?: string; }) {
  return (
    <div className="border border-gray-300 rounded-md p-2 bg-gray-50">
      <p className="tracking-wide mb-1 font-bold text-xs">{title}</p>
      <p className="whitespace-pre-wrap leading-5 text-xs">{text || "—"}</p>
    </div>
  );
}

export function ServiceOrderPrintPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [order, setOrder] = useState<StoredServiceOrder | null>(null);

    useEffect(() => {
        const orderDataString = searchParams.get('order');
        if (orderDataString) {
            try {
                const parsedOrder: StoredServiceOrder = JSON.parse(decodeURIComponent(orderDataString));
                parsedOrder.createdAt = new Date(parsedOrder.createdAt);
                if (parsedOrder.updatedAt) {
                    parsedOrder.updatedAt = new Date(parsedOrder.updatedAt);
                }
                setOrder(parsedOrder);
            } catch (e) {
                console.error("Failed to parse order data from URL", e);
                router.push("/service-order");
            }
        }
    }, [searchParams, router]);

    useEffect(() => {
        if (order) {
            const timeoutId = setTimeout(() => {
                window.print();
            }, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [order]);

    if (!order) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-2">Cargando orden para impresión...</p>
            </div>
        );
    }
    
    return (
      <div className="bg-white text-zinc-900 uppercase w-[1120px] mx-auto pt-[3px] pb-[5px] px-[10px]">
          <div className="relative">
             <div className="pt-4 pb-3 flex items-center justify-center font-bold text-2xl">
               ORDEN DE SERVICIO
            </div>
          </div>

        <div className="border-2 border-gray-400 rounded-lg mt-1 p-4">
             <Table className="mb-4">
                <TableBody>
                    <TableRow className="hover:bg-white border-none">
                        <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto w-24 align-middle">Guía:</TableCell>
                        <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{order.data.guia || "—"}</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-white border-none">
                        <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto align-middle">File:</TableCell>
                        <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{order.data.file || "—"}</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-white border-none">
                        <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto align-middle">Ref:</TableCell>
                        <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{order.data.ref || "—"}</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-white border-none">
                        <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto align-middle">Nº Pax:</TableCell>
                        <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{order.data.nPax || "—"}</TableCell>
                    </TableRow>
                        <TableRow className="hover:bg-white border-none">
                        <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto align-middle">Hotel:</TableCell>
                        <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{order.data.hotel || "—"}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
    
            <div className="mt-4">
              <div className="rounded-lg border border-gray-300 overflow-hidden">
                 <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow className="bg-gray-100 hover:bg-gray-100 h-auto whitespace-nowrap">
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[86px] text-center align-middle text-[11px]">Fecha</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[56px] text-center align-middle text-[11px]">Hora</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto text-left align-middle w-[250px] text-[11px]">Servicio</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[78px] text-center align-middle text-[11px]">Vuelo</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[90px] text-center align-middle text-[11px]">Guía</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[70px] text-center align-middle text-[11px]">Bus</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[85px] text-center align-middle text-[11px]">Chofer</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 h-auto text-left align-middle text-[11px]">Observaciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.data.services.length > 0 ? (
                       order.data.services.sort((a, b) => {
                          try {
                              const dateA = parse(a.fecha, "dd/MM/yyyy", new Date()).getTime();
                              const dateB = parse(b.fecha, "dd/MM/yyyy", new Date()).getTime();
                              if (dateA !== dateB) return dateA - dateB;
                          } catch {}
                          const hasTimeA = a.hora && a.hora.trim() !== '';
                          const hasTimeB = b.hora && b.hora.trim() !== '';

                          if (hasTimeA && hasTimeB) return a.hora.localeCompare(b.hora);
                          if (hasTimeA) return -1;
                          if (hasTimeB) return 1;
                          return 0;
                        }).map((s, i) => {
                        const showDate = i === 0 || order.data.services.sort((a,b) => {
                          try {
                            const dateA = parse(a.fecha, 'dd/MM/yyyy', new Date()).getTime();
                            const dateB = parse(b.fecha, 'dd/MM/yyyy', new Date()).getTime();
                            if (dateA !== dateB) return dateA - dateB;
                          } catch {}
                          return (a.hora || '').localeCompare(b.hora || '');
                        })[i - 1].fecha !== s.fecha;
                        const guiaCompleto = s.guia || order.data.guia;
                        const guiaFirstName = (guiaCompleto || '').split(' ')[0];
                        const choferCompleto = s.chofer || '';
                        const choferSanitized = choferCompleto.replace(/^CONT\s/i, '');
                        const choferFirstName = choferSanitized.split(' ')[0];

                        return (
                          <TableRow key={i} className="h-10 bg-white hover:bg-white text-xs whitespace-nowrap">
                            <TableCell className="p-2 border-r border-gray-200 text-center font-semibold align-middle text-xs">
                              {showDate && s.fecha ? s.fecha : ""}
                            </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                               {s.hora}
                             </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-left align-middle text-xs">
                               {s.servicio}
                              </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                               {s.vuelo || "—"}
                             </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                               {guiaFirstName}
                              </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                               {s.bus}
                              </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                               {choferFirstName}
                              </TableCell>
                             <TableCell className="p-2 text-left align-middle text-xs">
                                {s.observaciones}
                              </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No hay servicios en esta orden.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
    
             <div className="mt-4 grid grid-cols-1 gap-4 uppercase">
                <InfoBlock title="OBSERVACIONES:" text={order.data.observations} />
                <InfoBlock title="NOTA:" text={order.data.nota} />
            </div>
        </div>
      </div>
    );
}

export default function ServiceOrderPreviewModal({ order, onClose }: ServiceOrderPreviewModalProps) {
    if (!order?.data) {
        return (
            <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
                <DialogContent>
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }
    
    return <PrintableView order={order} onClose={onClose} />;
}
