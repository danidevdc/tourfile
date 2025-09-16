
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

    // Ensure fonts are ready before capture for better rendering.
    await (document as any).fonts?.ready;

    // Capture the original node directly.
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff", // Explicitly set a white background
      logging: false,
      width: node.scrollWidth,
      height: node.scrollHeight,
      windowWidth: node.scrollWidth,
      windowHeight: node.scrollHeight,
    });

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("No se pudo generar PNG"))), "image/png", 0.95)
    );

    // Modern browsers support ClipboardItem.
    // The type casting is a workaround for older TS definitions.
    const ClipboardItemAny = (window as any).ClipboardItem || (window as any).webkitClipboardItem;
    if (!ClipboardItemAny || !navigator.clipboard?.write) {
        throw new Error("La API del portapapeles no es compatible o no está permitida en este navegador.");
    }
    
    if (!document.hasFocus()) {
       throw new Error("La ventana no está enfocada. Por favor, haz clic en la página e intenta de nuevo.");
    }

    const item = new ClipboardItemAny({ "image/png": blob });
    await navigator.clipboard.write([item]);

    toast({
        title: "✅ Imagen Copiada",
        description: "La vista previa ha sido copiada como imagen. Pégala con Ctrl+V.",
        className: "bg-green-100 dark:bg-green-900 border-green-500",
        duration: 5000,
    });

  } catch (err) {
    console.error("Error al copiar al portapapeles:", err);
    toast({
        title: "Copia Fallida",
        description: (err as Error).message || "No se pudo copiar la imagen. Intenta de nuevo.",
        variant: "destructive",
        duration: 5000,
    });
  }
}

    