
"use client";

import { useMemo, useRef } from "react";
import { parse } from "date-fns";

import { type StoredServiceOrder } from "@/lib/serviceOrderStorage";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListOrdered } from 'lucide-react';


interface ServiceOrderPreviewModalProps {
  order: StoredServiceOrder;
  onClose: () => void;
}


export default function ServiceOrderPreviewModal({ order, onClose }: ServiceOrderPreviewModalProps) {
  const { data, orderName } = order;
  const previewRef = useRef<HTMLDivElement>(null);

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


  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden flex flex-col max-h-[95vh]">
        <DialogHeader className="p-6 pb-2 text-center">
            <DialogTitle className="text-2xl font-headline text-primary">Vista Previa de la Orden de Servicio</DialogTitle>
        </DialogHeader>

        {/* Scrollable area */}
        <div className="flex-grow overflow-y-auto px-6">
          <div ref={previewRef} className="bg-white text-zinc-900">
            {/* Header */}
            <div className="relative">
              <div className="h-1.5 w-full bg-gradient-to-r from-primary/90 via-primary to-primary/70" />
              <div className="px-6 pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
                     <ListOrdered className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-base font-semibold tracking-wider uppercase text-zinc-800">Orden de Servicios</h1>
                    <p className="text-xs text-muted-foreground">Emitida para guías y choferes</p>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wide">{orderName}</Badge>
              </div>
              <Separator />
            </div>

            {/* Meta card */}
            <div className="m-6 space-y-2">
                <div className="rounded-lg border border-primary/50 bg-card/50 px-3 py-2 flex items-center justify-center gap-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-primary">GUÍA:</p>
                    <p className="text-sm uppercase font-mono">{data.guia || "—"}</p>
                </div>
                <div className="flex items-stretch gap-2">
                   <MetaItem label="File" value={data.file} className="w-[25%]" />
                   <MetaItem label="Ref" value={data.ref} className="flex-grow" />
                   <MetaItem label="Nº Pax" value={data.nPax} className="w-[20%]" />
                </div>
                <div className="rounded-lg border border-primary/50 bg-card/50 px-3 py-2 flex items-center justify-center gap-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-primary">HOTEL:</p>
                    <p className="text-sm uppercase font-mono">{data.hotel || "—"}</p>
                </div>
            </div>

            {/* Services */}
            <div className="px-6">
              <div className="rounded-xl border border-primary/20 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/10 hover:bg-primary/10 uppercase">
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] w-[86px]">Fecha</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] w-[56px]">Hora</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px]">Servicio</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] w-[70px]">Vuelo</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] w-[150px]">Guía</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] w-[70px]">Bus</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] w-[80px]">Chofer</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 font-mono text-[11px]">Observaciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.length ? (
                      services.map((s, i) => {
                        const showDate = i === 0 || services[i - 1].fecha !== s.fecha;
                        return (
                          <TableRow key={i} className={cn("font-mono text-[11px] uppercase", i % 2 === 0 ? "bg-white" : "bg-zinc-50")}>
                             <TableCell className="p-1 align-top border-r border-primary/10 text-center">
                               {showDate && s.fecha ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-semibold text-[10px] text-primary">
                                  {s.fecha}
                                </span>
                              ) : ("")}
                             </TableCell>
                             <TableCell className="p-1 align-top border-r border-primary/10 text-center"><span className="rounded px-1 py-0.5 border text-[10px]">{s.hora}</span></TableCell>
                             <TableCell className="p-1 align-top border-r border-primary/10">{s.servicio}</TableCell>
                             <TableCell className="p-1 align-top border-r border-primary/10 text-center">{s.vuelo}</TableCell>
                             <TableCell className="p-1 align-top border-r border-primary/10 text-center">{s.guia}</TableCell>
                             <TableCell className="p-1 align-top border-r border-primary/10 text-center">{s.bus}</TableCell>
                             <TableCell className="p-1 align-top border-r border-primary/10 text-center">{s.chofer?.replace(/^CONT\s/i, "")}</TableCell>
                             <TableCell className="p-1 align-top">{s.observaciones}</TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground uppercase font-mono">No hay servicios en esta orden.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Observaciones / Nota */}
             <div className="px-6 py-4 grid grid-cols-1 gap-4">
                <InfoBlock title="Observaciones" text={data.observations} />
                <InfoBlock title="Nota" text={data.nota} subtle />
            </div>
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 z-10 gap-2 border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 mt-auto">
           <DialogClose asChild>
              <Button type="button" variant="outline" className="w-full">Cerrar</Button>
           </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetaItem({ label, value, className }: { label: string; value?: string | number; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-primary/50 bg-card/50 px-3 py-2 flex items-center justify-center gap-2", className)}>
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">{label}:</p>
      <p className="text-sm uppercase font-mono">{value || "—"}</p>
    </div>
  );
}

function InfoBlock({ title, text, subtle = false }: { title: string; text?: string; subtle?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", subtle ? "bg-muted/40 border-dashed" : "bg-card/20") }>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-1">{title}:</p>
      <p className="text-xs uppercase font-mono whitespace-pre-wrap leading-5">{text || "—"}</p>
    </div>
  );
}
