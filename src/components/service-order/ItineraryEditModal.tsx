
"use client";

import { useState, useEffect, type ChangeEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { type ServiceItem, type ServiceOrderGuide, type Driver } from '@/lib/serviceOrderService';
import { Save, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from 'lucide-react';
import { format, parse, isBefore, startOfToday } from 'date-fns';

interface ItineraryEditModalProps {
    services: ServiceItem[];
    guides: ServiceOrderGuide[];
    drivers: Driver[];
    onSave: (services: ServiceItem[]) => void;
    onClose: () => void;
}

export function ItineraryEditModal({ services, guides, drivers, onSave, onClose }: ItineraryEditModalProps) {
    const [editableServices, setEditableServices] = useState<ServiceItem[]>([]);
    const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);

    useEffect(() => {
        setEditableServices(JSON.parse(JSON.stringify(services)));
    }, [services]);

    const handleServiceChange = (index: number, field: keyof ServiceItem, value: string) => {
        const updatedServices = [...editableServices];
        updatedServices[index] = { ...updatedServices[index], [field]: value.toUpperCase() };
        setEditableServices(updatedServices);
    };

    const handleDateInputChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
        const rawValue = e.target.value;
        const numbersOnly = rawValue.replace(/[^0-9]/g, '');
        let formatted = '';

        if (numbersOnly.length > 0) formatted = numbersOnly.slice(0, 2);
        if (numbersOnly.length > 2) formatted += '/' + numbersOnly.slice(2, 4);
        if (numbersOnly.length > 4) formatted += '/' + numbersOnly.slice(4, 6); // Changed to 6 for yy
        
        handleServiceChange(index, 'fecha', formatted);
    };

    const handleTimeInputChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
        const rawValue = e.target.value;
        const numbersOnly = rawValue.replace(/[^0-9]/g, '');
        let formatted = '';

        if (numbersOnly.length > 0) formatted = numbersOnly.slice(0, 2);
        if (numbersOnly.length > 2) formatted += ':' + numbersOnly.slice(2, 4);
        handleServiceChange(index, 'hora', formatted);
    };

    const handleTimeInputBlur = (e: React.FocusEvent<HTMLInputElement>, index: number) => {
        const rawValue = e.target.value.replace(/[^0-9]/g, '');
        if (rawValue.length === 4) {
            handleServiceChange(index, 'hora', `${rawValue.slice(0,2)}:${rawValue.slice(2,4)}`);
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-none w-[95vw] h-[90vh] flex flex-col p-4">
                <DialogHeader className="p-2 border-b">
                    <DialogTitle className="text-2xl">Editor de Itinerario Avanzado</DialogTitle>
                </DialogHeader>
                
                <div className="flex-grow overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="sticky top-0 bg-background z-10 hover:bg-background">
                                <TableHead className="w-[150px]">Fecha</TableHead>
                                <TableHead className="w-[100px]">Hora</TableHead>
                                <TableHead className="w-[300px]">Servicio</TableHead>
                                <TableHead className="w-[150px]">Vuelo</TableHead>
                                <TableHead className="w-[200px]">Guía</TableHead>
                                <TableHead className="w-[100px]">Bus</TableHead>
                                <TableHead className="w-[200px]">Chofer</TableHead>
                                <TableHead className="w-[300px]">Observaciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {editableServices.map((service, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        <div className="relative">
                                            <Input
                                                value={service.fecha}
                                                onChange={(e) => handleDateInputChange(e, index)}
                                                placeholder="dd/MM/yy"
                                                maxLength={8}
                                            />
                                            <Popover open={openPopoverIndex === index} onOpenChange={(isOpen) => setOpenPopoverIndex(isOpen ? index : null)}>
                                                <PopoverTrigger asChild>
                                                    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"><CalendarIcon className="h-4 w-4 text-muted-foreground" /></button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        mode="single"
                                                        selected={service.fecha ? parse(service.fecha, "dd/MM/yy", new Date()) : undefined}
                                                        onSelect={(date) => {
                                                            if(date) {
                                                                handleServiceChange(index, 'fecha', format(date, 'dd/MM/yy'));
                                                                setOpenPopoverIndex(null); // Close popover on select
                                                            }
                                                        }}
                                                        disabled={(date) => isBefore(date, startOfToday())}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            value={service.hora} 
                                            onChange={(e) => handleTimeInputChange(e, index)} 
                                            onBlur={(e) => handleTimeInputBlur(e, index)} 
                                            placeholder="HH:mm" 
                                            maxLength={5} 
                                        />
                                    </TableCell>
                                    <TableCell><Input value={service.servicio} onChange={(e) => handleServiceChange(index, 'servicio', e.target.value)} /></TableCell>
                                    <TableCell><Input value={service.vuelo} onChange={(e) => handleServiceChange(index, 'vuelo', e.target.value)} /></TableCell>
                                    <TableCell><Input value={service.guia} onChange={(e) => handleServiceChange(index, 'guia', e.target.value)} list={`guides-datalist-${index}`} /><datalist id={`guides-datalist-${index}`}>{guides.map(g => <option key={g.uid} value={g.fullName.toUpperCase()} />)}</datalist></TableCell>
                                    <TableCell><Input value={service.bus} onChange={(e) => handleServiceChange(index, 'bus', e.target.value)} /></TableCell>
                                    <TableCell><Input value={service.chofer} onChange={(e) => handleServiceChange(index, 'chofer', e.target.value)} list={`drivers-datalist-${index}`} /><datalist id={`drivers-datalist-${index}`}>{drivers.map(d => <option key={d.id} value={d.name.toUpperCase()} />)}</datalist></TableCell>
                                    <TableCell><Input value={service.observaciones} onChange={(e) => handleServiceChange(index, 'observaciones', e.target.value)} /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <DialogFooter className="p-2 border-t">
                    <Button variant="outline" onClick={onClose}><X className="mr-2 h-4 w-4"/>Cerrar</Button>
                    <Button onClick={() => onSave(editableServices)}><Save className="mr-2 h-4 w-4"/>Guardar Cambios</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
