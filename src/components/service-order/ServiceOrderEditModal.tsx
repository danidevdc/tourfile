
"use client";

import { useState, useEffect, useMemo, ChangeEvent } from "react";
import { parse, format } from "date-fns";
import { StoredServiceOrder } from "@/lib/serviceOrderStorage";
import { ServiceOrderData, ServiceItem, ServiceOrderGuide, Activity, Driver, PredefinedFlight, Hotel, Bus, recordActivityTimeUsage, getSuggestedTimeForActivity } from "@/lib/serviceOrderService";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Split, XCircle, PlusCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "../ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


interface ServiceOrderEditModalProps {
  order: StoredServiceOrder;
  guides: ServiceOrderGuide[];
  activities: Activity[];
  drivers: Driver[];
  flights: PredefinedFlight[];
  hotels: Hotel[];
  buses: Bus[];
  onSave: (updatedOrderData: ServiceOrderData) => void;
  onClose: () => void;
}

const initialNewServiceState: ServiceItem = {
    fecha: '', hora: '', servicio: '', vuelo: '', guia: '', bus: '', chofer: '', observaciones: ''
};


export function ServiceOrderEditModal({ order, guides, activities, drivers, flights, hotels, buses, onSave, onClose }: ServiceOrderEditModalProps) {
  const [editableOrderData, setEditableOrderData] = useState<ServiceOrderData>(JSON.parse(JSON.stringify(order.data)));
  const [newService, setNewService] = useState<ServiceItem>(initialNewServiceState);
  const [isSplitConfirmOpen, setIsSplitConfirmOpen] = useState(false);
  const [potentialSplit, setPotentialSplit] = useState<{ by: 'guide' | 'driver'; count: number } | null>(null);

  useEffect(() => {
    setEditableOrderData(JSON.parse(JSON.stringify(order.data)));
  }, [order]);
  
  const handleDataChange = (field: keyof ServiceOrderData, value: string) => {
    setEditableOrderData(prev => ({...prev, [field]: value.toUpperCase() }));
  }
  
  const handleTextAreaChange = (field: 'observations' | 'nota', value: string) => {
    setEditableOrderData(prev => ({...prev, [field]: value }));
  };

  const handleServiceChange = (index: number, field: keyof ServiceItem, value: string) => {
    const updatedServices = [...editableOrderData.services];
    updatedServices[index] = { ...updatedServices[index], [field]: value };

    if (field === 'vuelo') {
        const selectedFlight = flights.find(f => f.flightNumber.toUpperCase() === value.toUpperCase());
        if (selectedFlight) {
            updatedServices[index].hora = selectedFlight.time;
            updatedServices[index].observaciones = selectedFlight.observations;
        }
    }

    setEditableOrderData(prev => ({ ...prev, services: updatedServices }));
  };
  
  const handleRemoveService = (indexToRemove: number) => {
    const updatedServices = editableOrderData.services.filter((_, index) => index !== indexToRemove);
    setEditableOrderData(prev => ({ ...prev, services: updatedServices }));
  };
  
  const handleNewServiceChange = (field: keyof ServiceItem, value: string) => {
    setNewService(prev => ({ ...prev, [field]: value.toUpperCase() }));
  };

  const handleActivitySelect = async (activityName: string) => {
      const upperActivityName = activityName.toUpperCase();
      const currentHora = newService.hora;
      
      setNewService(prev => ({...prev, servicio: upperActivityName, hora: ''}));
      
      if (upperActivityName !== 'TRF IN' && upperActivityName !== 'TRF OUT' && !currentHora) {
          const suggestedTime = await getSuggestedTimeForActivity(upperActivityName);
          if (suggestedTime) {
              handleNewServiceChange('hora', suggestedTime);
          }
      }
  };
  
  const handleFlightSelect = (flightNumber: string) => {
      const selectedFlight = flights.find(f => f.flightNumber.toUpperCase() === flightNumber.toUpperCase());
      if (selectedFlight) {
          setNewService(prev => ({ ...prev, vuelo: selectedFlight.flightNumber, hora: selectedFlight.time, observaciones: selectedFlight.observations }));
      }
  };
  
 const addNewServiceRow = () => {
    const lastService = editableOrderData.services[editableOrderData.services.length - 1];

    const serviceToAdd: ServiceItem = {
        ...newService,
        fecha: newService.fecha ? format(parse(newService.fecha, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : '',
        guia: editableOrderData.guia,
        bus: newService.bus || lastService?.bus || '',
        chofer: newService.chofer || lastService?.chofer || '',
    };
    
    if (serviceToAdd.servicio && serviceToAdd.hora) {
      recordActivityTimeUsage(serviceToAdd.servicio, serviceToAdd.hora);
    }
    setEditableOrderData(prev => ({ ...prev, services: [...prev.services, serviceToAdd] }));
    setNewService(prev => ({ ...initialNewServiceState, fecha: prev.fecha }));
 };

  const handleSaveClick = () => {
    onSave(editableOrderData);
  };

  const handleTimeChange = (index: number, rawValue: string) => {
      const numbersOnly = rawValue.replace(/[^0-9]/g, '');
      let formatted = '';
      if (numbersOnly.length > 0) formatted = numbersOnly.slice(0, 2);
      if (numbersOnly.length > 2) formatted += ':' + numbersOnly.slice(2, 4);
      handleServiceChange(index, 'hora', formatted);
  };
  
  const handleNewServiceTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/[^0-9]/g, '');
      let formatted = '';
      if (rawValue.length > 0) formatted = rawValue.slice(0, 2);
      if (rawValue.length > 2) formatted += ':' + rawValue.slice(2, 4);
      handleNewServiceChange('hora', formatted);
  };

  const handleTimeBlur = (index: number, rawValue: string) => {
      const numbersOnly = rawValue.replace(/[^0-9]/g, '');
      if (numbersOnly.length === 4) {
          handleServiceChange(index, 'hora', `${numbersOnly.slice(0, 2)}:${numbersOnly.slice(2, 4)}`);
      }
  };

  const sortedServices = useMemo(() => {
    return [...editableOrderData.services].sort((a, b) => {
      try {
        const dateA = parse(a.fecha, "dd/MM/yyyy", new Date()).getTime();
        const dateB = parse(b.fecha, "dd/MM/yyyy", new Date()).getTime();
        if (dateA !== dateB) return dateA - dateB;
      } catch {}

      const hasTimeA = a.hora && a.hora.trim() !== '';
      const hasTimeB = b.hora && b.hora.trim() !== '';

      if (hasTimeA && hasTimeB) return a.hora.localeCompare(b.hora);
      if (hasTimeA) return -1; // a has time, b does not -> a comes first
      if (hasTimeB) return 1;  // b has time, a does not -> b comes first
      
      return 0; // Neither has time, maintain original order
    });
  }, [editableOrderData.services]);

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

  const globalGuideOptions: ComboboxOption[] = guides.map(g => ({ value: g.fullName.toUpperCase(), label: g.fullName }));
  const activityOptions: ComboboxOption[] = activities.map(a => ({ value: a.name.toUpperCase(), label: a.name }));
  const hotelOptions: ComboboxOption[] = hotels.map(h => ({ value: h.name.toUpperCase(), label: h.name }));
  const ownDrivers = drivers.filter(d => !d.name.startsWith('CONT '));
  const externalDrivers = drivers.filter(d => d.name.startsWith('CONT '));
  
  const driverOptionsForBusType = (busType: string | undefined): ComboboxOption[] => {
      const driverList = busType === 'CONT.' ? externalDrivers : ownDrivers;
      return driverList.map(d => ({ value: d.name.toUpperCase(), label: d.name }));
  };

  const filteredFlightOptions = useMemo(() => {
      const createOption = (f: PredefinedFlight) => ({ value: f.flightNumber, key: f.id, label: `${f.flightNumber} (${f.time})` });
      const service = newService.servicio?.toUpperCase();
      if (service === 'TRF IN') return flights.filter(f => f.observations.toUpperCase().includes('LLEGA')).map(createOption);
      if (service === 'TRF OUT') return flights.filter(f => f.observations.toUpperCase().includes('SALE')).map(createOption);
      return flights.map(createOption);
  }, [newService.servicio, flights]);
  
  const isAddServiceDisabled = !newService.fecha.trim() || !newService.servicio.trim();
  
  const busOptions = buses.map(b => ({ value: b.name.toUpperCase(), label: b.name }));
  const finalBusOptions = [...busOptions, { value: 'CONT.', label: 'Contratado' }];


  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-full p-0 overflow-hidden flex flex-col max-h-[95vh]">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Editando Orden: {order.orderName.replace(/_/g, ' ')}</DialogTitle>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto px-4 py-2 space-y-4">
            <div className="space-y-2 p-3 rounded-lg border bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex items-end gap-2">
                    <div className="flex-none" style={{width: '150px'}}>
                        <Label htmlFor="file-edit">File</Label>
                        <Input id="file-edit" value={editableOrderData.file} onChange={(e) => handleDataChange('file', e.target.value)} className="h-9 mt-1 bg-card/80"/>
                    </div>
                     <div className="flex-grow">
                        <Label htmlFor="ref-edit">Ref (Grupo)</Label>
                        <Input id="ref-edit" value={editableOrderData.ref} onChange={(e) => handleDataChange('ref', e.target.value)} className="h-9 mt-1 bg-card/80"/>
                    </div>
                    <div style={{width: '80px'}}>
                        <Label htmlFor="pax-edit">Nº Pax</Label>
                        <Input id="pax-edit" value={editableOrderData.nPax} onChange={(e) => handleDataChange('nPax', e.target.value)} className="h-9 mt-1 bg-card/80"/>
                    </div>
                     <div className="flex-1" style={{minWidth: '250px'}}>
                        <Label>Hotel</Label>
                        <Combobox
                            options={hotelOptions}
                            value={editableOrderData.hotel}
                            onSelect={(value) => handleDataChange('hotel', value)}
                            placeholder="Buscar hotel..."
                            className="h-9 mt-1"
                            triggerClassName="bg-card/80"
                        />
                    </div>
                </div>

                <div className="pt-2">
                    <Label className="text-xs font-semibold text-muted-foreground">Guía Principal (por defecto)</Label>
                    <Combobox
                        options={globalGuideOptions}
                        value={editableOrderData.guia}
                        onSelect={(value) => handleDataChange('guia', value)}
                        placeholder="Seleccionar guía principal..."
                        className="h-9 mt-1"
                        triggerClassName="bg-card/80"
                    />
                </div>
                 {/* --- Add New Service Form --- */}
                <div className="pt-2 space-y-2">
                   <div className="flex items-end gap-2">
                        <div style={{ width: '150px' }}>
                            <Label className="text-xs font-semibold">Fecha</Label>
                            <Input type="date" value={newService.fecha} onChange={(e) => handleNewServiceChange('fecha', e.target.value)} className="mt-1 h-8 text-xs"/>
                        </div>
                        <div className="flex-grow" style={{maxWidth: '600px'}}>
                            <Label className="text-xs font-semibold">Actividad</Label>
                            <Combobox options={activityOptions} value={newService.servicio} onSelect={handleActivitySelect} placeholder="Buscar actividad..." className="mt-1 h-8 text-xs" triggerClassName="bg-card/80" />
                        </div>
                        <div className="flex-grow">
                            <Label className="text-xs font-semibold">Vuelo</Label>
                            <Combobox 
                                options={filteredFlightOptions} 
                                value={newService.vuelo || ''} 
                                onSelect={handleFlightSelect} 
                                placeholder="Seleccionar vuelo..." 
                                className="mt-1 h-8 text-xs" 
                                triggerClassName="bg-card/80" 
                                disabled={!newService.servicio?.toUpperCase().includes('TRF')}
                            />
                        </div>
                        <div style={{ width: '90px' }}>
                            <Label className="text-xs font-semibold">Hora</Label>
                            <Input value={newService.hora} onChange={handleNewServiceTimeChange} onBlur={(e) => handleTimeBlur(-1, e.target.value)} placeholder="HH:mm" maxLength={5} className="mt-1 h-8 text-xs"/>
                        </div>
                        <div>
                            <Button onClick={addNewServiceRow} variant="outline" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isAddServiceDisabled}>
                                <PlusCircle className="mr-2 h-4 w-4"/>Añadir
                            </Button>
                        </div>
                   </div>
                </div>
            </div>

           <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
                <Table className="table-fixed min-w-[1200px]">
                  <TableHeader>
                    <TableRow className="bg-primary/10 hover:bg-primary/10 h-auto">
                      <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[150px] text-center align-middle" style={{fontSize: '11px'}}>Fecha</TableHead>
                      <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[90px] text-center align-middle" style={{fontSize: '11px'}}>Hora</TableHead>
                      <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[250px] text-left align-middle" style={{fontSize: '11px'}}>Servicio</TableHead>
                      <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[150px] text-center align-middle" style={{fontSize: '11px'}}>Vuelo</TableHead>
                      <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[180px] text-center align-middle" style={{fontSize: '11px'}}>Guía</TableHead>
                      <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[110px] text-center align-middle" style={{fontSize: '11px'}}>Bus</TableHead>
                      <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[150px] text-center align-middle" style={{fontSize: '11px'}}>Chofer</TableHead>
                      <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[250px] text-left align-middle" style={{fontSize: '11px'}}>Observaciones</TableHead>
                      <TableHead className="text-primary font-bold py-1 px-2 h-auto w-[50px] text-center align-middle" style={{fontSize: '11px'}}></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedServices.map((s, index) => {
                      const showDate = index === 0 || sortedServices[index - 1].fecha !== s.fecha;
                      const colorGroup = dateColorGroupMap.get(s.fecha) || 0;
                      const rowBgClass = colorGroup % 2 === 0 ? "bg-white dark:bg-zinc-900/50" : "bg-zinc-100 dark:bg-zinc-800/50";
                      const originalIndex = editableOrderData.services.findIndex(os => os === s);
                      const currentDriverOptions = driverOptionsForBusType(s.bus);
                      
                      const canDelete = editableOrderData.services.length > 1;
                      const isTransfer = s.servicio?.toUpperCase().includes('TRF');

                      return (
                        <TableRow key={originalIndex} className={cn("break-words align-middle h-8", rowBgClass)} style={{fontSize: '11px'}}>
                          <TableCell className="p-1 align-middle border-r border-primary/10 text-center">
                            {showDate && s.fecha ? (
                              <span className="inline-flex items-center justify-center rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-bold text-primary">
                                {s.fecha}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="p-1 align-middle border-r border-primary/10 text-center">
                             <Input
                              value={s.hora || ''}
                              onChange={(e) => handleTimeChange(originalIndex, e.target.value)}
                              onBlur={(e) => handleTimeBlur(originalIndex, e.target.value)}
                              maxLength={5}
                              placeholder="HH:mm"
                              className="h-8 text-xs bg-card/80 text-center"
                            />
                          </TableCell>
                          <TableCell className="p-1 align-middle border-r border-primary/10 text-left">
                            <Combobox
                              options={activityOptions}
                              value={s.servicio || ''}
                              onSelect={(value) => handleServiceChange(originalIndex, 'servicio', value)}
                              placeholder="Actividad..."
                              className="h-8 text-xs"
                              triggerClassName="bg-card/80"
                            />
                          </TableCell>
                           <TableCell className="p-1 align-middle border-r border-primary/10 text-center">
                            <Combobox
                                options={flights.map(f => ({ value: f.flightNumber, label: `${f.flightNumber} (${f.time})`}))}
                                value={s.vuelo || ''}
                                onSelect={(value) => handleServiceChange(originalIndex, 'vuelo', value)}
                                placeholder="Vuelo..."
                                className="h-8 text-xs"
                                triggerClassName="bg-card/80"
                                disabled={!isTransfer}
                            />
                          </TableCell>
                          <TableCell className="p-1 align-middle border-r border-primary/10 text-center font-medium">
                            <Combobox
                                options={globalGuideOptions}
                                value={s.guia || editableOrderData.guia}
                                onSelect={(value) => handleServiceChange(originalIndex, 'guia', value)}
                                placeholder="Asignar guía..."
                                className="h-8 text-xs"
                                triggerClassName="bg-card/80"
                            />
                          </TableCell>
                          <TableCell className="p-1 align-middle border-r border-primary/10 text-center">
                             <Select value={s.bus || ''} onValueChange={(value) => handleServiceChange(originalIndex, 'bus', value)}>
                                <SelectTrigger className="h-8 text-xs bg-card/80"><SelectValue placeholder="..." /></SelectTrigger>
                                <SelectContent>{finalBusOptions.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-1 align-middle border-r border-primary/10 text-center">
                            <Combobox
                              options={currentDriverOptions}
                              value={s.chofer || ''}
                              onSelect={(value) => handleServiceChange(originalIndex, 'chofer', value)}
                              placeholder="Chofer..."
                              className="h-8 text-xs"
                              triggerClassName="bg-card/80">
                            </Combobox>
                          </TableCell>
                          <TableCell className="p-1 align-middle border-r border-primary/10 text-left">
                            <Input
                              value={s.observaciones || ''}
                              onChange={(e) => handleServiceChange(originalIndex, 'observaciones', e.target.value)}
                              className="h-8 text-xs bg-card/80"
                            />
                          </TableCell>
                          <TableCell className="p-1 align-middle text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed"
                              onClick={() => handleRemoveService(originalIndex)}
                              disabled={!canDelete}
                              title={canDelete ? "Eliminar servicio" : "No se puede eliminar el último servicio"}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Accordion type="multiple" className="w-full pt-4">
              <AccordionItem value="item-1">
                <AccordionTrigger>Observaciones Generales</AccordionTrigger>
                <AccordionContent>
                   <Textarea
                      id="observations-edit"
                      value={editableOrderData.observations || ""}
                      onChange={(e) => handleTextAreaChange('observations', e.target.value)}
                      className="mt-1 bg-card/80"
                      rows={4}
                  />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Nota (Pie de página)</AccordionTrigger>
                <AccordionContent>
                   <Textarea
                      id="nota-edit"
                      value={editableOrderData.nota || ""}
                      onChange={(e) => handleTextAreaChange('nota', e.target.value)}
                      className="mt-1 bg-card/80"
                      rows={4}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

        </div>

        <DialogFooter className="p-4 border-t bg-background">
          <Button variant="outline" onClick={onClose}><X className="mr-2 h-4 w-4"/>Cerrar</Button>
          <Button onClick={handleSaveClick}><Save className="mr-2 h-4 w-4"/>Guardar Cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
