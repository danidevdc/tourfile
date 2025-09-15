
"use client";

import React, { useState, useRef } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { Button } from '@/components/ui/button';
import { Loader2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StoredServiceOrder } from '@/lib/serviceOrderStorage';
import ServiceOrderPDFDocument from './ServiceOrderPDFDocument';

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
  const [isCopying, setIsCopying] = useState(false);
  const { toast } = useToast();
  const pdfViewRef = useRef<HTMLDivElement>(null); // Ref for the container of the viewer

  const handleCopy = async () => {
      // Find the iframe created by PDFViewer to capture its content
      const iframe = pdfViewRef.current?.querySelector('iframe');
      if (!iframe?.contentWindow?.document.body) {
        toast({ title: "Error", description: "No se pudo encontrar el contenido del PDF para copiar.", variant: "destructive" });
        return;
      }
      
      const pdfCanvas = iframe.contentWindow.document.querySelector('canvas');
      if (!pdfCanvas) {
         toast({ title: "Error", description: "No se pudo encontrar el canvas del PDF.", variant: "destructive" });
        return;
      }

      setIsCopying(true);
      try {
        const blob: Blob = await new Promise((resolve) => pdfCanvas.toBlob(b => resolve(b!), 'image/png'));
        
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
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-6xl max-h-[95vh] w-full mx-4 flex flex-col" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
           <div className="flex items-center gap-2">
            <Button onClick={handleCopy} disabled={isCopying} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                {isCopying ? <Loader2 className="animate-spin mr-2"/> : <Copy className="mr-2"/>}
                Copiar como Imagen
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8">✕</Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-900" ref={pdfViewRef}>
            <PDFViewer width="100%" height="100%" style={{ border: 'none' }}>
                <ServiceOrderPDFDocument order={order} />
            </PDFViewer>
        </div>
      </div>
    </div>
  );
};

export default PDFViewerModal;
