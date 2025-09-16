

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

// This function creates a non-React modal and injects pure HTML.
export function showSimplePreviewModal(order: StoredServiceOrder) {
    const existingModal = document.getElementById('simple-preview-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'simple-preview-modal';
    modal.style.position = 'fixed';
    modal.style.zIndex = '50';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.overflow = 'auto';
    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.background = '#f0f2f5'; // A light gray background for the modal window
    content.style.padding = '0';
    content.style.border = '1px solid #888';
    content.style.width = '1200px'; // Fixed width for the modal window
    content.style.maxWidth = '95vw';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.maxHeight = '95vh';
    content.style.borderRadius = '8px';
    content.style.boxShadow = '0 4px 8px 0 rgba(0,0,0,0.2),0 6px 20px 0 rgba(0,0,0,0.19)';

    const header = document.createElement('div');
    header.style.padding = '1rem';
    header.style.borderBottom = '1px solid #ddd';
    header.style.backgroundColor = '#f8f9fa';
    header.innerHTML = '<h2 style="margin:0; font-size: 1.25rem; display: flex; align-items: center; gap: 8px;"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>Vista Previa de Orden de Servicio</h2>';

    const body = document.createElement('div');
    body.style.overflowY = 'auto';
    body.style.flexGrow = '1';
    body.style.padding = '1.5rem';
    body.style.backgroundColor = '#e9ecef'; // A slightly darker gray for the scroll area

    const previewWrapper = document.createElement('div');
    previewWrapper.id = 'capture-this-div'; // ID for the capture function
    
    // Inject the generated HTML and styles
    previewWrapper.innerHTML = `
      <style>
        .orden-preview-wrapper {
            width: 1120px; /* Fixed width for the content itself */
            margin: 0 auto; /* Center the content */
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.4;
            text-transform: uppercase;
            background: white;
            color: black;
            padding: 2rem;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            border-radius: 4px;
        }
        .orden-title { text-align: center; font-size: 1.8rem; font-weight: bold; margin-bottom: 25px; letter-spacing: 2px; border-bottom: 3px solid #000; padding-bottom: 10px; }
        .orden-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        .info-table { font-size: 14px; }
        .services-table { table-layout: fixed; }
        .orden-table th, .orden-table td { padding: 12px 10px; text-align: left; vertical-align: middle; word-wrap: break-word; border: 1px dotted #ccc; }
        .info-table td { border: 1px solid #ddd; }
        .services-table thead th { background-color: #f0f0f0; font-weight: bold; letter-spacing: 0.5px; border: 1px solid #ccc; font-size: 11px; padding: 12px 10px; text-align: center; vertical-align: middle; }
        .orden-table td.label-col { font-weight: bold; background: #f8f8f8; width: 100px; }
        .orden-table td.value-col { font-weight: 500; }
        .service-row td { background-color: #ffffff; }
        .service-row:nth-child(even) td { background-color: #f9f9f9; }
        .service-row .date-cell, .service-row .time-cell, .service-row .flight-cell, .service-row .guide-cell, .service-row .bus-cell, .service-row .driver-cell { text-align: center; }
        .date-cell-header, .date-cell { width: 90px; }
        .time-cell-header, .time-cell { width: 60px; }
        .service-cell-header, .service-cell { width: 280px; text-align: left; }
        .flight-cell-header, .flight-cell { width: 80px; }
        .guide-cell-header, .guide-cell { width: 100px; }
        .bus-cell-header, .bus-cell { width: 80px; }
        .driver-cell-header, .driver-cell { width: 100px; }
        .obs-cell-header, .obs-cell { text-align: left; }
        .notes-section { margin-top: 20px; display: grid; grid-template-columns: 1fr; gap: 15px; font-size: 11px; }
        .notes-block { border: 1px solid #ccc; border-radius: 6px; padding: 10px; background: #f8f9fa; min-height: 50px; }
        .notes-title { font-weight: bold; margin-bottom: 5px; }
        .notes-content { white-space: pre-wrap; }
      </style>
    ` + generateOrderHtml(order.data);
    
    body.appendChild(previewWrapper);

    const footer = document.createElement('div');
    footer.style.padding = '1rem';
    footer.style.borderTop = '1px solid #ddd';
    footer.style.backgroundColor = '#f8f9fa';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '8px';

    const copyButton = document.createElement('button');
    copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copiar Imagen</span>';
    copyButton.onclick = () => copiarVistaPreviaAlClipboard(previewWrapper);
    
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Cerrar';
    closeButton.onclick = () => modal.remove();

    // Basic button styling
    [copyButton, closeButton].forEach(btn => {
        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.style.gap = '8px';
        btn.style.padding = '10px 16px';
        btn.style.border = '1px solid transparent';
        btn.style.borderRadius = '6px';
        btn.style.fontWeight = '500';
        btn.style.cursor = 'pointer';
        btn.style.transition = 'background-color 0.2s';
    });
    copyButton.style.backgroundColor = '#16a34a';
    copyButton.style.color = 'white';
    closeButton.style.backgroundColor = '#e2e8f0';
    closeButton.style.color = '#1f2937';

    footer.appendChild(copyButton);
    footer.appendChild(closeButton);

    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    modal.appendChild(content);

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
    
    document.body.appendChild(modal);
}

// This is the exported React component which is now just a controller.
// It doesn't render anything itself, but is called to trigger the modal.
export default function ServiceOrderSimplePreviewModal({ order, onClose }: ServiceOrderSimplePreviewModalProps) {
    // Since this is a React component file, we need to return something, even if null.
    // The actual logic is now fully contained in `showSimplePreviewModal`.
    return null;
}
