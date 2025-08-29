
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
                    <DialogTitle className="text-2xl font-bold mb-2">ORDEN DE SERVICIOS</DialogTitle>
                    <DialogDescription>
                        Vista previa de la orden generada para el file: {order.data.file}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="overflow-y-auto p-2 flex-grow">
                    {/* Header Info Table */}
                    <div className="border rounded-md p-2 mb-4 font-mono text-sm">
                        <table className="w-full">
                            <tbody>
                                <tr className="border-b"><td className="font-bold p-1 w-24">GUIA:</td><td className="p-1">{data.guia}</td></tr>
                                <tr className="border-b"><td className="font-bold p-1 w-24">FILE:</td><td className="p-1">{data.file}</td></tr>
                                <tr className="border-b"><td className="font-bold p-1 w-24">REF:</td><td className="p-1">{data.ref}</td></tr>
                                <tr className="border-b"><td className="font-bold p-1 w-24">Nº PAX:</td><td className="p-1">{data.nPax}</td></tr>
                                <tr><td className="font-bold p-1 w-24">HOTEL:</td><td className="p-1">{data.hotel}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Services Table */}
                    <div className="border rounded-md overflow-hidden mb-4">
                       <Table>
                            <TableHeader className="bg-primary/10">
                                <TableRow className="border-b-primary/20">
                                    <TableHead className="text-primary font-bold p-2 h-10" style={{width: '86px'}}>Fecha</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10" style={{width: '60px'}}>Hora</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10">Servicio</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10" style={{width: '80px'}}>Vuelo</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10" style={{width: '150px'}}>Guía</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10" style={{width: '70px'}}>Bus</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10" style={{width: '150px'}}>Chofer</TableHead>
                                    <TableHead className="text-primary font-bold p-2 h-10">Observaciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.services.length > 0 ? (
                                    data.services.map((s, i) => (
                                        <TableRow key={i} className="font-mono text-xs border-b-primary/20">
                                            <TableCell className="p-2 align-top">{s.fecha}</TableCell>
                                            <TableCell className="p-2 align-top">{s.hora}</TableCell>
                                            <TableCell className="p-2 align-top font-sans">{s.servicio}</TableCell>
                                            <TableCell className="p-2 align-top">{s.vuelo}</TableCell>
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
                            </TableBody>
                        </Table>
                    </div>

                     {/* Notes Table */}
                    <div className="border rounded-md p-2 font-mono text-sm space-y-2">
                        <div className="flex">
                            <div className="font-bold p-1 w-24 shrink-0">OBS:</div>
                            <div className="p-1 whitespace-pre-wrap">{data.observations}</div>
                        </div>
                        <div className="flex border-t pt-2">
                            <div className="font-bold p-1 w-24 shrink-0">NOTA:</div>
                            <div className="p-1 whitespace-pre-wrap">{data.nota}</div>
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
