
"use client";

import { type StoredServiceOrder } from '@/lib/serviceOrderStorage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ServiceOrderPreviewModalProps {
    order: StoredServiceOrder;
    onClose: () => void;
}

export function ServiceOrderPreviewModal({ order, onClose }: ServiceOrderPreviewModalProps) {
    const { data } = order;

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-full flex flex-col p-4">
                <DialogHeader className="p-2 text-center">
                    <DialogTitle>ORDEN DE SERVICIOS</DialogTitle>
                    <DialogDescription>
                        Vista previa de la orden generada para el file: {order.data.file}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="overflow-y-auto p-2 flex-grow">
                    <div className="border rounded-md overflow-hidden">
                       <Table>
                            <TableHeader className="bg-primary/10 hover:bg-primary/10">
                                <TableRow className="border-b-0">
                                    <TableHead className="text-primary font-bold p-2 h-10" style={{width: '120px'}}></TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10" colSpan={7}></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Header Info as Table Rows */}
                                <TableRow className="font-mono text-sm border-b-primary/20"><TableCell className="font-bold p-2 w-28">GUIA:</TableCell><TableCell className="p-2" colSpan={7}>{data.guia}</TableCell></TableRow>
                                <TableRow className="font-mono text-sm border-b-primary/20"><TableCell className="font-bold p-2 w-28">FILE:</TableCell><TableCell className="p-2" colSpan={7}>{data.file}</TableCell></TableRow>
                                <TableRow className="font-mono text-sm border-b-primary/20"><TableCell className="font-bold p-2 w-28">REF:</TableCell><TableCell className="p-2" colSpan={7}>{data.ref}</TableCell></TableRow>
                                <TableRow className="font-mono text-sm border-b-primary/20"><TableCell className="font-bold p-2 w-28">Nº PAX:</TableCell><TableCell className="p-2" colSpan={7}>{data.nPax}</TableCell></TableRow>
                                <TableRow className="font-mono text-sm border-b-primary/20"><TableCell className="font-bold p-2 w-28">HOTEL:</TableCell><TableCell className="p-2" colSpan={7}>{data.hotel}</TableCell></TableRow>
                                
                                {/* Spacer Row */}
                                <TableRow className="h-4 bg-primary/10 border-b-primary/20 hover:bg-primary/10"><TableCell colSpan={8}></TableCell></TableRow>
                                
                                {/* Services Table Header */}
                                <TableRow className="bg-primary/10 hover:bg-primary/10">
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-primary/20">Fecha</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-primary/20">Hora</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-primary/20" colSpan={2}>Servicio</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-primary/20">Guía</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-primary/20">Bus</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-primary/20">Chofer</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10 border-t border-primary/20">Observaciones</TableHead>
                                </TableRow>

                                {/* Service Items */}
                                {data.services.length > 0 ? (
                                    data.services.map((s, i) => (
                                        <TableRow key={i} className="font-mono text-xs border-b-primary/20">
                                            <TableCell className="p-2 align-top">{s.fecha}</TableCell>
                                            <TableCell className="p-2 align-top">{s.hora}</TableCell>
                                            <TableCell className="p-2 align-top font-sans" colSpan={2}>{s.servicio}</TableCell>
                                            <TableCell className="p-2 align-top font-sans">{s.guia}</TableCell>
                                            <TableCell className="p-2 align-top">{s.bus}</TableCell>
                                            <TableCell className="p-2 align-top font-sans">{s.chofer?.replace(/^CONT\s/i, '')}</TableCell>
                                            <TableCell className="p-2 align-top font-sans">{s.observaciones}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No hay servicios en esta orden.</TableCell>
                                    </TableRow>
                                )}

                                 {/* Spacer Row */}
                                <TableRow className="h-4 bg-primary/10 border-t border-b-primary/20 hover:bg-primary/10"><TableCell colSpan={8}></TableCell></TableRow>

                                {/* Notes Section */}
                                <TableRow className="font-mono text-sm border-b-primary/20">
                                    <TableCell className="font-bold p-2 w-28 align-top">OBS:</TableCell>
                                    <TableCell className="p-2 font-sans text-xs whitespace-pre-wrap" colSpan={7}>{data.observations}</TableCell>
                                </TableRow>
                                <TableRow className="font-mono text-sm">
                                    <TableCell className="font-bold p-2 w-28 align-top">NOTA:</TableCell>
                                    <TableCell className="p-2 font-sans text-xs whitespace-pre-wrap" colSpan={7}>{data.nota}</TableCell>
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
