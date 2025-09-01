"use client";

import { useMemo, useRef, useState } from "react";
import axios from "axios";
import { parse } from "date-fns";
import html2canvas from "html2canvas";
import { Image as ImageIcon, Loader2, Share2, Printer, QrCode } from "lucide-react";

import { type StoredServiceOrder } from "@/lib/serviceOrderStorage";
import { type ImgBBResponse } from "@/types/imgbb";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface ServiceOrderPreviewModalProps {
  order: StoredServiceOrder;
  onClose: () => void;
}

// WhatsApp icon (solid)
const WhatsAppIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mr-2 h-4 w-4 fill-current">
    <path d="M.057 24 1.744 17.837C.703 16.033.156 13.988.157 11.891.16 5.335 5.495 0 12.05 0c3.18.001 6.166 1.24 8.411 3.488 2.246 2.248 3.482 5.236 3.48 8.414C23.939 18.459 18.604 23.794 12.048 23.794c-1.99 0-3.951-.5-5.688-1.448L.057 24zM6.654 20.193c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.451-4.437-9.887-9.888-9.888-5.452 0-9.887 4.436-9.889 9.888-.001 2.225.651 4.315 1.731 6.26l-.47 1.725 1.724-.455zm2.297-8.219c-.244-.123-.699-.344-.808-.382s-.189-.061-.267.061-.306.382-.375.459c-.07.077-.139.092-.244.031s-1.037-.383-1.977-1.215c-.748-.659-1.229-1.475-1.38-1.724s-.023-.199.04-.288c.06-.087.135-.224.204-.302.069-.077.093-.123.139-.204s.023-.189-.023-.344c-.045-.155-.267-.643-.363-.875s-.189-.199-.267-.204c-.077-.005-1.676-.005-1.676-.005s-.383.005-.572.244c-.189.239-.72.875-.72 2.131s.748 2.461.845 2.639c.097.177 1.475 2.243 3.58 3.161.522.25.928.398 1.246.512.537.195.948.164 1.305.101.411-.077 1.229-.5 1.396-.984s.167-.875.123-.984c-.045-.109-.167-.18-.244-.219z" />
  </svg>
);

export default function ServiceOrderPreviewModalV2({ order, onClose }: ServiceOrderPreviewModalProps) {
  const { data, orderName } = order;
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // --- Sorting & grouping -------------------------------------------------
  const services = useMemo(() => {
    const list = [...data.services].sort((a, b) => {
      try {
        const dateA = parse(a.fecha, "dd/MM/yyyy", new Date()).getTime();
        const dateB = parse(b.fecha, "dd/MM/yyyy", new Date()).getTime();
        if (dateA !== dateB) return dateA - dateB;
      } catch {}
      return a.hora.localeCompare(b.hora);
    });
    return list;
  }, [data.services]);

  // --- Image generation (kept from v1) -----------------------------------
  const generateImage = async (): Promise<{ dataUrl: string; blob: Blob } | null> => {
    if (!previewRef.current) {
      toast({ title: "Error de Renderizado", description: "No se pudo encontrar el contenido para capturar.", variant: "destructive" });
      return null;
    }
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
      });
      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
              resolve({ dataUrl, blob });
            } else {
              resolve(null);
            }
          },
          "image/jpeg",
          0.95
        );
      });
    } catch (error) {
      console.error("Error al generar la imagen con html2canvas:", error);
      toast({ title: "Error de Captura", description: "No se pudo generar la imagen.", variant: "destructive" });
      return null;
    }
  };

  const handleDownloadJpg = async () => {
    setIsProcessing(true);
    toast({ title: "Generando imagen...", description: "Por favor, espera un momento." });
    const image = await generateImage();
    if (image) {
      const link = document.createElement("a");
      link.href = image.dataUrl;
      link.download = `${orderName}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "¡Éxito!", description: "La imagen se ha descargado.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
    }
    setIsProcessing(false);
  };

  const handleShareToWhatsApp = async () => {
    setIsProcessing(true);
    toast({ title: "Preparando para compartir...", description: "Generando imagen y subiendo..." });

    const image = await generateImage();
    if (!image) {
      setIsProcessing(false);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
    if (!apiKey || apiKey === "tu_api_key_de_imgbb_aqui") {
      toast({ title: "Configuración Requerida", description: "La API Key de ImgBB no está configurada.", variant: "destructive", duration: 7000 });
      setIsProcessing(false);
      return;
    }

    const formData = new FormData();
    formData.append("image", image.blob);

    try {
      const response = await axios.post<ImgBBResponse>(`https://api.imgbb.com/1/upload?key=${apiKey}`, formData);
      if (response.data.success) {
        const imageUrl = response.data.data.url;
        const message = encodeURIComponent(`Hola, te comparto la orden de servicio: ${orderName}\n\nPuedes verla aquí: ${imageUrl}`);
        window.open(`https://web.whatsapp.com/send?text=${message}`, "_blank");
        toast({ title: "¡Listo!", description: "Imagen subida. Se abrirá WhatsApp.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
      } else {
        throw new Error("La API de ImgBB devolvió un error.");
      }
    } catch (error) {
      console.error("Error subiendo la imagen a ImgBB:", error);
      toast({ title: "Error al Subir", description: "No se pudo subir la imagen para compartir.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- UI -----------------------------------------------------------------
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
        {/* Printable area */}
        <div ref={previewRef} className="bg-white text-zinc-900">
          {/* Header */}
          <div className="relative">
            <div className="h-1.5 w-full bg-gradient-to-r from-primary/90 via-primary to-primary/70" />
            <div className="px-6 pt-4 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
                  <Share2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-base font-semibold tracking-wider uppercase text-zinc-800">Orden de Servicios</h1>
                  <p className="text-xs text-muted-foreground">Emitida para guías y choferes</p>
                </div>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wide">{orderName}</Badge>
            </div>
            <Separator />
          </div>

          {/* Meta card */}
          <Card className="m-6 border-primary/20 shadow-sm">
            <CardContent className="p-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetaItem label="Guía" value={data.guia} />
                <MetaItem label="File" value={data.file} />
                <MetaItem label="Ref" value={data.ref} />
                <MetaItem label="Nº Pax" value={data.nPax} />
                <MetaItem label="Hotel" value={data.hotel} className="sm:col-span-2 col-span-2" />
              </div>
            </CardContent>
          </Card>

          {/* Services */}
          <div className="px-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold tracking-wider uppercase text-primary">Detalle de Servicios</h2>
            </div>
            <div className="rounded-xl border border-primary/20 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/10 hover:bg-primary/10 uppercase">
                    <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] w-[86px]">Fecha</TableHead>
                    <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] w-[64px]">Hora</TableHead>
                    <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px]">Servicio</TableHead>
                    <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] w-[80px]">Vuelo</TableHead>
                    <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] w-[96px]">Guía</TableHead>
                    <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] w-[70px]">Bus</TableHead>
                    <TableHead className="text-primary font-semibold py-1 px-2 border-r border-primary/20 font-mono text-[11px] w-[96px]">Chofer</TableHead>
                    <TableHead className="text-primary font-semibold py-1 px-2 font-mono text-[11px]">Observaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.length ? (
                    services.map((s, i) => {
                      const showDate = i === 0 || services[i - 1].fecha !== s.fecha;
                      return (
                        <TableRow key={i} className={cn("font-mono text-[11px] uppercase border-b-primary/20", i % 2 === 0 ? "bg-white" : "bg-zinc-50") }>
                          <TableCell className="p-1 align-top border-r border-primary/10">
                            {showDate ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-semibold text-[10px] text-primary">
                                {s.fecha}
                              </span>
                            ) : (
                              ""
                            )}
                          </TableCell>
                          <TableCell className="p-1 align-top border-r border-primary/10"><span className="rounded px-1 py-0.5 border text-[10px]">{s.hora}</span></TableCell>
                          <TableCell className="p-1 align-top border-r border-primary/10">{s.servicio}</TableCell>
                          <TableCell className="p-1 align-top border-r border-primary/10">{s.vuelo}</TableCell>
                          <TableCell className="p-1 align-top border-r border-primary/10">{s.guia}</TableCell>
                          <TableCell className="p-1 align-top border-r border-primary/10">{s.bus}</TableCell>
                          <TableCell className="p-1 align-top border-r border-primary/10">{s.chofer?.replace(/^CONT\s/i, "")}</TableCell>
                          <TableCell className="p-1 align-top">{s.observaciones}</TableCell>
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
            </div>
          </div>

          {/* Observaciones / Nota */}
          <div className="px-6 py-4 grid grid-cols-1 gap-4">
            <InfoBlock title="Observaciones" text={data.observations} />
            <InfoBlock title="Nota" text={data.nota} subtle />
          </div>

          {/* Footer with signature lines */}
          <div className="px-6 pb-6">
            <Separator className="my-4" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-[11px] uppercase font-mono">
              <SignatureLine label="Guía" name={data.guia} />
              <SignatureLine label="Chofer" />
              <SignatureLine label="Autorizado por" />
            </div>
          </div>
        </div>

        {/* Actions bar (not captured) */}
        <DialogFooter className="sticky bottom-0 z-10 gap-2 border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-3">
          <Button onClick={handleShareToWhatsApp} disabled={isProcessing} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700">
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WhatsAppIcon />}
            Enviar por WhatsApp
          </Button>
          <Button onClick={handleDownloadJpg} disabled={isProcessing} variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-700">
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
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

function MetaItem({ label, value, className }: { label: string; value?: string | number; className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card/50 px-3 py-2", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">{label}</p>
      <p className="mt-0.5 text-xs uppercase font-mono">{value || "—"}</p>
    </div>
  );
}

function InfoBlock({ title, text, subtle = false }: { title: string; text?: string; subtle?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", subtle ? "bg-muted/40 border-dashed" : "bg-muted/20") }>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-1">{title}:</p>
      <p className="text-[11px] uppercase font-mono whitespace-pre-wrap leading-5">{text || "—"}</p>
    </div>
  );
}

function SignatureLine({ label, name }: { label: string; name?: string }) {
  return (
    <div className="flex flex-col items-center justify-end gap-1">
      <div className="h-10 w-full border-b" />
      <p className="text-[10px] tracking-widest">{label}{name ? `: ${name}` : ""}</p>
    </div>
  );
}
