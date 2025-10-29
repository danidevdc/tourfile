

"use client";

import { parse } from "date-fns";
import type { StoredServiceOrder } from "./serviceOrderStorage";
import { copiarVistaPreviaAlClipboard } from "./copyPreview";

const generateOrderHtml = (orderData: StoredServiceOrder['data']): string => {
    const { guia, file, ref, nPax, hotel, services, observations, nota } = orderData;

    // For driver orders, guia already contains all guides separated by comma
    // For guide orders, guia contains the single guide
    // So we use guia directly without processing individual service guides
    const displayGuide = guia || '—';


    const infoRows = `
        <tr><td class="info-label">Guía:</td><td class="info-value">${displayGuide || '—'}</td></tr>
        <tr><td class="info-label">File:</td><td class="info-value">${file || '—'}</td></tr>
        <tr><td class="info-label">Ref:</td><td class="info-value">${ref || '—'}</td></tr>
        <tr><td class="info-label">Nº Pax:</td><td class="info-value">${nPax || '—'}</td></tr>
        <tr><td class="info-label">Hotel:</td><td class="info-value">${hotel || '—'}</td></tr>
    `;

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

    const serviceRows = sortedServices.map((s, i) => {
        const showDate = i === 0 || sortedServices[i - 1].fecha !== s.fecha;
        const guiaCompleto = s.guia || guia;
        const guiaFirstName = (guiaCompleto || '').split(' ')[0];
        const choferCompleto = s.chofer || '';
        const choferSanitized = choferCompleto.replace(/^CONT\s/i, '');
        const choferFirstName = choferSanitized.split(' ')[0];
        
        return `
            <tr class="service-row">
                <td class="date-cell">${showDate ? (s.fecha || "") : ""}</td>
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
        <table class="orden-table info-table"><tbody>${infoRows}</tbody></table>
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

export function showSimplePreviewModal(order: StoredServiceOrder, onStatusUpdate?: (orderId: string) => void) {
    console.log("[showSimplePreviewModal] Received order data:", order);
    const existingModal = document.getElementById('simple-preview-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'simple-preview-modal';
    modal.className = 'modal-overlay';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = '<h2><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>Vista Previa</h2>';

    const body = document.createElement('div');
    body.className = 'modal-body';

    const previewWrapper = document.createElement('div');
    previewWrapper.id = 'capture-this-div';
    previewWrapper.className = 'orden-preview-wrapper';
    
    // Detect dark mode from the <html> element
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    previewWrapper.innerHTML = `
      <style>
        .modal-overlay { position: fixed; z-index: 50; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; }
        .modal-content { background: ${isDarkMode ? '#1a202c' : '#f0f2f5'}; color: ${isDarkMode ? '#e2e8f0' : '#1f2937'}; padding: 0; border: 1px solid ${isDarkMode ? '#2d3748' : '#888'}; width: auto; max-width: 95vw; display: flex; flex-direction: column; max-height: 95vh; border-radius: 8px; box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2),0 6px 20px 0 rgba(0,0,0,0.19); }
        .modal-header { padding: 1rem; border-bottom: 1px solid ${isDarkMode ? '#2d3748' : '#ddd'}; background-color: ${isDarkMode ? '#2d3748' : '#f8f9fa'}; }
        .modal-header h2 { margin:0; font-size: 1.25rem; display: flex; align-items: center; gap: 8px; color: ${isDarkMode ? '#a0aec0' : '#4a5568'}; }
        .modal-body { overflow-y: auto; flex-grow: 1; padding: 1.5rem; background-color: ${isDarkMode ? '#2d3748' : '#e9ecef'}; }
        .modal-footer { padding: 1rem; border-top: 1px solid ${isDarkMode ? '#2d3748' : '#ddd'}; background-color: ${isDarkMode ? '#2d3748' : '#f8f9fa'}; display: flex; justify-content: flex-end; gap: 8px; align-items: center; }
        .modal-footer button { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border: 1px solid transparent; border-radius: 6px; font-weight: 500; cursor: pointer; transition: background-color 0.2s; }
        .copy-button { background-color: #16a34a; color: white; }
        .close-button { background-color: #e2e8f0; color: #1f2937; }
        
        .status-indicator { display: inline-block; width: 20px; text-align: center; }
        .spinner { border: 2px solid #4a5568; border-top: 2px solid #3498db; border-radius: 50%; width: 14px; height: 14px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .check { color: #34d399; font-weight: bold; }
        .cross { color: #ef4444; font-weight: bold; }

        .orden-preview-wrapper { width: 1120px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.4; text-transform: uppercase; background: ${isDarkMode ? '#111827' : 'white'}; color: ${isDarkMode ? '#d1d5db' : 'black'}; padding: 2rem; box-shadow: 0 0 10px rgba(0,0,0,0.1); border-radius: 4px; }
        .orden-title { text-align: center; font-size: 1rem; font-weight: bold; margin-bottom: 15px; letter-spacing: 1.5px; }
        .orden-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .info-table { font-size: 10px; border-collapse: collapse; border-spacing: 0; }
        .services-table { table-layout: fixed; font-size: 10px; }
        .orden-table th, .orden-table td { padding: 8px 8px; vertical-align: middle; word-wrap: break-word; }
        .info-table td.info-label { font-weight: bold; background: ${isDarkMode ? '#1f2937' : '#f0f0f0'}; width: 80px; border: 1px solid ${isDarkMode ? '#4b5563' : '#ccc'}; }
        .info-table td.info-value { font-weight: 500; background: ${isDarkMode ? '#111827' : '#ffffff'}; border: 1px solid ${isDarkMode ? '#4b5563' : '#ccc'}; border-left: none; }
        .services-table thead th { background-color: ${isDarkMode ? '#1f2937' : '#f0f0f0'}; font-weight: bold; letter-spacing: 0.5px; border: 1px solid ${isDarkMode ? '#4b5563' : '#ccc'}; text-align: center; }
        .services-table tbody td { border: 1px dotted ${isDarkMode ? '#4b5563' : '#ccc'}; }
        .service-row .date-cell, .service-row .time-cell, .service-row .flight-cell, .service-row .guide-cell, .service-row .bus-cell, .service-row .driver-cell { text-align: center; }
        .service-row .service-cell, .service-row .obs-cell { text-align: left; }
        .date-cell-header, .date-cell { width: 80px; }
        .time-cell-header, .time-cell { width: 60px; }
        .service-cell-header, .service-cell { width: 280px; }
        .flight-cell-header, .flight-cell { width: 80px; }
        .guide-cell-header, .guide-cell { width: 100px; }
        .bus-cell-header, .bus-cell { width: 80px; }
        .driver-cell-header, .driver-cell { width: 100px; }
        .obs-cell-header, .obs-cell { }
        .notes-section { margin-top: 20px; display: grid; grid-template-columns: 1fr; gap: 15px; font-size: 11px; }
        .notes-block { border: 1px solid ${isDarkMode ? '#4b5563' : '#ccc'}; border-radius: 6px; padding: 10px; background: ${isDarkMode ? '#1f2937' : '#f8f9fa'}; min-height: 50px; }
        .notes-title { font-weight: bold; margin-bottom: 5px; }
        .notes-content { white-space: pre-wrap; }
      </style>
    ` + generateOrderHtml(order.data);
    
    body.appendChild(previewWrapper);

    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copiar imagen a WhatsApp</span>';
    
    const statusIndicator = document.createElement('span');
    statusIndicator.className = 'status-indicator';

    copyButton.onclick = async () => {
        statusIndicator.innerHTML = '<div class="spinner"></div>';
        const success = await copiarVistaPreviaAlClipboard(previewWrapper);
        if (success) {
            statusIndicator.innerHTML = '<span class="check">✓</span>';
            if (onStatusUpdate) {
                onStatusUpdate(order.id);
            }
        } else {
            statusIndicator.innerHTML = '<span class="cross">✗</span>';
        }
        setTimeout(() => {
            statusIndicator.innerHTML = '';
        }, 3000);
    };
    
    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.textContent = 'Cerrar';
    closeButton.onclick = () => modal.remove();

    footer.appendChild(statusIndicator);
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
