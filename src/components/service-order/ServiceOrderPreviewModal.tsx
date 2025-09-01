
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
      <DialogContent className="max-w-6xl w-full p-0 overflow-hidden flex flex-col max-h-[95vh]">
        <DialogHeader className="p-6 pb-2 text-center">
             <DialogTitle className="text-center text-xl font-bold">Vista Previa de la Orden</DialogTitle>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto px-6">
          <div className="bg-white text-zinc-900">
            <div className="relative">
              <div className="h-1.5 w-full bg-gradient-to-r from-primary/90 via-primary to-primary/70" />
              <div className="px-6 pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
                     <ListOrdered className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-base font-semibold tracking-wider uppercase text-zinc-800">Orden de Servicios</h1>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wide">{orderName}</Badge>
              </div>
              <Separator />
            </div>

            <div className="m-6 space-y-2">
                <MetaItem label="Guía" value={data.guia} />
                 <div className="flex items-stretch gap-2">
                   <MetaItem label="File" value={data.file} className="flex-none w-48" />
                   <MetaItem label="Ref" value={data.ref} className="flex-1" />
                   <MetaItem label="Nº Pax" value={data.nPax} className="flex-none w-32" />
                </div>
                <MetaItem label="Hotel" value={data.hotel} />
            </div>

            <div className="px-6">
              <div className="rounded-xl border border-primary/20 overflow-hidden">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow className="bg-primary/10 hover:bg-primary/10 uppercase">
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] h-auto w-[86px] text-center align-middle">Fecha</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] h-auto w-[56px] text-center align-middle">Hora</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] h-auto text-left align-middle">Servicio</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] h-auto w-[70px] text-center align-middle">Vuelo</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] h-auto w-[100px] text-center align-middle">Guía</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] h-auto w-[70px] text-center align-middle">Bus</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] h-auto w-[80px] text-center align-middle">Chofer</TableHead>
                      <TableHead className="text-primary font-semibold py-1 px-2 font-mono text-[11px] h-auto text-left align-middle">Observaciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.length > 0 ? (
                      services.map((s, i) => {
                        const showDate = i === 0 || services[i - 1].fecha !== s.fecha;
                        return (
                          <TableRow key={i} className={cn("font-mono text-[11px] uppercase break-words align-middle h-auto", i % 2 === 0 ? "bg-white" : "bg-zinc-50")}>
                             <TableCell className="p-1 align-middle border-r border-primary/10 text-center">
                               {showDate && s.fecha ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-semibold text-[10px] text-primary">
                                  {s.fecha}
                                </span>
                              ) : ("")}
                             </TableCell>
                             <TableCell className="p-1 align-middle border-r border-primary/10 text-center"><span className="rounded px-1 py-0.5 border text-[10px]">{s.hora}</span></TableCell>
                             <TableCell className="p-1 align-middle border-r border-primary/10 text-left">{s.servicio}</TableCell>
                             <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{s.vuelo || "—"}</TableCell>
                             <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{s.guia}</TableCell>
                             <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{s.bus}</TableCell>
                             <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{s.chofer?.replace(/^CONT\s/i, "")}</TableCell>
                             <TableCell className="p-1 align-middle text-left">{s.observaciones}</TableCell>
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
    <div className={cn("rounded-xl border p-2", subtle ? "bg-muted/40 border-dashed" : "bg-card/20") }>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-1">{title}:</p>
      <p className="text-[10px] uppercase font-mono whitespace-pre-wrap leading-5">{text || "—"}</p>
    </div>
  );
}
