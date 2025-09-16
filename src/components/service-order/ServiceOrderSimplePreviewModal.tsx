
"use client";

import React, { useMemo, useRef, useState } from "react";
import { parse } from "date-fns";
import { FaWhatsapp } from "react-icons/fa";
import { type StoredServiceOrder } from "@/lib/serviceOrderStorage";
import { cn } from "@/lib/utils";
import { copiarVistaPreviaAlClipboard } from "@/lib/copyPreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileText, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ServiceOrderSimplePreviewModalProps {
  order: StoredServiceOrder;
  onClose: () => void;
}

export function ServiceOrderSimplePreviewModal({ order, onClose }: ServiceOrderSimplePreviewModalProps) {
  const { data } = order;
  const captureRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isCopying, setIsCopying] = useState(false);

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
    await copiarVistaPreviaAlClipboard(captureRef, toast);
    setIsCopying(false);
  };

  const InfoRow = ({ label, value }: { label: string, value: string }) => (
    <div className="flex">
        <div className="w-24 font-bold text-gray-600">{label}:</div>
        <div className="flex-1 text-gray-800">{value || '—'}</div>
    </div>
  );

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-6xl w-full flex flex-col max-h-[95vh] p-0 shadow-2xl">
        <DialogHeader className="p-4 border-b bg-slate-900 text-white rounded-t-lg">
          <DialogTitle className="flex items-center gap-2">
            <FileText />
            Vista Previa de Orden de Servicio
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-gray-800">
          <div ref={captureRef} className="bg-white text-black p-8 w-[1120px] mx-auto shadow-lg rounded-lg">
            
            <div className="text-center mb-6 pb-4 border-b-4 border-slate-800">
                <h1 className="font-bold text-4xl text-slate-800 uppercase tracking-wider">
                    Orden de Servicio
                </h1>
            </div>
            
            {/* General Info */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                 <h2 className="text-lg font-bold text-slate-700 mb-3 pb-2 border-b-2 border-slate-200">Información General</h2>
                 <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <InfoRow label="Guía" value={data.guia} />
                    <InfoRow label="File" value={data.file} />
                    <InfoRow label="Ref" value={data.ref} />
                    <InfoRow label="Nº Pax" value={data.nPax} />
                    <InfoRow label="Hotel" value={data.hotel} />
                 </div>
            </div>

              {/* Services Table */}
            <div>
                <h2 className="text-lg font-bold text-slate-700 mb-3 pb-2 border-b-2 border-slate-200">Itinerario de Servicios</h2>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-800 hover:bg-slate-800 text-white uppercase text-xs">
                          <TableHead className="w-[90px] h-auto p-2 text-white font-bold text-center border-r border-slate-700">Fecha</TableHead>
                          <TableHead className="w-[60px] h-auto p-2 text-white font-bold text-center border-r border-slate-700">Hora</TableHead>
                          <TableHead className="w-[280px] h-auto p-2 text-white font-bold border-r border-slate-700">Servicio</TableHead>
                          <TableHead className="w-[80px] h-auto p-2 text-white font-bold text-center border-r border-slate-700">Vuelo</TableHead>
                          <TableHead className="w-[100px] h-auto p-2 text-white font-bold text-center border-r border-slate-700">Guía</TableHead>
                          <TableHead className="w-[80px] h-auto p-2 text-white font-bold text-center border-r border-slate-700">Bus</TableHead>
                          <TableHead className="w-[100px] h-auto p-2 text-white font-bold text-center border-r border-slate-700">Chofer</TableHead>
                          <TableHead className="h-auto p-2 text-white font-bold">Observaciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {services.map((s, i) => {
                           const showDate = i === 0 || services[i - 1].fecha !== s.fecha;
                           const guiaCompleto = s.guia || data.guia;
                           const guiaFirstName = (guiaCompleto || '').split(' ')[0];
                           const choferCompleto = s.chofer || '';
                           const choferSanitized = choferCompleto.replace(/^CONT\s/i, '');
                           const choferFirstName = choferSanitized.split(' ')[0];
                           const rowClass = i % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                           return(
                            <TableRow key={i} className={cn("border-b-0 hover:bg-slate-100", rowClass)}>
                              <TableCell className="p-2 text-center text-xs font-bold text-slate-600 border-r border-gray-200">{showDate ? s.fecha : ""}</TableCell>
                              <TableCell className="p-2 text-center text-xs border-r border-gray-200">{s.hora}</TableCell>
                              <TableCell className="p-2 text-xs font-medium border-r border-gray-200">{s.servicio}</TableCell>
                              <TableCell className="p-2 text-center text-xs border-r border-gray-200">{s.vuelo || "—"}</TableCell>
                              <TableCell className="p-2 text-center text-xs border-r border-gray-200">{guiaFirstName}</TableCell>
                              <TableCell className="p-2 text-center text-xs border-r border-gray-200">{s.bus}</TableCell>
                              <TableCell className="p-2 text-center text-xs border-r border-gray-200">{choferFirstName}</TableCell>
                              <TableCell className="p-2 text-xs">{s.observaciones}</TableCell>
                            </TableRow>
                           )
                        })}
                      </TableBody>
                    </Table>
                </div>
            </div>

            {/* Notes */}
            <div className="mt-6 space-y-4 text-xs">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 min-h-[60px]">
                  <p className="font-bold text-slate-700 mb-1 uppercase">Observaciones:</p>
                  <p className="whitespace-pre-wrap text-slate-800">{data.observations || "—"}</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 min-h-[60px]">
                  <p className="font-bold text-slate-700 mb-1 uppercase">Nota:</p>
                  <p className="whitespace-pre-wrap text-slate-800">{data.nota || "—"}</p>
                </div>
              </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-slate-50 rounded-b-lg">
          <Button
            className="bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all"
            onClick={handleCopy}
            disabled={isCopying}
          >
            {isCopying ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Copy className="mr-2 h-4 w-4" />}
            Copiar Imagen
          </Button>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
