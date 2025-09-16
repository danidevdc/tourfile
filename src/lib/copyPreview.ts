
import React from 'react';
import type { Toast } from '@/hooks/use-toast';

export async function copiarVistaPreviaAlClipboard(
    captureNode: HTMLElement,
    toast?: (props: Parameters<typeof Toast>[0]) => void
): Promise<boolean> {
  console.log("[copyPreview] Starting copy process. Node:", captureNode);
  if (!captureNode) {
    console.error("[copyPreview] Capture node is missing.");
    toast?.({
        title: "Error de Captura",
        description: "El elemento a capturar no fue encontrado.",
        variant: "destructive"
    });
    return false;
  }

  try {
    const html2canvas = (await import("html2canvas")).default;

    console.log("[copyPreview] Fonts are ready. Calling html2canvas...");
    await (document as any).fonts?.ready;

    const canvas = await html2canvas(captureNode, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: captureNode.scrollWidth,
      height: captureNode.scrollHeight,
      windowWidth: captureNode.scrollWidth,
      windowHeight: captureNode.scrollHeight,
    });

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(b => resolve(b), "image/png", 0.95)
    );

    if (!blob) {
        throw new Error("No se pudo generar el blob de la imagen desde el canvas.");
    }
    console.log("[copyPreview] Blob generated:", blob);

    const ClipboardItemAny = (window as any).ClipboardItem;
    if (!ClipboardItemAny || !navigator.clipboard?.write) {
        throw new Error("La API del portapapeles no es compatible o no está permitida en este navegador.");
    }
    
    if (!document.hasFocus()) {
       throw new Error("La ventana no está enfocada. Por favor, haz clic en la página e intenta de nuevo.");
    }
    
    console.log("[copyPreview] Attempting to write to clipboard...");
    const item = new ClipboardItemAny({ "image/png": blob });
    await navigator.clipboard.write([item]);
    console.log("[copyPreview] Successfully wrote to clipboard.");

    toast?.({
        title: "✅ Imagen Copiada",
        description: "La vista previa ha sido copiada. Pégala con Ctrl+V.",
        className: "bg-green-100 dark:bg-green-900 border-green-500",
        duration: 5000,
    });
    return true;

  } catch (err) {
    console.error("Error al copiar al portapapeles:", err);
    toast?.({
        title: "Copia Fallida",
        description: (err as Error).message || "No se pudo copiar la imagen. Intenta de nuevo.",
        variant: "destructive",
        duration: 5000,
    });
    return false;
  }
}
