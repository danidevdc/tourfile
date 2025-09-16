
"use client";

import React, { useMemo, useRef, useState } from "react";
import { parse } from "date-fns";
import { type StoredServiceOrder } from "@/lib/serviceOrderStorage";
import { cn } from "@/lib/utils";
import { copiarVistaPreviaAlClipboard } from "@/lib/copyPreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ServiceOrderSimplePreviewModalProps {
  order: StoredServiceOrder;
  onClose: () => void;
}

const generateOrderHtml = (orderData: StoredServiceOrder['data']): string => {
    const { guia, file, ref, nPax, hotel, services, observations, nota } = orderData;

    const sortedServices = [...(services || [])].sort((a, b) => {
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

    const infoRows = `
        <tr><td class="label-col">Guía:</td><td class="value-col">${guia || '—'}</td></tr>
        <tr><td class="label-col">File:</td><td class="value-col">${file || '—'}</td></tr>
        <tr><td class="label-col">Ref:</td><td class="value-col">${ref || '—'}</td></tr>
        <tr><td class="label-col">Nº Pax:</td><td class="value-col">${nPax || '—'}</td></tr>
        <tr><td class="label-col">Hotel:</td><td class="value-col">${hotel || '—'}</td></tr>
    `;

    const serviceRows = sortedServices.map((s, i) => {
        const showDate = i === 0 || sortedServices[i - 1].fecha !== s.fecha;
        const guiaCompleto = s.guia || guia;
        const guiaFirstName = (guiaCompleto || '').split(' ')[0];
        const choferCompleto = s.chofer || '';
        const choferSanitized = choferCompleto.replace(/^CONT\s/i, '');
        const choferFirstName = choferSanitized.split(' ')[0];
        
        return `
            <tr class="service-row">
                <td class="date-cell">${showDate ? s.fecha : ""}</td>
                <td class="time-cell">${s.hora || ''}</td>
                <td class="service-cell">${s.servicio || ''}</td>
                <td class="flight-cell">${s.vuelo || "—"}</td>
                <td class="guide-cell">${guiaFirstName}</td>
                <td class="bus-cell">${s.bus || ''}</td>
                <td class="driver-cell">${choferFirstName}</td>
                <td class="obs-cell">${s.observaciones || ''}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="orden-title">ORDEN DE SERVICIO</div>
        <table class="orden-table info-table">
            <tbody>
                ${infoRows}
            </tbody>
        </table>
        <table class="orden-table services-table">
            <thead>
                <tr>
                    <th class="date-cell-header">Fecha</th>
                    <th class="time-cell-header">Hora</th>
                    <th class="service-cell-header">Servicio</th>
                    <th class="flight-cell-header">Vuelo</th>
                    <th class="guide-cell-header">Guía</th>
                    <th class="bus-cell-header">Bus</th>
                    <th class="driver-cell-header">Chofer</th>
                    <th class="obs-cell-header">Observaciones</th>
                </tr>
            </thead>
            <tbody>
                ${serviceRows || '<tr><td colspan="8" style="text-align:center; padding: 20px;">No hay servicios.</td></tr>'}
            </tbody>
        </table>
        <div class="notes-section">
            <div class="notes-block">
                <div class="notes-title">OBSERVACIONES:</div>
                <div class="notes-content">${observations || '—'}</div>
            </div>
            <div class="notes-block">
                <div class="notes-title">NOTA:</div>
                <div class="notes-content">${nota || '—'}</div>
            </div>
        </div>
    `;
};


export default function ServiceOrderSimplePreviewModal({ order, onClose }: ServiceOrderSimplePreviewModalProps) {
  const captureRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isCopying, setIsCopying] = useState(false);

  const orderHtmlString = useMemo(() => generateOrderHtml(order.data), [order.data]);
  
  const handleCopy = async () => {
    setIsCopying(true);
    await copiarVistaPreviaAlClipboard(captureRef, toast);
    setIsCopying(false);
  };

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-6xl w-full flex flex-col max-h-[95vh] p-0 shadow-2xl">
        <DialogHeader className="p-4 border-b bg-slate-100 dark:bg-slate-900 text-black dark:text-white rounded-t-lg">
          <DialogTitle className="flex items-center gap-2">
            <FileText />
            Vista Previa de Orden de Servicio
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6 bg-gray-200 dark:bg-gray-800">
          <div ref={captureRef}>
            <div
                className="orden-preview-wrapper bg-white text-black p-8 w-[1120px] mx-auto shadow-lg rounded-lg"
                dangerouslySetInnerHTML={{ __html: orderHtmlString }}
            />
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-slate-50 dark:bg-slate-800 rounded-b-lg">
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

        <style jsx global>{`
            .orden-preview-wrapper {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.4;
                text-transform: uppercase;
            }
            .orden-title {
                text-align: center;
                font-size: 1.8rem;
                font-weight: bold;
                color: #000000;
                margin-bottom: 25px;
                letter-spacing: 2px;
                border-bottom: 3px solid #000000;
                padding-bottom: 10px;
            }
            .orden-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
                font-size: 12px;
            }
            .info-table {
                font-size: 14px;
            }
            .services-table {
                table-layout: fixed;
            }
            .orden-table th, .orden-table td {
                padding: 12px 10px;
                text-align: left;
                vertical-align: middle;
                word-wrap: break-word;
                border: 1px dotted #ccc;
            }
            .info-table td {
                 border: 1px solid #ddd;
            }
            .services-table thead th {
                background-color: #f0f0f0;
                color: #000000;
                font-weight: bold;
                letter-spacing: 0.5px;
                border: 1px solid #ccc;
                font-size: 11px;
                padding: 12px 10px;
                text-align: center;
                vertical-align: middle;
            }
            .orden-table td.label-col {
                font-weight: bold;
                color: #000000;
                background: #f8f8f8;
                width: 100px;
            }
            .orden-table td.value-col {
                color: #333333;
                font-weight: 500;
            }
             .service-row td {
                vertical-align: middle;
                background-color: #ffffff;
                color: #000000;
            }
            .service-row:nth-child(even) td {
                background-color: #f9f9f9;
            }
            .service-row .date-cell, .service-row .time-cell, .service-row .flight-cell, .service-row .guide-cell, .service-row .bus-cell, .service-row .driver-cell {
                text-align: center;
            }
            .date-cell-header, .date-cell { width: 90px; }
            .time-cell-header, .time-cell { width: 60px; }
            .service-cell-header, .service-cell { width: 280px; text-align: left; }
            .flight-cell-header, .flight-cell { width: 80px; }
            .guide-cell-header, .guide-cell { width: 100px; }
            .bus-cell-header, .bus-cell { width: 80px; }
            .driver-cell-header, .driver-cell { width: 100px; }
            .obs-cell-header, .obs-cell { text-align: left; }

            .notes-section {
                margin-top: 20px;
                display: grid;
                grid-template-columns: 1fr;
                gap: 15px;
                font-size: 11px;
                color: #000000;
            }
            .notes-block {
                border: 1px solid #ccc;
                border-radius: 6px;
                padding: 10px;
                background: #f8f9fa;
                min-height: 50px;
            }
            .notes-title {
                font-weight: bold;
                color: #000000;
                margin-bottom: 5px;
            }
            .notes-content {
                white-space: pre-wrap;
                color: #000000;
            }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

    