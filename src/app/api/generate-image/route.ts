
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { type StoredServiceOrder } from '@/lib/serviceOrderStorage';
import { parse } from 'date-fns';

// Helper function to get a browser instance
async function getBrowser() {
    return puppeteer.launch({
        args: [...chromium.args, '--font-render-hinting=none'],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
    });
}

function generateHtml(order: StoredServiceOrder): string {
    const { data } = order;

    // Sort services by date and then by time
    const sortedServices = [...(data.services || [])].sort((a, b) => {
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

    const servicesHtml = sortedServices.map((s, i) => {
        const showDate = i === 0 || (sortedServices[i - 1] && sortedServices[i - 1].fecha !== s.fecha);
        const guiaCompleto = s.guia || data.guia;
        const guiaFirstName = (guiaCompleto || '').split(' ')[0];
        const choferCompleto = s.chofer || '';
        const choferSanitized = choferCompleto.replace(/^CONT\s/i, '');
        const choferFirstName = choferSanitized.split(' ')[0];
        
        return `
            <tr>
                <td class="date-cell">${showDate && s.fecha ? s.fecha : ""}</td>
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
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
                body {
                    font-family: 'Roboto', sans-serif;
                    background-color: #fff;
                    color: #111;
                    width: 1120px;
                    margin: 0;
                    padding: 5px 10px;
                    box-sizing: border-box;
                    text-transform: uppercase;
                }
                .container {
                    border: 2px solid #a0a0a0;
                    border-radius: 8px;
                    padding: 16px;
                }
                .title {
                    font-size: 24px;
                    font-weight: bold;
                    text-align: center;
                    padding: 16px 0 12px 0;
                }
                .info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                .info-table td { padding: 8px 7px; font-size: 12px; vertical-align: middle; }
                .info-table td:first-child { font-weight: bold; width: 96px; }
                .info-table td:last-child { border: 1px solid #d1d1d1; border-radius: 4px; background-color: #f8f8f8; }

                .services-table-wrapper { border: 1px solid #d1d1d1; border-radius: 8px; overflow: hidden; }
                .services-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                .services-table th, .services-table td { padding: 4px 8px; font-size: 11px; text-align: left; vertical-align: middle; border-right: 1px solid #d1d1d1; word-wrap: break-word; }
                .services-table th { background-color: #f1f1f1; font-weight: bold; text-align: center; border-bottom: 1px solid #d1d1d1; }
                .services-table tr:not(:last-child) td { border-bottom: 1px dotted #d1d1d1; }
                .services-table th:last-child, .services-table td:last-child { border-right: none; }
                .date-cell { width: 86px; text-align: center; font-weight: bold; }
                .time-cell { width: 56px; text-align: center; }
                .service-cell { width: 250px; }
                .flight-cell { width: 78px; text-align: center; }
                .guide-cell { width: 90px; text-align: center; }
                .bus-cell { width: 70px; text-align: center; }
                .driver-cell { width: 85px; text-align: center; }
                .obs-cell { }

                .footer-blocks { margin-top: 16px; display: grid; grid-template-columns: 1fr; gap: 16px; }
                .info-block { border: 1px solid #d1d1d1; border-radius: 4px; padding: 8px; background-color: #f8f8f8; }
                .info-block p:first-child { font-weight: bold; margin-bottom: 4px; font-size: 12px; }
                .info-block p:last-child { white-space: pre-wrap; font-size: 12px; margin: 0; }
            </style>
        </head>
        <body>
            <div class="title">ORDEN DE SERVICIO</div>
            <div class="container">
                <table class="info-table">
                    <tbody>
                        <tr><td>Guía:</td><td>${data.guia || "—"}</td></tr>
                        <tr><td>File:</td><td>${data.file || "—"}</td></tr>
                        <tr><td>Ref:</td><td>${data.ref || "—"}</td></tr>
                        <tr><td>Nº Pax:</td><td>${data.nPax || "—"}</td></tr>
                        <tr><td>Hotel:</td><td>${data.hotel || "—"}</td></tr>
                    </tbody>
                </table>
                <div class="services-table-wrapper">
                    <table class="services-table">
                        <thead>
                            <tr>
                                <th class="date-cell">Fecha</th><th class="time-cell">Hora</th><th class="service-cell">Servicio</th>
                                <th class="flight-cell">Vuelo</th><th class="guide-cell">Guía</th><th class="bus-cell">Bus</th>
                                <th class="driver-cell">Chofer</th><th class="obs-cell">Observaciones</th>
                            </tr>
                        </thead>
                        <tbody>${servicesHtml}</tbody>
                    </table>
                </div>
                <div class="footer-blocks">
                    <div class="info-block">
                        <p>OBSERVACIONES:</p>
                        <p>${data.observations || "—"}</p>
                    </div>
                    <div class="info-block">
                        <p>NOTA:</p>
                        <p>${data.nota || "—"}</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}


export async function POST(req: NextRequest) {
    let browser = null;
    try {
        const order: StoredServiceOrder = await req.json();

        if (!order || !order.data) {
            return NextResponse.json({ error: "Datos de la orden no proporcionados." }, { status: 400 });
        }

        const htmlContent = generateHtml(order);
        
        browser = await getBrowser();
        const page = await browser.newPage();

        // Set a standard viewport that represents a typical A4 page aspect ratio
        await page.setViewport({ width: 1120, height: 1584, deviceScaleFactor: 2 });
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
          }
        });

        await browser.close();

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        });

    } catch (error: any) {
        if (browser) {
            await browser.close();
        }
        console.error('Error generando el PDF:', error);
        return NextResponse.json(
            { error: "Fallo al generar el PDF de la orden.", details: error.message },
            { status: 500 }
        );
    }
}
