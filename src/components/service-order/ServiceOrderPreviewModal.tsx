
"use client";

import { useState, useRef } from 'react';
import axios from 'axios';
import { type StoredServiceOrder } from '@/lib/serviceOrderStorage';
import { type ImgBBResponse } from '@/types/imgbb';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parse } from 'date-fns';
import { cn } from '@/lib/utils';
import { Image as ImageIcon, Loader2, Share2 } from 'lucide-react'; // Replaced MessageSquare with a more generic Share2
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';


interface ServiceOrderPreviewModalProps {
    order: StoredServiceOrder;
    onClose: () => void;
}

// Simple component for WhatsApp icon
const WhatsAppIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="mr-2 h-4 w-4">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.451-4.437-9.887-9.888-9.888-5.452 0-9.887 4.436-9.889 9.888-.001 2.225.651 4.315 1.731 6.26l-.47 1.725 1.724-.455zm2.297-8.219c-.244-.123-.699-.344-.808-.382s-.189-.061-.267.061-.306.382-.375.459c-.07.077-.139.092-.244.031s-1.037-.383-1.977-1.215c-.748-.659-1.229-1.475-1.38-1.724s-.023-.199.04- .288c.06-.087.135-.224.204-.302.069-.077.093-.123.139-.204s.023-.189-.023-.344c-.045-.155-.267-.643-.363-.875s-.189-.199-.267-.204c-.077-.005-1.676-.005-1.676-.005s-.383.005-.572.244c-.189.239-.72.875-.72 2.131s.748 2.461.845 2.639c.097.177 1.475 2.243 3.58 3.161.522.25.928.398 1.246.512.537.195.948.164 1.305.101.411-.077 1.229-.5 1.396-.984s.167-.875.123-.984c-.045-.109-.167-.18-.244-.219z" />
    </svg>
);


export function ServiceOrderPreviewModal({ order, onClose }: ServiceOrderPreviewModalProps) {
    const { data, orderName } = order;
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);


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

    const generateImage = async (): Promise<{dataUrl: string, blob: Blob} | null> => {
        if (!previewRef.current) {
            toast({ title: 'Error de Renderizado', description: 'No se pudo encontrar el contenido para capturar.', variant: 'destructive' });
            return null;
        }
        
        try {
             const canvas = await html2canvas(previewRef.current, {
                scale: 2,
                backgroundColor: '#ffffff', // Use solid white for best compatibility
                useCORS: true,
                allowTaint: true,
            });

            return new Promise((resolve) => {
                canvas.toBlob((blob) => {
                    if (blob) {
                         const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                         resolve({dataUrl, blob});
                    } else {
                        resolve(null);
                    }
                }, 'image/jpeg', 0.95);
            });
            
        } catch(error) {
             console.error("Error al generar la imagen con html2canvas:", error);
             toast({ title: 'Error de Captura', description: 'No se pudo generar la imagen.', variant: 'destructive' });
             return null;
        }
    };


     const handleDownloadJpg = async () => {
        setIsProcessing(true);
        toast({ title: 'Generando imagen...', description: 'Por favor, espera un momento.' });

        const image = await generateImage();

        if (image) {
            const link = document.createElement('a');
            link.href = image.dataUrl;
            link.download = `${orderName}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ title: '¡Éxito!', description: 'La imagen se ha descargado.', className: 'bg-green-100 dark:bg-green-900 border-green-500'});
        }
        
        setIsProcessing(false);
    };

    const handleShareToWhatsApp = async () => {
        setIsProcessing(true);
        toast({ title: 'Preparando para compartir...', description: 'Generando imagen y subiendo...' });
        
        const image = await generateImage();
        if (!image) {
            setIsProcessing(false);
            return;
        }
        
        const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
        if (!apiKey || apiKey === "tu_api_key_de_imgbb_aqui") {
            toast({ title: 'Configuración Requerida', description: 'La API Key de ImgBB no está configurada.', variant: 'destructive', duration: 7000 });
            setIsProcessing(false);
            return;
        }
        
        const formData = new FormData();
        formData.append('image', image.blob);
        
        try {
            const response = await axios.post<ImgBBResponse>(`https://api.imgbb.com/1/upload?key=${apiKey}`, formData);
            if (response.data.success) {
                const imageUrl = response.data.data.url;
                const message = encodeURIComponent(`Hola, te comparto la orden de servicio: ${orderName}\n\nPuedes verla aquí: ${imageUrl}`);
                window.open(`https://web.whatsapp.com/send?text=${message}`, '_blank');
                 toast({ title: '¡Listo!', description: 'Imagen subida. Se abrirá WhatsApp.', className: 'bg-green-100 dark:bg-green-900 border-green-500'});
            } else {
                throw new Error('La API de ImgBB devolvió un error.');
            }
        } catch(error) {
            console.error("Error subiendo la imagen a ImgBB:", error);
            toast({ title: 'Error al Subir', description: 'No se pudo subir la imagen para compartir.', variant: 'destructive' });
        } finally {
             setIsProcessing(false);
        }
    };


    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-full flex flex-col p-4">
                 <div ref={previewRef} className="overflow-y-auto p-2 flex-grow bg-card">
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
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px] h-auto w-[86px]">Fecha</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px] h-auto w-[56px]">Hora</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px] h-auto">Servicio</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px] h-auto w-[70px]">Vuelo</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px] h-auto w-[80px]">Guía</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px] h-auto w-[60px]">Bus</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-r border-primary/20 font-mono text-[11px] h-auto w-[80px]">Chofer</TableHead>
                                    <TableHead className="text-primary font-bold py-0.5 px-1 border-t border-b border-primary/20 font-mono text-[11px] h-auto">Observaciones</TableHead>
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
                                        <TableCell className="p-1 text-[10px] whitespace-pre-wrap uppercase bg-muted/50" colSpan={7}>{data.observations}</TableCell>
                                    </TableRow>
                                    <TableRow className="font-mono uppercase">
                                        <TableCell className="font-bold p-1 w-36 align-top text-primary border-r border-primary/20 text-[10px]">NOTA:</TableCell>
                                        <TableCell className="p-1 text-[10px] whitespace-pre-wrap uppercase bg-muted/50" colSpan={7}>{data.nota}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-2 pt-4 border-t mt-auto flex-wrap justify-end gap-2">
                    <Button 
                        onClick={handleShareToWhatsApp} 
                        disabled={isProcessing}
                        variant="outline"
                        className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                    >
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <WhatsAppIcon />}
                        Enviar por WhatsApp
                    </Button>
                     <Button 
                        onClick={handleDownloadJpg} 
                        disabled={isProcessing}
                        variant="outline"
                        className="border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                    >
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ImageIcon className="mr-2 h-4 w-4"/>}
                        Guardar como JPG
                    </Button>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cerrar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
