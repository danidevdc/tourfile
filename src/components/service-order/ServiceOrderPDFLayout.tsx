
"use client";

import { type StoredServiceOrder } from '@/lib/serviceOrderStorage';
import { parse } from 'date-fns';

interface ServiceOrderPDFLayoutProps {
    order: StoredServiceOrder;
}

export function ServiceOrderPDFLayout({ order }: ServiceOrderPDFLayoutProps) {
    const { data } = order;

    const sortedServices = [...data.services].sort((a, b) => {
        try {
            const dateA = parse(a.fecha, 'dd/MM/yyyy', new Date()).getTime();
            const dateB = parse(b.fecha, 'dd/MM/yyyy', new Date()).getTime();
            if (dateA !== dateB) return dateA - dateB;
        } catch (e) {
            console.error("Date parsing error during sort:", e);
        }
        return a.hora.localeCompare(b.hora);
    });

    return (
        <div id={`pdf-content-${order.id}`} className="bg-white text-black p-4" style={{ width: '1123px', height: '794px', fontFamily: 'Calibri, sans-serif' }}>
            <div className="p-2 mb-0">
                <h1 className="font-mono text-sm uppercase text-center font-bold">ORDEN DE SERVICIOS</h1>
            </div>
            <div className="border-2 border-black rounded-lg overflow-hidden">
                <div className="border-2 border-black">
                    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr className="font-mono text-[11px] uppercase border-b border-black">
                                <td className="font-bold p-1 w-36 border-r border-black align-top">GUIA:</td><td className="p-1 uppercase align-top" colSpan={7}>{data.guia}</td>
                            </tr>
                            <tr className="font-mono text-[11px] uppercase border-b border-black">
                                <td className="font-bold p-1 w-36 border-r border-black align-top">FILE:</td><td className="p-1 uppercase align-top" colSpan={7}>{data.file}</td>
                            </tr>
                            <tr className="font-mono text-[11px] uppercase border-b border-black">
                                <td className="font-bold p-1 w-36 border-r border-black align-top">REF:</td><td className="p-1 uppercase align-top" colSpan={7}>{data.ref}</td>
                            </tr>
                            <tr className="font-mono text-[11px] uppercase border-b border-black">
                                <td className="font-bold p-1 w-36 border-r border-black align-top">Nº PAX:</td><td className="p-1 uppercase align-top" colSpan={7}>{data.nPax}</td>
                            </tr>
                            <tr className="font-mono text-[11px] uppercase">
                                <td className="font-bold p-1 w-36 border-r border-black align-top">HOTEL:</td><td className="p-1 uppercase align-top" colSpan={7}>{data.hotel}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="bg-gray-200 uppercase">
                            <th className="font-bold py-0.5 px-1 border-t border-b border-r border-black font-mono text-[11px] h-auto w-[86px] text-center">Fecha</th>
                            <th className="font-bold py-0.5 px-1 border-t border-b border-r border-black font-mono text-[11px] h-auto w-[56px] text-center">Hora</th>
                            <th className="font-bold py-0.5 px-1 border-t border-b border-r border-black font-mono text-[11px] h-auto text-left">Servicio</th>
                            <th className="font-bold py-0.5 px-1 border-t border-b border-r border-black font-mono text-[11px] h-auto w-[70px] text-center">Vuelo</th>
                            <th className="font-bold py-0.5 px-1 border-t border-b border-r border-black font-mono text-[11px] h-auto w-[80px] text-center">Guía</th>
                            <th className="font-bold py-0.5 px-1 border-t border-b border-r border-black font-mono text-[11px] h-auto w-[60px] text-center">Bus</th>
                            <th className="font-bold py-0.5 px-1 border-t border-b border-r border-black font-mono text-[11px] h-auto w-[80px] text-center">Chofer</th>
                            <th className="font-bold py-0.5 px-1 border-t border-b border-black font-mono text-[11px] h-auto text-left">Observaciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedServices.length > 0 ? sortedServices.map((s, i) => {
                            const showDate = i === 0 || sortedServices[i-1].fecha !== s.fecha;
                            return (
                                <tr key={i} className="font-mono text-[11px] uppercase border-b border-black">
                                    <td className="p-1 align-top border-r border-black text-center">{showDate ? s.fecha : ''}</td>
                                    <td className="p-1 align-top border-r border-black text-center">{s.hora}</td>
                                    <td className="p-1 align-top border-r border-black text-left">{s.servicio}</td>
                                    <td className="p-1 align-top border-r border-black text-center">{s.vuelo}</td>
                                    <td className="p-1 align-top border-r border-black text-center">{s.guia}</td>
                                    <td className="p-1 align-top border-r border-black text-center">{s.bus}</td>
                                    <td className="p-1 align-top border-r border-black text-center">{s.chofer?.replace(/^CONT\s/i, '')}</td>
                                    <td className="p-1 align-top text-left border-r border-black">{s.observaciones}</td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={8} className="h-24 text-center uppercase font-mono">No hay servicios en esta orden.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <div className="border-2 border-black">
                    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr className="font-mono uppercase border-t border-b border-black">
                                <td className="font-bold p-1 w-36 align-top border-r border-black text-[10px]">OBSERVACIONES:</td>
                                <td className="p-1 text-[10px] whitespace-pre-wrap uppercase bg-gray-100 align-top" colSpan={7}>{data.observations}</td>
                            </tr>
                            <tr className="font-mono uppercase">
                                <td className="font-bold p-1 w-36 align-top border-r border-black text-[10px]">NOTA:</td>
                                <td className="p-1 text-[10px] whitespace-pre-wrap uppercase bg-gray-100 align-top" colSpan={7}>{data.nota}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
