
"use client";

import { useMemo, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { parse } from "date-fns";

import { type StoredServiceOrder } from "@/lib/serviceOrderStorage";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogFooter, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";


interface ServiceOrderPreviewModalProps {
  order: StoredServiceOrder;
  onClose: () => void;
}

// This component is now overloaded. It can act as a modal or a standalone print page.
export default function ServiceOrderPreviewModal({ order, onClose }: ServiceOrderPreviewModalProps) {
  const { data } = order;

  const services = useMemo(() => {
    const list = [...data.services].sort((a, b) => {
      try {
        const dateA = parse(a.fecha, "dd/MM/yyyy", new Date()).getTime();
        const dateB = parse(b.fecha, "dd/MM/yyyy", new Date()).getTime();
        if (dateA !== dateB) return dateA - dateB;
      } catch {}
      return a.hora.localeCompare(b.hora);
    });
    return list;
  }, [data.services]);
  
  const dateColorGroupMap = useMemo(() => {
      const map = new Map<string, number>();
      if (services.length === 0) return map;
      
      let colorGroupIndex = 0;
      map.set(services[0].fecha, colorGroupIndex);

      for (let i = 1; i < services.length; i++) {
          if (services[i].fecha !== services[i-1].fecha) {
              colorGroupIndex++;
          }
          map.set(services[i].fecha, colorGroupIndex);
      }
      return map;
  }, [services]);

  const PrintableView = () => (
    <div className="bg-white text-zinc-900 p-4 uppercase" style={{fontFamily: '"Lucida Console", monospace'}}>
        <div className="relative font-mono">
          <div className="h-1.5 w-full bg-gradient-to-r from-primary/90 via-primary to-primary/70" />
           <div className="pt-4 pb-3 flex items-center justify-center font-bold text-xs" style={{fontSize: '12px'}}>
             ORDEN DE SERVICIO
          </div>
          <Separator />
        </div>

        <div className="m-6 space-y-2">
            <div className="grid grid-cols-1 gap-2">
                <MetaItem label="Guía:" value={data.guia} />
            </div>
            <div className="flex items-stretch gap-2">
               <MetaItem label="File:" value={data.file} className="flex-none w-32" />
               <MetaItem label="Ref:" value={data.ref} className="flex-1" />
               <MetaItem label="Nº Pax:" value={data.nPax} className="flex-none w-32" />
            </div>
             <div className="grid grid-cols-1 gap-2">
                <MetaItem label="Hotel:" value={data.hotel} />
            </div>
        </div>

        <div className="px-6">
          <div className="rounded-xl border border-primary/20 overflow-hidden">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-primary/10 hover:bg-primary/10 h-auto">
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[86px] text-center align-middle" style={{fontSize: '11px'}}>Fecha</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[56px] text-center align-middle" style={{fontSize: '11px'}}>Hora</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto text-left align-middle" style={{fontSize: '11px'}}>Servicio</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[70px] text-center align-middle" style={{fontSize: '11px'}}>Vuelo</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[150px] text-center align-middle" style={{fontSize: '11px'}}>Guía</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[70px] text-center align-middle" style={{fontSize: '11px'}}>Bus</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[150px] text-center align-middle" style={{fontSize: '11px'}}>Chofer</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 h-auto text-left align-middle" style={{fontSize: '11px'}}>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.length > 0 ? (
                  services.map((s, i) => {
                    const showDate = i === 0 || services[i - 1].fecha !== s.fecha;
                    const colorGroup = dateColorGroupMap.get(s.fecha) || 0;
                    const rowBgClass = colorGroup % 2 === 0 ? "bg-white" : "bg-zinc-100";
                    const guiaCompleto = s.guia || data.guia;
                    const choferCompleto = s.chofer || '';

                    return (
                      <TableRow key={i} className={cn("break-words align-middle h-8", rowBgClass)} style={{fontSize: '11px'}}>
                         <TableCell className="p-1 align-middle border-r border-primary/10 text-center">
                           {showDate && s.fecha ? (
                            <span className="inline-flex items-center justify-center rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-bold text-primary">
                              {s.fecha}
                            </span>
                          ) : ("")}
                         </TableCell>
                         <TableCell className="p-1 align-middle border-r border-primary/10 text-center"><span className="rounded px-1 py-0.5 border">{s.hora}</span></TableCell>
                         <TableCell className="p-1 align-middle border-r border-primary/10 text-left">{s.servicio}</TableCell>
                         <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{s.vuelo || "—"}</TableCell>
                         <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{guiaCompleto}</TableCell>
                         <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{s.bus}</TableCell>
                         <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{choferCompleto.replace(/^CONT\s/i, "")}</TableCell>
                         <TableCell className="p-1 align-middle text-left">{s.observaciones}</TableCell>
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

         <div className="px-6 py-4 grid grid-cols-1 gap-4 uppercase">
            <InfoBlock title="OBSERVACIONES:" text={data.observations} subtle />
            <InfoBlock title="NOTA:" text={data.nota} subtle />
        </div>
      </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full p-0 overflow-hidden flex flex-col max-h-[95vh]">
        <DialogHeader className="p-4">
           <DialogTitle className="sr-only">Orden de Servicio: {order.orderName}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto">
          <PrintableView />
        </div>
        <DialogFooter className="sticky bottom-0 z-10 gap-2 border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 mt-auto">
           <DialogClose asChild>
              <Button type="button" className="w-full bg-cyan-600 text-white hover:bg-cyan-700">Cerrar</Button>
           </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function MetaItem({ label, value, className }: { label: string; value?: string | number; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-primary/50 bg-card/50 px-3 py-1 flex items-center justify-center gap-2 text-xs", className)} style={{fontFamily: '"Lucida Console", monospace'}}>
      <p className="font-bold text-primary">{label}</p>
      <p className="font-normal">{value || "—"}</p>
    </div>
  );
}

function InfoBlock({ title, text, subtle = false }: { title: string; text?: string; subtle?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-2", subtle ? "bg-zinc-100 border-dashed" : "bg-card/20")}>
      <p className="tracking-wide mb-1 font-bold" style={{fontSize: '10px'}}>{title}</p>
      <p className="whitespace-pre-wrap leading-5" style={{fontSize: '10px'}}>{text || "—"}</p>
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
      <div className="bg-white text-zinc-900 p-4 uppercase" style={{fontFamily: '"Lucida Console", monospace'}}>
          <div className="relative font-mono">
            <div className="h-1.5 w-full bg-gradient-to-r from-primary/90 via-primary to-primary/70" />
             <div className="pt-4 pb-3 flex items-center justify-center font-bold text-xs" style={{fontSize: '12px'}}>
               ORDEN DE SERVICIO
            </div>
            <Separator />
          </div>
  
          <div className="m-6 space-y-2">
              <div className="grid grid-cols-1 gap-2">
                  <MetaItem label="Guía:" value={order.data.guia} />
              </div>
              <div className="flex items-stretch gap-2">
                 <MetaItem label="File:" value={order.data.file} className="flex-none w-32" />
                 <MetaItem label="Ref:" value={order.data.ref} className="flex-1" />
                 <MetaItem label="Nº Pax:" value={order.data.nPax} className="flex-none w-32" />
              </div>
               <div className="grid grid-cols-1 gap-2">
                  <MetaItem label="Hotel:" value={order.data.hotel} />
              </div>
          </div>
  
          <div className="px-6">
            <div className="rounded-xl border border-primary/20 overflow-hidden">
               <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-primary/10 hover:bg-primary/10 h-auto">
                    <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[86px] text-center align-middle" style={{fontSize: '11px'}}>Fecha</TableHead>
                    <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[56px] text-center align-middle" style={{fontSize: '11px'}}>Hora</TableHead>
                    <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto text-left align-middle" style={{fontSize: '11px'}}>Servicio</TableHead>
                    <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[70px] text-center align-middle" style={{fontSize: '11px'}}>Vuelo</TableHead>
                    <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[150px] text-center align-middle" style={{fontSize: '11px'}}>Guía</TableHead>
                    <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[70px] text-center align-middle" style={{fontSize: '11px'}}>Bus</TableHead>
                    <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[150px] text-center align-middle" style={{fontSize: '11px'}}>Chofer</TableHead>
                    <TableHead className="text-primary font-bold py-1 px-2 h-auto text-left align-middle" style={{fontSize: '11px'}}>Observaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.data.services.length > 0 ? (
                     order.data.services.map((s, i) => {
                      const showDate = i === 0 || order.data.services[i - 1].fecha !== s.fecha;
                      const guiaCompleto = s.guia || order.data.guia;
                      const choferCompleto = s.chofer || '';

                      return (
                        <TableRow key={i} className="break-words align-middle h-8" style={{fontSize: '11px'}}>
                           <TableCell className="p-1 align-middle border-r border-primary/10 text-center flex items-center justify-center">{showDate ? s.fecha : ''}</TableCell>
                           <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{s.hora}</TableCell>
                           <TableCell className="p-1 align-middle border-r border-primary/10 text-left">{s.servicio}</TableCell>
                           <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{s.vuelo || "—"}</TableCell>
                           <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{guiaCompleto}</TableCell>
                           <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{s.bus}</TableCell>
                           <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{choferCompleto.replace(/^CONT\s/i, "")}</TableCell>
                           <TableCell className="p-1 align-middle text-left">{s.observaciones}</TableCell>
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
  
           <div className="px-6 py-4 grid grid-cols-1 gap-4 uppercase">
              <InfoBlock title="OBSERVACIONES:" text={order.data.observations} subtle />
              <InfoBlock title="NOTA:" text={order.data.nota} subtle />
          </div>
      </div>
    );
}
