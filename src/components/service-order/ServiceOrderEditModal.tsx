
"use client";

import { useState, useEffect, useMemo } from "react";
import { parse } from "date-fns";
import { StoredServiceOrder } from "@/lib/serviceOrderStorage";
import { ServiceOrderData, ServiceItem, ServiceOrderGuide, Activity, Driver } from "@/lib/serviceOrderService";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Split } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";


interface ServiceOrderEditModalProps {
  order: StoredServiceOrder;
  guides: ServiceOrderGuide[];
  activities: Activity[];
  drivers: Driver[];
  onSave: (updatedOrderData: ServiceOrderData, isSplitOrder: boolean) => void;
  onClose: () => void;
}

function MetaItem({ label, value, className }: { label: string; value?: string | number; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-primary/50 bg-card/50 px-3 py-1 flex items-center justify-center gap-2 text-xs", className)}>
      <p className="font-bold text-primary">{label}</p>
      <p className="font-normal">{value || "—"}</p>
    </div>
  );
}

export function ServiceOrderEditModal({ order, guides, activities, drivers, onSave, onClose }: ServiceOrderEditModalProps) {
  const [editableOrderData, setEditableOrderData] = useState<ServiceOrderData>(JSON.parse(JSON.stringify(order.data)));
  const [isSplitMode, setIsSplitMode] = useState(false);

  useEffect(() => {
    setEditableOrderData(JSON.parse(JSON.stringify(order.data)));
  }, [order]);

  const handleServiceChange = (index: number, field: keyof ServiceItem, value: string) => {
    const updatedServices = [...editableOrderData.services];
    updatedServices[index] = { ...updatedServices[index], [field]: value };
    setEditableOrderData(prev => ({ ...prev, services: updatedServices }));
  };

  const handleGlobalGuideChange = (guideFullName: string) => {
      setEditableOrderData(prev => ({ ...prev, guia: guideFullName }));
  }

  const handleSplitModeToggle = (checked: boolean) => {
    setIsSplitMode(checked);
    // When splitting, ensure every service has a guide assigned, defaulting to the main guide if not set
    if (checked) {
        const updatedServices = editableOrderData.services.map(service => ({
            ...service,
            guia: service.guia || editableOrderData.guia,
        }));
        setEditableOrderData(prev => ({ ...prev, services: updatedServices }));
    }
  }


  const sortedServices = useMemo(() => {
    return [...editableOrderData.services].sort((a, b) => {
      try {
        const dateA = parse(a.fecha, "dd/MM/yyyy", new Date()).getTime();
        const dateB = parse(b.fecha, "dd/MM/yyyy", new Date()).getTime();
        if (dateA !== dateB) return dateA - dateB;
      } catch {}
      return a.hora.localeCompare(b.hora);
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
  const ownDrivers = drivers.filter(d => !d.name.startsWith('CONT '));
  const externalDrivers = drivers.filter(d => d.name.startsWith('CONT '));
  const driverOptionsForBusType = (busType: string | undefined): ComboboxOption[] => {
      const driverList = busType === 'CONT.' ? externalDrivers : ownDrivers;
      return driverList.map(d => ({ value: d.name.toUpperCase(), label: d.name }));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full p-0 overflow-hidden flex flex-col max-h-[95vh]">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Editando Orden: {order.orderName.replace(/_/g, ' ')}</DialogTitle>
          <DialogDescription>
            Realiza cambios en los servicios. Activa "Dividir Orden" para asignar guías individuales.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto px-4 py-2 space-y-4">
            <div className="space-y-2 p-3 rounded-lg border bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex items-stretch gap-2">
                   <MetaItem label="File:" value={order.data.file} className="flex-none w-32" />
                   <MetaItem label="Ref:" value={order.data.ref} className="flex-1" />
                   <MetaItem label="Nº Pax:" value={order.data.nPax} className="flex-none w-32" />
                   <MetaItem label="Hotel:" value={order.data.hotel} className="flex-1"/>
                </div>
                <div className="pt-2 flex items-center gap-4">
                    <div className="flex-1">
                        <Label className="text-xs font-semibold text-muted-foreground">Guía Principal</Label>
                        <Combobox
                            options={globalGuideOptions}
                            value={editableOrderData.guia}
                            onSelect={handleGlobalGuideChange}
                            placeholder="Seleccionar guía..."
                            className="h-9 mt-1"
                            triggerClassName="bg-card/80"
                            disabled={isSplitMode}
                        />
                    </div>
                    <div className="flex items-center space-x-2 pt-5">
                        <Switch id="split-mode" checked={isSplitMode} onCheckedChange={handleSplitModeToggle} />
                        <Label htmlFor="split-mode" className="flex items-center gap-2 text-sm font-medium"><Split className="h-4 w-4" /> Dividir Orden por Guía</Label>
                    </div>
                </div>
            </div>

           <div className="rounded-lg border overflow-hidden">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-primary/10 hover:bg-primary/10 h-auto">
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[86px] text-center align-middle" style={{fontSize: '11px'}}>Fecha</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[56px] text-center align-middle" style={{fontSize: '11px'}}>Hora</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto text-left align-middle" style={{fontSize: '11px'}}>Servicio</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[70px] text-center align-middle" style={{fontSize: '11px'}}>Vuelo</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[150px] text-center align-middle" style={{fontSize: '11px'}}>Guía</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[90px] text-center align-middle" style={{fontSize: '11px'}}>Bus</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 border-r border-primary/20 h-auto w-[150px] text-center align-middle" style={{fontSize: '11px'}}>Chofer</TableHead>
                  <TableHead className="text-primary font-bold py-1 px-2 h-auto text-left align-middle" style={{fontSize: '11px'}}>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedServices.map((s, index) => {
                  const showDate = index === 0 || sortedServices[index - 1].fecha !== s.fecha;
                  const colorGroup = dateColorGroupMap.get(s.fecha) || 0;
                  const rowBgClass = colorGroup % 2 === 0 ? "bg-white dark:bg-zinc-900/50" : "bg-zinc-100 dark:bg-zinc-800/50";
                  const originalIndex = editableOrderData.services.findIndex(os => os === s);
                  const currentDriverOptions = driverOptionsForBusType(s.bus);
                  
                  const guideForThisRow = s.guia || editableOrderData.guia;
                  const guiaFirstName = (guideForThisRow || '').split(' ')[0];
                  const choferFirstName = (s.chofer || '').split(' ')[0];


                  return (
                    <TableRow key={originalIndex} className={cn("break-words align-middle h-8", rowBgClass)} style={{fontSize: '11px'}}>
                      <TableCell className="p-1 align-middle border-r border-primary/10 text-center">
                        {showDate && s.fecha ? (
                          <span className="inline-flex items-center justify-center rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-bold text-primary">
                            {s.fecha}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="p-1 align-middle border-r border-primary/10 text-center"><span className="rounded px-1 py-0.5 border">{s.hora}</span></TableCell>
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
                      <TableCell className="p-1 align-middle border-r border-primary/10 text-center">{s.vuelo || "—"}</TableCell>
                      <TableCell className="p-1 align-middle border-r border-primary/10 text-center font-medium">
                         {isSplitMode ? (
                            <Combobox
                                options={globalGuideOptions}
                                value={s.guia || ''}
                                onSelect={(value) => handleServiceChange(originalIndex, 'guia', value)}
                                placeholder="Asignar guía..."
                                className="h-8 text-xs"
                                triggerClassName="bg-card/80"
                            />
                         ) : (
                            guiaFirstName
                         )}
                      </TableCell>
                      <TableCell className="p-1 align-middle border-r border-primary/10 text-center">
                         <Select value={s.bus || ''} onValueChange={(value) => handleServiceChange(originalIndex, 'bus', value)}>
                            <SelectTrigger className="h-8 text-xs bg-card/80"><SelectValue placeholder="..." /></SelectTrigger>
                            <SelectContent>{[{ value: '8', label: 'Bus 8' }, { value: '9', label: 'Bus 9' }, { value: '10', label: 'Bus 10' }, { value: 'CONT.', label: 'Contratado' }].map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-1 align-middle border-r border-primary/10 text-center">
                        <Combobox
                          options={currentDriverOptions}
                          value={s.chofer || ''}
                          onSelect={(value) => handleServiceChange(originalIndex, 'chofer', value)}
                          placeholder="Chofer..."
                          className="h-8 text-xs"
                          triggerClassName="bg-card/80"
                        />
                      </TableCell>
                      <TableCell className="p-1 align-middle text-left">
                        <Input
                          value={s.observaciones || ''}
                          onChange={(e) => handleServiceChange(originalIndex, 'observaciones', e.target.value)}
                          className="h-8 text-xs bg-card/80"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-background">
          <Button variant="outline" onClick={onClose}><X className="mr-2 h-4 w-4"/>Cerrar</Button>
          <Button onClick={() => onSave(editableOrderData, isSplitMode)}><Save className="mr-2 h-4 w-4"/>Guardar Cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
