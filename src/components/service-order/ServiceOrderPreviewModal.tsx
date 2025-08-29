
"use client";

import { type StoredServiceOrder } from '@/lib/serviceOrderStorage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parse } from 'date-fns';

interface ServiceOrderPreviewModalProps {
    order: StoredServiceOrder;
    onClose: () => void;
}

export function ServiceOrderPreviewModal({ order, onClose }: ServiceOrderPreviewModalProps) {
    const { data } = order;

    // Sort services by date and then by time before rendering
    const sortedServices = [...data.services].sort((a, b) => {
        try {
            const dateA = parse(a.fecha, 'dd/MM/yyyy', new Date()).getTime();
            const dateB = parse(b.fecha, 'dd/MM/yyyy', new Date()).getTime();
            if (dateA !== dateB) {
                return dateA - dateB;
            }
        } catch (e) {
             // Handle potential parsing errors if dates are malformed
             console.error("Date parsing error during sort:", e);
        }
        // If dates are the same or parsing fails, sort by time
        return a.hora.localeCompare(b.hora);
    });

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-full flex flex-col p-4">
                 <div className="overflow-y-auto p-2 flex-grow">
                    <DialogHeader className="p-2 pb-2 text-center mt-[-1rem] mb-2">
                        <DialogTitle className="font-mono text-2xl uppercase">ORDEN DE SERVICIOS</DialogTitle>
                    </DialogHeader>
                    <div className="border-3 border-primary/20 rounded-lg overflow-hidden">
                       <Table>
                            <TableBody>
                                <TableRow className="font-mono text-sm uppercase border-b-primary/20">
                                    <TableCell className="font-bold p-2 w-36 text-primary border-r border-primary/20">GUIA:</TableCell><TableCell className="p-2" colSpan={7}>{data.guia}</TableCell>
                                </TableRow>
                                <TableRow className="font-mono text-sm uppercase border-b-primary/20">
                                    <TableCell className="font-bold p-2 w-36 text-primary border-r border-primary/20">FILE:</TableCell><TableCell className="p-2" colSpan={7}>{data.file}</TableCell>
                                </TableRow>
                                <TableRow className="font-mono text-sm uppercase border-b-primary/20">
                                    <TableCell className="font-bold p-2 w-36 text-primary border-r border-primary/20">REF:</TableCell><TableCell className="p-2" colSpan={7}>{data.ref}</TableCell>
                                </TableRow>
                                <TableRow className="font-mono text-sm uppercase border-b-primary/20">
                                    <TableCell className="font-bold p-2 w-36 text-primary border-r border-primary/20">Nº PAX:</TableCell><TableCell className="p-2" colSpan={7}>{data.nPax}</TableCell>
                                </TableRow>
                                <TableRow className="font-mono text-sm uppercase">
                                    <TableCell className="font-bold p-2 w-36 text-primary border-r border-primary/20">HOTEL:</TableCell><TableCell className="p-2" colSpan={7}>{data.hotel}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                        <Table>
                             <TableHeader>
                                <TableRow className="bg-primary/10 hover:bg-primary/10 uppercase">
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-b border-primary/20">Fecha</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-b border-primary/20">Hora</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-b border-primary/20" colSpan={2}>Servicio</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-b border-primary/20">Guía</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-b border-primary/20">Bus</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-b border-primary/20">Chofer</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-b border-primary/20">Observaciones</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {sortedServices.length > 0 ? (
                                    sortedServices.map((s, i) => {
                                        const showDate = i === 0 || sortedServices[i-1].fecha !== s.fecha;
                                        return (
                                            <TableRow key={i} className="font-mono text-xs uppercase border-b-primary/20">
                                                <TableCell className="p-2 align-top">{showDate ? s.fecha : ''}</TableCell>
                                                <TableCell className="p-2 align-top">{s.hora}</TableCell>
                                                <TableCell className="p-2 align-top" colSpan={2}>{s.servicio}</TableCell>
                                                <TableCell className="p-2 align-top">{s.guia}</TableCell>
                                                <TableCell className="p-2 align-top">{s.bus}</TableCell>
                                                <TableCell className="p-2 align-top">{s.chofer?.replace(/^CONT\s/i, '')}</TableCell>
                                                <TableCell className="p-2 align-top">{s.observaciones}</TableCell>
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
                         <Table>
                             <TableBody>
                                <TableRow className="font-mono text-sm uppercase border-t border-b-primary/20">
                                    <TableCell className="font-bold p-2 w-36 align-top text-primary border-r border-primary/20">OBSERVACIONES:</TableCell>
                                    <TableCell className="p-2 text-xs whitespace-pre-wrap" colSpan={7}>{data.observations}</TableCell>
                                </TableRow>
                                <TableRow className="font-mono text-sm uppercase">
                                    <TableCell className="font-bold p-2 w-36 align-top text-primary border-r border-primary/20">NOTA:</TableCell>
                                    <TableCell className="p-2 text-xs whitespace-pre-wrap" colSpan={7}>{data.nota}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
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
