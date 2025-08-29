
"use client";

import { type StoredServiceOrder } from '@/lib/serviceOrderStorage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parse } from 'date-fns';
import { cn } from '@/lib/utils';

interface ServiceOrderPreviewModalProps {
    order: StoredServiceOrder;
    onClose: () => void;
}

export function ServiceOrderPreviewModal({ order, onClose }: ServiceOrderPreviewModalProps) {
    const { data } = order;

    const sortedServices = [...data.services].sort((a, b) => {
        try {
            const dateA = parse(a.fecha, 'dd/MM/yyyy', new Date()).getTime();
            const dateB = parse(b.fecha, 'dd/MM/yyyy', new Date()).getTime();
            if (dateA !== dateB) {
                return dateA - dateB;
            }
        } catch (e) {
             console.error("Date parsing error during sort:", e);
        }
        return a.hora.localeCompare(b.hora);
    });

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-full flex flex-col p-4">
                 <div className="overflow-y-auto p-2 flex-grow">
                    <DialogHeader className="p-2 mb-0">
                        <DialogTitle className="font-mono text-sm uppercase text-center">ORDEN DE SERVICIOS</DialogTitle>
                    </DialogHeader>
                    <div className="border-3 border-primary/20 rounded-lg overflow-hidden">
                       <div className="border-2 border-primary/20">
                           <Table>
                                <TableBody>
                                    <TableRow className="font-mono text-[11px] uppercase border-b-primary/20">
                                        <TableCell className="font-bold p-1 w-36 text-primary border-r border-primary/20">GUIA:</TableCell><TableCell className="p-1 uppercase" colSpan={7}>{data.guia}</TableCell>
                                    </TableRow>
                                    <TableRow className="font-mono text-[11px] uppercase border-b-primary/20">
                                        <TableCell className="font-bold p-1 w-36 text-primary border-r border-primary/20">FILE:</TableCell><TableCell className="p-1 uppercase" colSpan={7}>{data.file}</TableCell>
                                    </TableRow>
                                    <TableRow className="font-mono text-[11px] uppercase border-b-primary/20">
                                        <TableCell className="font-bold p-1 w-36 text-primary border-r border-primary/20">REF:</TableCell><TableCell className="p-1 uppercase" colSpan={7}>{data.ref}</TableCell>
                                    </TableRow>
                                    <TableRow className="font-mono text-[11px] uppercase border-b-primary/20">
                                        <TableCell className="font-bold p-1 w-36 text-primary border-r border-primary/20">Nº PAX:</TableCell><TableCell className="p-1 uppercase" colSpan={7}>{data.nPax}</TableCell>
                                    </TableRow>
                                    <TableRow className="font-mono text-[11px] uppercase">
                                        <TableCell className="font-bold p-1 w-36 text-primary border-r border-primary/20">HOTEL:</TableCell><TableCell className="p-1 uppercase" colSpan={7}>{data.hotel}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                       </div>
                        <Table>
                             <TableHeader>
                                <TableRow className="bg-primary/10 hover:bg-primary/10 uppercase">
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px] w-[86px]">Fecha</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px] w-[56px]">Hora</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px]">Servicio</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px] w-[70px]">Vuelo</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px] w-[80px]">Guía</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px] w-[60px]">Bus</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px] w-[80px]">Chofer</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-primary/20 font-mono text-[11px]">Observaciones</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {sortedServices.length > 0 ? (
                                    sortedServices.map((s, i) => {
                                        const showDate = i === 0 || sortedServices[i-1].fecha !== s.fecha;
                                        return (
                                            <TableRow key={i} className="font-mono text-[11px] uppercase border-b-primary/20">
                                                <TableCell className="p-1 align-top border-r border-primary/20">{showDate ? s.fecha : ''}</TableCell>
                                                <TableCell className="p-1 align-top border-r border-primary/20">{s.hora}</TableCell>
                                                <TableCell className="p-1 align-top border-r border-primary/20">{s.servicio}</TableCell>
                                                <TableCell className="p-1 align-top border-r border-primary/20">{s.vuelo}</TableCell>
                                                <TableCell className="p-1 align-top border-r border-primary/20">{s.guia}</TableCell>
                                                <TableCell className="p-1 align-top border-r border-primary/20">{s.bus}</TableCell>
                                                <TableCell className="p-1 align-top border-r border-primary/20">{s.chofer?.replace(/^CONT\s/i, '')}</TableCell>
                                                <TableCell className="p-1 align-top border-r border-primary/20">{s.observaciones}</TableCell>
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
                         <div className="border-2 border-primary/20">
                            <Table>
                                 <TableBody>
                                    <TableRow className="font-mono uppercase border-t border-b-primary/20">
                                        <TableCell className="font-bold p-1 w-36 align-top text-primary border-r border-primary/20 text-[10px]">OBSERVACIONES:</TableCell>
                                        <TableCell className="p-1 text-[10px] whitespace-pre-wrap uppercase" colSpan={7}>{data.observations}</TableCell>
                                    </TableRow>
                                    <TableRow className="font-mono uppercase">
                                        <TableCell className="font-bold p-1 w-36 align-top text-primary border-r border-primary/20 text-[10px]">NOTA:</TableCell>
                                        <TableCell className="p-1 text-[10px] whitespace-pre-wrap uppercase" colSpan={7}>{data.nota}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-2 pt-4 border-t mt-auto">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cerrar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
