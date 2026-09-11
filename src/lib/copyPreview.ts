
import React from 'react';
import type { Toast } from '@/hooks/use-toast';

export async function copiarVistaPreviaAlClipboard(
    captureNode: HTMLElement | null, // Accept HTMLElement or null
    toast?: (props: Toast) => void
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
    const { domToBlob } = await import("modern-screenshot");

    console.log("[copyPreview] Fonts are ready. Calling modern-screenshot...");
    await (document as any).fonts?.ready;

    const blob = await domToBlob(captureNode, {
      scale: 2,
      backgroundColor: "#ffffff",
    });

    if (!blob) {
        throw new Error("No se pudo generar el blob de la imagen.");
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
        variant: "success",
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
