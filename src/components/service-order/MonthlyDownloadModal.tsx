"use client";

import { useState, useEffect } from "react";
import JSZip from "jszip";
import { Loader2, Download, Lock } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

import { getAllOrderHeaders, getServiceOrdersByIds } from "@/lib/serviceOrderQuery";
import { generateServiceOrderExcel } from "@/lib/serviceOrderGenerator";

interface MonthlyDownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MONTHS = [
    { value: "0", label: "Enero" },
    { value: "1", label: "Febrero" },
    { value: "2", label: "Marzo" },
    { value: "3", label: "Abril" },
    { value: "4", label: "Mayo" },
    { value: "5", label: "Junio" },
    { value: "6", label: "Julio" },
    { value: "7", label: "Agosto" },
    { value: "8", label: "Septiembre" },
    { value: "9", label: "Octubre" },
    { value: "10", label: "Noviembre" },
    { value: "11", label: "Diciembre" },
];

const SAFE_PIN = process.env.NEXT_PUBLIC_DOWNLOAD_PIN;

export function MonthlyDownloadModal({ isOpen, onClose }: MonthlyDownloadModalProps) {
    const { toast } = useToast();

    // Default to current month/year
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState<string>(now.getMonth().toString());
    const [selectedYear, setSelectedYear] = useState<string>(now.getFullYear().toString());
    const [pin, setPin] = useState("");

    // Selectors state
    const [availableYears, setAvailableYears] = useState<string[]>([]);
    const [availableMonthIndices, setAvailableMonthIndices] = useState<number[]>([]);

    // Data state
    // Structure: Year -> Month (0-11) -> ID[]
    const [downloadStats, setDownloadStats] = useState<Record<string, Record<string, string[]>>>({});

    const [status, setStatus] = useState<'idle' | 'loading_metadata' | 'verifying' | 'fetching' | 'zipping' | 'error'>('idle');
    const [progress, setProgress] = useState("");

    // Fetch and parse all headers on open
    useEffect(() => {
        if (!isOpen) return;

        setStatus('loading_metadata');
        setProgress("Analizando archivos...");

        getAllOrderHeaders().then((headers) => {
            const stats: Record<string, Record<string, string[]>> = {};

            headers.forEach(h => {
                // Regex to find patterns like:
                // ODS_06_DICIEMBRE_2025 (Standard)
                // ODS 06 DICIEMBRE 2025 (Spaces)
                // DICIEMBRE_2025 (Short)

                // Matches "OCTUBRE" or "OCTUBRE_" then "2025"
                // We look for: (MONTH_NAME) separator (YEAR)
                const normalizedName = h.orderName.toUpperCase().replace(/_/g, ' ');

                // Find year (2020-2030)
                const yearMatch = normalizedName.match(/\b(20[2-3][0-9])\b/);
                if (!yearMatch) return;
                const year = yearMatch[1]; // Captured year

                // Find month name
                const foundMonth = MONTHS.find(m => normalizedName.includes(m.label.toUpperCase()));
                if (!foundMonth) return;
                const monthIndex = foundMonth.value;

                if (!stats[year]) stats[year] = {};
                if (!stats[year][monthIndex]) stats[year][monthIndex] = [];

                stats[year][monthIndex].push(h.id);
            });

            setDownloadStats(stats);

            // Set initial year list
            const parsedYears = Object.keys(stats).sort((a, b) => parseInt(b) - parseInt(a));
            setAvailableYears(parsedYears);

            // If current selection is invalid, reset to newest available
            if (parsedYears.length > 0 && !parsedYears.includes(selectedYear)) {
                setSelectedYear(parsedYears[0]);
            } else if (parsedYears.length === 0) {
                // No data found at all
            }

            setStatus('idle');

        }).catch(err => {
            console.error(err);
            toast({ title: "Error", description: "No se pudo cargar la lista de archivos.", variant: "destructive" });
            setStatus('idle');
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Update available months when year changes
    useEffect(() => {
        if (!selectedYear || !downloadStats[selectedYear]) {
            setAvailableMonthIndices([]);
            return;
        }

        const indices = Object.keys(downloadStats[selectedYear]).map(k => parseInt(k)).sort((a, b) => a - b);
        setAvailableMonthIndices(indices);

        // Auto-select valid month if current is invalid
        const currentMonthInt = parseInt(selectedMonth);
        if (indices.length > 0 && !indices.includes(currentMonthInt)) {
            // Default to the last available month (latest data)
            setSelectedMonth(indices[indices.length - 1].toString());
        }
    }, [selectedYear, downloadStats, selectedMonth]);

    const handleDownload = async () => {
        if (!pin) {
            toast({ title: "PIN Requerido", description: "Por favor ingresa el código PIN de seguridad.", variant: "destructive" });
            return;
        }

        setStatus('verifying');

        // Simulación de verificación de PIN (aquí podría ir una llamada al server)
        await new Promise(r => setTimeout(r, 600));

        if (pin !== SAFE_PIN) {
            toast({ title: "PIN Incorrecto", description: "El código ingresado no es válido.", variant: "destructive" });
            setStatus('idle');
            return;
        }

        setStatus('fetching');
        try {
            // Get IDs from our parsed stats
            const targetIds = downloadStats[selectedYear]?.[selectedMonth] || [];

            if (targetIds.length === 0) {
                toast({ title: "Sin resultados", description: "No se encontraron archivos con ese nombre/fecha.", variant: "default" });
                setStatus('idle');
                return;
            }

            setProgress(`Descargando ${targetIds.length} órdenes...`);
            const orders = await getServiceOrdersByIds(targetIds);

            if (orders.length === 0) {
                toast({ title: "Error", description: "No se pudieron recuperar los datos de las órdenes.", variant: "destructive" });
                setStatus('idle');
                return;
            }

            setStatus('zipping');
            setProgress(`Procesando ${orders.length} archivos...`);

            const zip = new JSZip();
            const folderName = `Reporte_${MONTHS[parseInt(selectedMonth)].label}_${selectedYear}`;
            const folder = zip.folder(folderName);

            // Generate Excels 
            let count = 0;
            for (const order of orders) {
                try {
                    const buffer = await generateServiceOrderExcel(order.data);
                    // Add to zip
                    const safeName = order.orderName.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
                    folder?.file(`${safeName}.xlsx`, buffer);
                    count++;
                } catch (e) {
                    console.error(`Error generando excel para ${order.orderName}`, e);
                }
            }

            if (count === 0) {
                throw new Error("No se pudo generar ningún archivo Excel.");
            }

            setProgress("Comprimiendo...");
            const zipContent = await zip.generateAsync({ type: "blob" });

            // Trigger Download
            const url = URL.createObjectURL(zipContent);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Reporte_Mensual_ODS_${MONTHS[parseInt(selectedMonth)].label}_${selectedYear}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast({ title: "Éxito", description: `${count} órdenes descargadas correctamente.`, variant: "success" });
            onClose();

        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Ocurrió un error al generar la descarga masiva.", variant: "destructive" });
        } finally {
            setStatus('idle');
            setPin("");
            setProgress("");
        }
    };

    const isLoading = status !== 'idle';
    const isAnalyzing = status === 'loading_metadata';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Descarga Masiva Mensual</DialogTitle>
                    <DialogDescription>
                        Selecciona el mes y año según el nombre del archivo (Ej: &quot;ODS ... DICIEMBRE 2025&quot;).
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {isAnalyzing ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4 text-muted-foreground animate-pulse">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p>{progress || "Analizando base de datos..."}</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Año</Label>
                                    <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isLoading || availableYears.length === 0}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={availableYears.length === 0 ? "Sin datos" : "Año"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableYears.map((y) => (
                                                <SelectItem key={y} value={y}>{y}</SelectItem>
                                            ))}
                                            {availableYears.length === 0 && (
                                                <SelectItem value="none" disabled>No se encontraron archivos</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Mes</Label>
                                    <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={isLoading || availableMonthIndices.length === 0}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Mes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MONTHS.filter(m => availableMonthIndices.includes(parseInt(m.value))).map((m) => (
                                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                            ))}
                                            {availableMonthIndices.length === 0 && (
                                                <SelectItem value={selectedMonth} disabled>Sin datos</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="pin" className="flex items-center gap-2">
                                    <Lock className="h-3 w-3" /> Pin de Seguridad
                                </Label>
                                <Input
                                    id="pin"
                                    type="password"
                                    placeholder="Ingrese el PIN de 6 dígitos"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    maxLength={6}
                                    disabled={isLoading || availableYears.length === 0}
                                />
                                <p className="text-[10px] text-muted-foreground">Solicite el PIN al administrador del sistema.</p>
                            </div>
                        </>
                    )}

                    {isLoading && !isAnalyzing && (
                        <div className="flex items-center justify-center py-2 text-sm text-muted-foreground animate-pulse">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {progress || "Procesando..."}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
                    <Button onClick={handleDownload} disabled={isLoading || isAnalyzing || pin.length < 4 || availableYears.length === 0} className="bg-green-600 hover:bg-green-700 text-white">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Descargar ZIP
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
