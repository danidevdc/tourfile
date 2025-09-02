
"use client";

import { type StoredServiceOrder } from '@/lib/serviceOrderStorage';
import { parse } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo } from 'react';

interface ServiceOrderPDFLayoutProps {
    order: StoredServiceOrder;
}

export function ServiceOrderPDFLayout({ order }: ServiceOrderPDFLayoutProps) {
    const { data } = order;

    const sortedServices = useMemo(() => [...data.services].sort((a, b) => {
        try {
            const dateA = parse(a.fecha, 'dd/MM/yyyy', new Date()).getTime();
            const dateB = parse(b.fecha, 'dd/MM/yyyy', new Date()).getTime();
            if (dateA !== dateB) return dateA - dateB;
        } catch (e) {
            console.error("Date parsing error during sort:", e);
        }
        return a.hora.localeCompare(b.hora);
    }), [data.services]);

    const dateColorGroupMap = useMemo(() => {
        const map = new Map<string, number>();
        if (sortedServices.length === 0) return map;
        
        let colorGroupIndex = 0;
        map.set(sortedServices[0].fecha, colorGroupIndex);

        for (let i = 1; i < sortedServices.length; i++) {
            if (sortedServices[i].fecha !== sortedServices[i-1].fecha) {
                colorGroupIndex++;
            }
            map.set(sortedServices[i].fecha, colorGroupIndex);
        }
        return map;
    }, [sortedServices]);

    return (
        <div id={`pdf-content-${order.id}`} className="bg-white text-zinc-900 p-0" style={{ width: '1123px', height: 'auto', minHeight: '794px' }}>
            <div className="relative">
                <div className="h-1.5 w-full bg-gradient-to-r from-primary/90 via-primary to-primary/70" />
                <div className="px-6 pt-4 pb-3 flex items-center justify-center">
                    <h1 className="text-xs font-mono font-bold uppercase">ORDEN DE SERVICIO</h1>
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
                            <TableRow className="bg-primary/10 hover:bg-primary/10 uppercase h-auto">
                                <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono h-auto w-[86px] text-center align-middle" style={{fontSize: '11px'}}>Fecha</TableHead>
                                <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono h-auto w-[56px] text-center align-middle" style={{fontSize: '11px'}}>Hora</TableHead>
                                <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono h-auto text-left align-middle" style={{fontSize: '11px'}}>Servicio</TableHead>
                                <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono h-auto w-[70px] text-center align-middle" style={{fontSize: '11px'}}>Vuelo</TableHead>
                                <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono h-auto w-[100px] text-center align-middle" style={{fontSize: '11px'}}>Guía</TableHead>
                                <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono h-auto w-[70px] text-center align-middle" style={{fontSize: '11px'}}>Bus</TableHead>
                                <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono h-auto w-[80px] text-center align-middle" style={{fontSize: '11px'}}>Chofer</TableHead>
                                <TableHead className="text-primary font-semibold py-1 px-2 font-mono h-auto text-left align-middle" style={{fontSize: '11px'}}>Observaciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedServices.length ? sortedServices.map((s, i) => {
                                const showDate = i === 0 || sortedServices[i - 1].fecha !== s.fecha;
                                const colorGroup = dateColorGroupMap.get(s.fecha) || 0;
                                const rowBgClass = colorGroup % 2 === 0 ? "bg-white" : "bg-zinc-50";

                                return (
                                    <TableRow key={i} className={cn("uppercase break-words align-middle h-8", rowBgClass)} style={{fontSize: '11px'}}>
                                        <TableCell className="p-1 align-middle border-r border-primary/10 text-center">
                                            {showDate && s.fecha ? (
                                                <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-semibold text-primary font-mono">
                                                    {s.fecha}
                                                </span>
                                            ) : ("")}
                                        </TableCell>
                                        <TableCell className="p-1 align-middle border-r border-primary/10 text-center"><span className="rounded px-1 py-0.5 border font-mono">{s.hora}</span></TableCell>
                                        <TableCell className="p-1 align-middle border-r border-primary/10 text-left font-mono">{s.servicio}</TableCell>
                                        <TableCell className="p-1 align-middle border-r border-primary/10 text-center font-mono">{s.vuelo || "—"}</TableCell>
                                        <TableCell className="p-1 align-middle border-r border-primary/10 text-center font-mono">{s.guia}</TableCell>
                                        <TableCell className="p-1 align-middle border-r border-primary/10 text-center font-mono">{s.bus}</TableCell>
                                        <TableCell className="p-1 align-middle border-r border-primary/10 text-center font-mono">{s.chofer?.replace(/^CONT\s/i, "")}</TableCell>
                                        <TableCell className="p-1 align-middle text-left font-mono">{s.observaciones}</TableCell>
                                    </TableRow>
                                );
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground uppercase font-mono">No hay servicios en esta orden.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="px-6 py-4 grid grid-cols-1 gap-4">
                <InfoBlock title="OBSERVACIONES:" text={data.observations} subtle />
                <InfoBlock title="NOTA:" text={data.nota} subtle />
            </div>
        </div>
    );
}

function MetaItem({ label, value, className }: { label: string; value?: string | number; className?: string }) {
    return (
        <div className={cn("rounded-lg border border-primary/50 bg-card/50 px-3 py-1 flex items-center justify-center gap-2 font-mono", className)} style={{fontSize: '12px'}}>
            <p className="font-bold uppercase">{label}</p>
            <p className="uppercase">{value || "—"}</p>
        </div>
    );
}

function InfoBlock({ title, text, subtle = false }: { title: string; text?: string; subtle?: boolean }) {
    return (
        <div className={cn("rounded-xl border p-2", subtle ? "bg-muted/40 border-dashed" : "bg-card/20")}>
            <p className="font-mono uppercase tracking-wide text-primary mb-1 font-bold" style={{fontSize: '10px'}}>{title}</p>
            <p className="uppercase font-mono whitespace-pre-wrap leading-5" style={{fontSize: '10px'}}>{text || "—"}</p>
        </div>
    );
}
