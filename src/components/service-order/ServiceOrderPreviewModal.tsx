
"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { parseDateDDMMYYYY } from "@/lib/formatters";
import { FaWhatsapp } from "react-icons/fa";

import { type StoredServiceOrder } from "@/lib/serviceOrderStorage";
import { cn } from "@/lib/utils";
import { copiarVistaPreviaAlClipboard, crearBlobVistaPrevia, previewImageWasSent } from "@/lib/copyPreview";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Minus, Plus, Scan } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ServiceOrderPreviewModalProps {
  order: StoredServiceOrder;
  onClose: () => void;
  onStatusUpdate?: (orderId: string) => void;
}

function PrintableView({ order, onClose, showCopyButton, onStatusUpdate }: { order: StoredServiceOrder, onClose: () => void, showCopyButton: boolean, onStatusUpdate?: (orderId: string) => void }) {
  const { data } = order;
  const captureRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isCopying, setIsCopying] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [preparedBlob, setPreparedBlob] = useState<Blob | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [captureHeight, setCaptureHeight] = useState(0);

  const processedData = useMemo(() => {
    // Collect all unique guides from services, including the main guide
    const allGuides = new Set<string>();
    if (data.guia) {
      // If the main guide field has commas, it's likely already a list
      data.guia.split(',').forEach(g => {
        if (g.trim()) allGuides.add(g.trim());
      });
    }
    data.services?.forEach(service => {
      if (service.guia && service.guia.trim()) {
        allGuides.add(service.guia.trim());
      }
    });

    // Join the unique guides into a comma-separated string, or use a placeholder if none are found.
    const displayGuide = allGuides.size > 0 ? Array.from(allGuides).join(', ') : '—';


    const sortedServices = [...(data.services || [])].sort((a, b) => {
      try {
        const dateA = parseDateDDMMYYYY(a.fecha)?.getTime() ?? new Date().getTime();
        const dateB = parseDateDDMMYYYY(b.fecha)?.getTime() ?? new Date().getTime();
        if (dateA !== dateB) return dateA - dateB;
      } catch { }

      const hasTimeA = a.hora && a.hora.trim() !== '';
      const hasTimeB = b.hora && b.hora.trim() !== '';

      if (hasTimeA && hasTimeB) return a.hora.localeCompare(b.hora);
      if (hasTimeA) return -1;
      if (hasTimeB) return 1;
      return 0;
    });

    // Calculate total from tarifa column
    const totalTarifa = sortedServices.reduce((sum, service) => {
      const tarifa = parseFloat(service.tarifa || '0');
      return sum + (isNaN(tarifa) ? 0 : tarifa);
    }, 0);

    return { displayGuide, sortedServices, totalTarifa };
  }, [data]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateMobile = () => setIsMobile(mediaQuery.matches);
    updateMobile();
    mediaQuery.addEventListener('change', updateMobile);
    return () => mediaQuery.removeEventListener('change', updateMobile);
  }, []);

  useEffect(() => {
    const captureNode = captureRef.current;
    const viewportNode = viewportRef.current;
    if (!captureNode || !viewportNode) return;

    const updatePreviewSize = () => {
      setCaptureHeight(captureNode.scrollHeight);
      const nextFit = isMobile
        ? Math.min(Math.max((viewportNode.clientWidth - 8) / 1200, 0.2), 1)
        : 1;
      setFitZoom(nextFit);
      setZoom(nextFit);
    };

    updatePreviewSize();
    const observer = new ResizeObserver(updatePreviewSize);
    observer.observe(captureNode);
    observer.observe(viewportNode);
    return () => observer.disconnect();
  }, [isMobile, processedData]);

  useEffect(() => {
    const captureNode = captureRef.current;
    if (!captureNode || !showCopyButton) return;

    let cancelled = false;
    const prepareImage = async () => {
      setIsPreparingImage(true);
      setPreparedBlob(null);
      try {
        const blob = await crearBlobVistaPrevia(captureNode);
        if (!cancelled) setPreparedBlob(blob);
      } catch (error) {
        console.error('No se pudo preparar la imagen de la orden:', error);
      } finally {
        if (!cancelled) setIsPreparingImage(false);
      }
    };

    const frameId = window.requestAnimationFrame(() => void prepareImage());
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [order.id, processedData, showCopyButton]);

  const handleCopy = async () => {
    if (!captureRef.current) {
      toast({
        title: "Error de Captura",
        description: "No se pudo encontrar el elemento a copiar.",
        variant: "destructive"
      });
      return;
    }
    setIsCopying(true);
    const result = await copiarVistaPreviaAlClipboard(captureRef.current, toast, preparedBlob);
    if (previewImageWasSent(result) && onStatusUpdate) {
      onStatusUpdate(order.id);
    }
    setIsCopying(false);
  };

  return (
    <>
      <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="h-[100dvh] w-screen max-w-none max-h-[100dvh] rounded-none border-0 p-0 flex flex-col gap-0 md:h-[95vh] md:w-full md:max-w-[90vw] md:rounded-lg md:border xl:max-w-[1250px]">
          <DialogHeader className="flex-shrink-0 border-b px-4 py-3 pr-12 md:py-2">
            <DialogTitle className="text-left text-base md:sr-only">Vista previa de la orden</DialogTitle>
            <DialogDescription className="sr-only">Vista previa de la orden de servicio con detalles completos</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-center gap-2 border-b bg-muted/40 px-3 py-2 md:hidden">
            <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Alejar" onClick={() => setZoom(current => Math.max(0.2, current - 0.1))} disabled={zoom <= 0.2}>
              <Minus className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" className="min-w-28 gap-2" onClick={() => setZoom(fitZoom)}>
              <Scan className="h-4 w-4" /> Ajustar {Math.round(zoom * 100)}%
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Acercar" onClick={() => setZoom(current => Math.min(1.5, current + 0.1))} disabled={zoom >= 1.5}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto bg-zinc-200 p-1 [touch-action:pan-x_pan-y_pinch-zoom] md:p-4 dark:bg-zinc-900">
            <div className="mx-auto" style={{ width: 1200 * zoom, height: captureHeight * zoom }}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 1200 }}>
                <div ref={captureRef} className={cn(
                  "bg-white text-zinc-900 uppercase w-[1200px] pt-[3px] pb-[5px] px-[10px]",
                )}>
              <div className="relative">
                <div className="pt-4 pb-3 flex items-center justify-center font-bold text-2xl">
                  ORDEN DE SERVICIO
                </div>
              </div>

              <div className="border-2 border-gray-400 rounded-lg mt-1 p-4">
                <Table className="mb-4" wrapperClassName="overflow-visible">
                  <TableBody>
                    <TableRow className="hover:bg-white border-none">
                      <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto w-24 align-middle whitespace-nowrap">Guía:</TableCell>
                      <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{processedData.displayGuide || "—"}</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-white border-none">
                      <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto align-middle">File:</TableCell>
                      <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{data.file || "—"}</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-white border-none">
                      <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto align-middle">Ref:</TableCell>
                      <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{data.ref || "—"}</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-white border-none">
                      <TableCell className="font-bold text-black text-xs py-2 px-[7px] h-auto align-middle">Nº Pax:</TableCell>
                      <TableCell className="text-xs py-2 px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{data.nPax || "—"}</TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-white border-none">
                      <TableCell className="font-bold text-black text-xs pt-[5px] pb-[8px] px-[7px] h-auto align-middle">Hotel:</TableCell>
                      <TableCell className="text-xs pt-[5px] pb-[8px] px-[7px] h-auto border border-gray-300 rounded-md bg-gray-50 align-middle">{data.hotel || "—"}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="mt-4">
                  <div className="rounded-lg border border-gray-300 overflow-visible">
                    <Table className="table-fixed w-full" wrapperClassName="overflow-visible">
                      <TableHeader>
                        <TableRow className="bg-gray-100 hover:bg-gray-100 h-auto whitespace-nowrap">
                          <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[86px] text-center align-middle text-[11px]">Fecha</TableHead>
                          <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[56px] text-center align-middle text-[11px]">Hora</TableHead>
                          <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto text-left align-middle w-[250px] text-[11px]">Servicio</TableHead>
                          <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[78px] text-center align-middle text-[11px]">Vuelo</TableHead>
                          <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[90px] text-center align-middle text-[11px]">Guía</TableHead>
                          <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[70px] text-center align-middle text-[11px]">Bus</TableHead>
                          <TableHead className="text-black font-bold py-1 px-2 border-r border-gray-300 h-auto w-[85px] text-center align-middle text-[11px]">Chofer</TableHead>

                          <TableHead className="text-black font-bold py-1 px-2 h-auto text-left align-middle text-[11px]">Observaciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedData.sortedServices.length > 0 ? (
                          processedData.sortedServices.map((s, i) => {
                            const showDate = i === 0 || processedData.sortedServices[i - 1].fecha !== s.fecha;
                            const guiaCompleto = s.guia || data.guia;
                            const guiaFirstName = (guiaCompleto || '').split(' ')[0];
                            const choferCompleto = s.chofer || '';
                            const choferSanitized = choferCompleto.replace(/^CONT\s/i, '');
                            const choferFirstName = choferSanitized.split(' ')[0];

                            return (
                              <TableRow key={i} className="bg-white hover:bg-white text-xs">
                                <TableCell className="p-2 border-r border-gray-200 text-center font-semibold align-middle text-xs">
                                  {showDate && s.fecha ? s.fecha : ""}
                                </TableCell>
                                <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                                  {s.hora}
                                </TableCell>
                                <TableCell className="p-2 border-r border-gray-200 text-left align-middle text-xs">
                                  {s.servicio}
                                </TableCell>
                                <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                                  {s.vuelo || "—"}
                                </TableCell>
                                <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                                  {guiaFirstName}
                                </TableCell>
                                <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                                  {s.bus}
                                </TableCell>
                                <TableCell className="p-2 border-r border-gray-200 text-center align-middle text-xs">
                                  {choferFirstName}
                                </TableCell>

                                <TableCell className="p-2 text-left align-middle text-xs whitespace-normal">
                                  {s.observaciones}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No hay servicios en esta orden.</TableCell>
                          </TableRow>
                        )}

                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 uppercase">
                  <InfoBlock title="OBSERVACIONES:" text={data.observations} />
                  <InfoBlock title="NOTA:" text={data.nota} />
                </div>
              </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 flex-row justify-stretch gap-2 border-t bg-background p-3 md:justify-start md:p-4">
            {showCopyButton && (
              <Button
                type="button"
                className="flex-1 bg-green-600 text-white hover:bg-green-700 md:flex-none"
                size="sm"
                onClick={handleCopy}
                disabled={isCopying || isPreparingImage}
              >
                {isCopying || isPreparingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FaWhatsapp className="mr-2 h-4 w-4" />}
                {isPreparingImage ? 'Preparando imagen...' : isMobile ? 'Compartir en WhatsApp' : 'Copiar imagen a WhatsApp'}
              </Button>
            )}
            <DialogClose asChild>
              <Button type="button" variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={onClose}>Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InfoBlock({ title, text }: { title: string; text?: string; }) {
  return (
    <div className="border border-gray-300 rounded-md p-2 bg-gray-50">
      <p className="tracking-wide mb-1 font-bold text-xs">{title}</p>
      <p className="whitespace-pre-wrap leading-5 text-xs">{text || "—"}</p>
    </div>
  );
}

export function ServiceOrderPrintPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState<StoredServiceOrder | null>(null);
  const [showCopyButton, setShowCopyButton] = useState(false);

  useEffect(() => {
    const orderDataString = searchParams.get('order');
    if (orderDataString) {
      try {
        const parsedOrder: StoredServiceOrder = JSON.parse(decodeURIComponent(orderDataString));
        parsedOrder.createdAt = new Date(parsedOrder.createdAt);
        if (parsedOrder.updatedAt) {
          parsedOrder.updatedAt = new Date(parsedOrder.updatedAt);
        }
        setOrder(parsedOrder);

        if (searchParams.get('copy') === 'true') {
          setShowCopyButton(true);
        }
      } catch (e) {
        console.error("Failed to parse order data from URL", e);
        router.push("/service-order");
      }
    }
  }, [searchParams, router]);


  useEffect(() => {
    if (order && !showCopyButton) {
      const timeoutId = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [order, showCopyButton]);

  if (!order) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Cargando orden...</p>
      </div>
    );
  }

  return <PrintableView order={order} onClose={() => window.close()} showCopyButton={showCopyButton} />;
}

export default function ServiceOrderPreviewModal({ order, onClose, onStatusUpdate }: ServiceOrderPreviewModalProps) {
  if (!order?.data) {
    return (
      <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent>
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return <PrintableView order={order} onClose={onClose} showCopyButton={true} onStatusUpdate={onStatusUpdate} />;
}
