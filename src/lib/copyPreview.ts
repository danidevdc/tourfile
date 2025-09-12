
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

  // --- NUEVO ENFOQUE: CLONACIÓN ---
  // 1. Clonar el nodo para evitar problemas con el CSS del modal.
  const clone = node.cloneNode(true) as HTMLDivElement;
  
  // 2. Aplicar estilos para posicionarlo fuera de la pantalla pero con dimensiones reales.
  clone.style.position = 'absolute';
  clone.style.left = '-9999px';
  clone.style.top = '0px';
  clone.style.width = `${node.offsetWidth}px`; // Usar el ancho del nodo original
  clone.style.height = 'auto'; // Permitir que la altura se expanda al contenido

  document.body.appendChild(clone);
  // --- FIN DEL NUEVO ENFOQUE ---

  try {
    const html2canvas = (await import("html2canvas")).default;

    // Asegurarse que las fuentes estén listas
    await document.fonts?.ready?.catch(() => {});

    // 3. Capturar el CLON, no el nodo original
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#fff",
      logging: false,
      // Ya no necesitamos 'height' y 'windowHeight' porque el clon ya tiene la altura completa.
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
        title: "Copia Fallida",
        description: (err as Error).message || "No se pudo copiar la imagen. Intenta de nuevo.",
        variant: "destructive",
        duration: 5000,
    });
  } finally {
      // 4. Limpieza: siempre eliminar el clon después de la operación.
      document.body.removeChild(clone);
  }
}
