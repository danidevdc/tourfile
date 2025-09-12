
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


interface ServiceOrderPreviewModalProps {
  order: StoredServiceOrder;
  onClose: () => void;
}

// This component is now overloaded. It can act as a modal or a standalone print page.
export default function ServiceOrderPreviewModal({ order, onClose }: ServiceOrderPreviewModalProps) {
  const { data } = order;
  const { toast } = useToast();
  const captureRef = useRef<HTMLDivElement>(null);

  const services = useMemo(() => {
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
    await copiarVistaPreviaAlClipboard(captureRef, toast);
  };

  const PrintableView = () => (
     <div ref={captureRef} className={cn(
        "bg-white text-zinc-900 uppercase w-full",
      )}>
        <div className="relative">
           <div className="pt-4 pb-3 flex items-center justify-center font-bold text-2xl">
             ORDEN DE SERVICIO
          </div>
        </div>

        <div className="border-2 border-gray-400 rounded-lg mt-1 p-4">
            <div className="space-y-1.5">
              <MetaItem label="Guía:" value={data.guia} />
              <MetaItem label="File:" value={data.file} />
              <MetaItem label="Ref:" value={data.ref} />
              <MetaItem label="Nº Pax:" value={data.nPax} />
              <MetaItem label="Hotel:" value={data.hotel} />
            </div>

            <div className="mt-4">
              <div className="rounded-lg border border-gray-300 overflow-hidden">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow className="bg-gray-100 hover:bg-gray-100 h-auto">
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[86px] text-center text-xs">Fecha</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[56px] text-center text-xs">Hora</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto text-left text-xs">Servicio</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[70px] text-center text-xs">Vuelo</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[90px] text-center text-xs">Guía</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[70px] text-center text-xs">Bus</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[85px] text-center text-xs">Chofer</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 h-auto text-left text-xs">Observaciones</TableHead>
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
                          <TableRow key={i} className="break-words h-10 bg-white hover:bg-white text-xs" >
                             <TableCell className="p-2 border-r border-gray-200 text-center font-semibold align-middle">
                                {showDate && s.fecha ? s.fecha : ""}
                             </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle">
                               {s.hora}
                             </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-left align-middle">
                               {s.servicio}
                              </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle">
                               {s.vuelo || "—"}
                             </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle">
                               {guiaFirstName}
                              </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle">
                               {s.bus}
                              </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle">
                               {choferFirstName}
                              </TableCell>
                             <TableCell className="p-2 text-left align-middle">
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
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full p-0 overflow-hidden flex flex-col max-h-[95vh]">
        <DialogHeader className="p-4">
           <DialogTitle className="sr-only">Orden de Servicio: {order.orderName}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto p-4 flex justify-center">
          <PrintableView />
        </div>
        <DialogFooter className="sticky bottom-0 z-10 flex justify-end gap-2 border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 mt-auto">
            <Button
              type="button"
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
              onClick={handleCopy}
            >
              <FaWhatsapp className="mr-2 h-4 w-4" />
              Copiar imagen (Ctrl+V en WhatsApp)
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700">Cerrar</Button>
           </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function MetaItem({ label, value }: { label: string; value?: string | number; }) {
  return (
    <div className="border border-gray-300 rounded-md px-1.5 py-0.5 bg-gray-50 text-xs">
      <p className="font-bold text-black inline-block w-20 flex-shrink-0">{label}</p>
      <p className="font-normal inline-block">{value || "—"}</p>
    </div>
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

// New component to handle the standalone print page logic
export function ServiceOrderPrintPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [order, setOrder] = useState<StoredServiceOrder | null>(null);

    useEffect(() => {
        const orderDataString = searchParams.get('order');
        if (orderDataString) {
            try {
                const parsedOrder: StoredServiceOrder = JSON.parse(decodeURIComponent(orderDataString));
                // Convert string dates back to Date objects
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
            // Wait for the content to render, then trigger print
            const timeoutId = setTimeout(() => {
                window.print();
            }, 500); // 500ms delay to allow for rendering
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
    
    // Use a simplified version of the preview modal's content for printing
    return (
      <div className="bg-white text-zinc-900 p-4 uppercase ui-sans-serif">
          <div className="relative">
             <div className="pt-4 pb-3 flex items-center justify-center font-bold text-2xl">
               ORDEN DE SERVICIO
            </div>
          </div>

        <div className="border-2 border-gray-400 rounded-lg mt-1 p-4">
             <div className="space-y-1.5">
              <MetaItem label="Guía:" value={order.data.guia} />
              <MetaItem label="File:" value={order.data.file} />
              <MetaItem label="Ref:" value={order.data.ref} />
              <MetaItem label="Nº Pax:" value={order.data.nPax} />
              <MetaItem label="Hotel:" value={order.data.hotel} />
            </div>
    
            <div className="mt-4">
              <div className="rounded-lg border border-gray-300 overflow-hidden">
                 <Table className="table-fixed">
                  <TableHeader>
                    <TableRow className="bg-gray-100 hover:bg-gray-100 h-auto">
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[86px] text-center text-xs">Fecha</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[56px] text-center text-xs">Hora</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto text-left text-xs">Servicio</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[70px] text-center text-xs">Vuelo</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[90px] text-center text-xs">Guía</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[70px] text-center text-xs">Bus</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[85px] text-center text-xs">Chofer</TableHead>
                      <TableHead className="text-black font-bold py-1 px-2 h-auto text-left text-xs">Observaciones</TableHead>
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
                          <TableRow key={i} className="break-words h-10 bg-white hover:bg-white text-xs">
                            <TableCell className="p-2 border-r border-gray-200 text-center font-semibold align-middle">
                              {showDate && s.fecha ? s.fecha : ""}
                            </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle">
                               {s.hora}
                             </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-left align-middle">
                               {s.servicio}
                              </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle">
                               {s.vuelo || "—"}
                             </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle">
                               {guiaFirstName}
                              </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle">
                               {s.bus}
                              </TableCell>
                             <TableCell className="p-2 border-r border-gray-200 text-center align-middle">
                               {choferFirstName}
                              </TableCell>
                             <TableCell className="p-2 text-left align-middle">
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
