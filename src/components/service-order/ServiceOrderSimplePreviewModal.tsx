
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
import { Loader2 } from "lucide-react";
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

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[1250px] w-full flex flex-col max-h-[95vh] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Vista Previa Simplificada: {order.orderName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-800">
          <div ref={captureRef} className="bg-white text-black p-6 w-[1120px] mx-auto uppercase">
            <h1 className="text-center font-bold text-2xl mb-4" style={{ fontFamily: 'Arial, sans-serif' }}>
              ORDEN DE SERVICIO
            </h1>
            
            <div className="border-2 border-gray-500 rounded-lg p-4">
              {/* Info General */}
              <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 mb-4 text-xs">
                  <div className="font-bold">GUÍA:</div><div>{data.guia || "—"}</div>
                  <div className="font-bold">FILE:</div><div>{data.file || "—"}</div>
                  <div className="font-bold">REF:</div><div>{data.ref || "—"}</div>
                  <div className="font-bold">Nº PAX:</div><div>{data.nPax || "—"}</div>
                  <div className="font-bold">HOTEL:</div><div>{data.hotel || "—"}</div>
              </div>

              {/* Tabla de Servicios */}
              <div className="border-t-2 border-b-2 border-gray-500">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-200 hover:bg-gray-200">
                      <TableHead className="w-[86px] h-auto p-1 text-black font-bold text-[11px] text-center border-r border-gray-400">FECHA</TableHead>
                      <TableHead className="w-[56px] h-auto p-1 text-black font-bold text-[11px] text-center border-r border-gray-400">HORA</TableHead>
                      <TableHead className="w-[250px] h-auto p-1 text-black font-bold text-[11px] border-r border-gray-400">SERVICIO</TableHead>
                      <TableHead className="w-[78px] h-auto p-1 text-black font-bold text-[11px] text-center border-r border-gray-400">VUELO</TableHead>
                      <TableHead className="w-[90px] h-auto p-1 text-black font-bold text-[11px] text-center border-r border-gray-400">GUÍA</TableHead>
                      <TableHead className="w-[70px] h-auto p-1 text-black font-bold text-[11px] text-center border-r border-gray-400">BUS</TableHead>
                      <TableHead className="w-[85px] h-auto p-1 text-black font-bold text-[11px] text-center border-r border-gray-400">CHOFER</TableHead>
                      <TableHead className="h-auto p-1 text-black font-bold text-[11px]">OBSERVACIONES</TableHead>
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
                       return(
                        <TableRow key={i} className="border-gray-300 hover:bg-white">
                          <TableCell className={cn("p-1 text-center text-xs font-bold border-r border-gray-300", showDate && "border-t-2 border-t-gray-400")}>{showDate ? s.fecha : ""}</TableCell>
                          <TableCell className={cn("p-1 text-center text-xs border-r border-gray-300", showDate && "border-t-2 border-t-gray-400")}>{s.hora}</TableCell>
                          <TableCell className={cn("p-1 text-xs border-r border-gray-300", showDate && "border-t-2 border-t-gray-400")}>{s.servicio}</TableCell>
                          <TableCell className={cn("p-1 text-center text-xs border-r border-gray-300", showDate && "border-t-2 border-t-gray-400")}>{s.vuelo || "—"}</TableCell>
                          <TableCell className={cn("p-1 text-center text-xs border-r border-gray-300", showDate && "border-t-2 border-t-gray-400")}>{guiaFirstName}</TableCell>
                          <TableCell className={cn("p-1 text-center text-xs border-r border-gray-300", showDate && "border-t-2 border-t-gray-400")}>{s.bus}</TableCell>
                          <TableCell className={cn("p-1 text-center text-xs border-r border-gray-300", showDate && "border-t-2 border-t-gray-400")}>{choferFirstName}</TableCell>
                          <TableCell className={cn("p-1 text-xs", showDate && "border-t-2 border-t-gray-400")}>{s.observaciones}</TableCell>
                        </TableRow>
                       )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Observaciones y Nota */}
              <div className="mt-4 space-y-2 text-xs">
                <div className="border border-gray-400 rounded p-2">
                  <p className="font-bold mb-1">OBSERVACIONES:</p>
                  <p className="whitespace-pre-wrap">{data.observations || "—"}</p>
                </div>
                <div className="border border-gray-400 rounded p-2">
                  <p className="font-bold mb-1">NOTA:</p>
                  <p className="whitespace-pre-wrap">{data.nota || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-background">
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={handleCopy}
            disabled={isCopying}
          >
            {isCopying ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FaWhatsapp className="mr-2 h-4 w-4" />}
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
