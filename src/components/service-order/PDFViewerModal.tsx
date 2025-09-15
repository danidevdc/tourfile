
"use client";

import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs, BlobProvider } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { Button } from '@/components/ui/button';
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StoredServiceOrder } from '@/lib/serviceOrderStorage';
import ServiceOrderPDFDocument from './ServiceOrderPDFDocument';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: StoredServiceOrder;
  title?: string;
}

const PDFViewerModal: React.FC<PDFViewerModalProps> = ({
  isOpen,
  onClose,
  order,
  title = "Visor PDF"
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.5);
  const [isCopying, setIsCopying] = useState(false);
  const { toast } = useToast();
  const pageRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const goToPrevPage = () => setPageNumber(page => Math.max(1, page - 1));
  const goToNextPage = () => setPageNumber(page => Math.min(numPages, page + 1));
  const zoomIn = () => setScale(scale => Math.min(3, scale + 0.2));
  const zoomOut = () => setScale(scale => Math.max(0.5, scale - 0.2));

  const handleCopy = async () => {
    if (!pageRef.current) return;
    setIsCopying(true);

    try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(pageRef.current, {
            scale: 2, 
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        const blob: Blob = await new Promise((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'));
        
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        
        toast({
            title: "✅ Imagen Copiada",
            description: "La vista del PDF ha sido copiada como imagen. Pégala con Ctrl+V.",
            className: "bg-green-100 dark:bg-green-900 border-green-500",
        });

    } catch (err) {
        console.error("Error al copiar imagen del PDF:", err);
        toast({ title: "Error al Copiar", description: "No se pudo copiar la imagen al portapapeles.", variant: "destructive" });
    } finally {
        setIsCopying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onMouseDown={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-4xl max-h-[95vh] w-full mx-4 flex flex-col" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8">✕</Button>
        </div>

        <div className="flex items-center justify-center gap-4 p-2 border-b bg-gray-50 dark:bg-gray-800">
          <Button onClick={goToPrevPage} disabled={pageNumber <= 1} size="sm" variant="outline"><ChevronLeft /> Anterior</Button>
          <span className="text-sm text-gray-700 dark:text-gray-300">Página {pageNumber} de {numPages || '?'}</span>
          <Button onClick={goToNextPage} disabled={pageNumber >= numPages} size="sm" variant="outline">Siguiente <ChevronRight /></Button>
          <div className="border-l pl-4 ml-2 flex items-center gap-1">
            <Button onClick={zoomOut} variant="outline" size="icon" className="h-8 w-8"><ZoomOut /></Button>
            <span className="px-3 py-1 bg-white dark:bg-gray-700 border rounded-md text-sm font-medium w-20 text-center">{Math.round(scale * 100)}%</span>
            <Button onClick={zoomIn} variant="outline" size="icon" className="h-8 w-8"><ZoomIn /></Button>
          </div>
          <div className="border-l pl-4 ml-2">
             <Button onClick={handleCopy} disabled={isCopying} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                {isCopying ? <Loader2 className="animate-spin"/> : <Copy/>}
                Copiar como Imagen
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-gray-200 dark:bg-gray-900 flex justify-center">
            <BlobProvider document={<ServiceOrderPDFDocument order={order} />}>
                {({ blob, url, loading, error }) => {
                    if (loading) {
                        return <div className="flex flex-col items-center justify-center h-full text-gray-500"><Loader2 className="h-8 w-8 animate-spin mb-2" /><span>Generando PDF...</span></div>;
                    }
                    if (error || !url) {
                        return <div className="text-red-500">Error al generar el PDF: {error?.message}</div>;
                    }
                    return (
                        <div ref={pageRef}>
                            <Document file={url} onLoadSuccess={onDocumentLoadSuccess}>
                                <Page pageNumber={pageNumber} scale={scale} renderTextLayer={false} />
                            </Document>
                        </div>
                    );
                }}
            </BlobProvider>
        </div>
      </div>
    </div>
  );
};

export default PDFViewerModal;
