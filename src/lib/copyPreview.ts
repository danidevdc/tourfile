
import React from 'react';
import type { Toast } from '@/hooks/use-toast';

export async function copiarVistaPreviaAlClipboard(
    captureRef: React.RefObject<HTMLDivElement>,
    toast: (props: Parameters<typeof Toast>[0]) => void
) {
  const node = captureRef.current;
  if (!node) {
    toast({
        title: "Error de Captura",
        description: "No se encontró la vista previa para capturar.",
        variant: "destructive"
    });
    return;
  }

  try {
    const html2canvas = (await import("html2canvas")).default;

    await document.fonts?.ready?.catch(() => {});

    const canvas = await html2canvas(node, {
      height: node.scrollHeight,
      windowHeight: node.scrollHeight,
      scale: 2,
      useCORS: true,
      backgroundColor: "#fff",
      logging: false,
    });

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("No se pudo generar PNG"))), "image/png", 0.95)
    );

    const ClipboardItemAny = (window as any).ClipboardItem || (window as any).webkitClipboardItem;
    if (!ClipboardItemAny || !navigator.clipboard?.write) {
        throw new Error("La API del portapapeles no es compatible o no está permitida en este navegador.");
    }

    const item = new ClipboardItemAny({ "image/png": blob });
    await navigator.clipboard.write([item]);

    toast({
        title: "✅ Imagen Copiada",
        description: "Abre WhatsApp Web/PC y pega con Ctrl+V.",
        className: "bg-green-100 dark:bg-green-900 border-green-500",
        duration: 5000,
    });

  } catch (err) {
    console.error("Error al copiar al portapapeles:", err);
    toast({
        title: "Copia Fallida, Descargando...",
        description: "No se pudo copiar al portapapeles. Se descargará un archivo PNG.",
        variant: "destructive",
        duration: 5000,
    });
    // Fallback: descarga local para arrastrar o adjuntar
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(node, {
        height: node.scrollHeight,
        windowHeight: node.scrollHeight,
        scale: 2,
        useCORS: true,
        backgroundColor: "#fff",
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `orden-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (downloadError) {
      console.error("Error en el fallback de descarga:", downloadError);
      toast({
        title: "Error de Descarga",
        description: "No se pudo ni copiar ni descargar la imagen automáticamente.",
        variant: "destructive",
      });
    }
  }
}
