import type { Toast } from '@/hooks/use-toast';

export type PreviewImageResult = 'copied' | 'shared' | 'downloaded' | 'cancelled' | 'failed';

export function previewImageWasSent(result: PreviewImageResult): boolean {
  return result === 'copied' || result === 'shared';
}

export async function crearBlobVistaPrevia(captureNode: HTMLElement): Promise<Blob> {
  const { domToBlob } = await import('modern-screenshot');
  await document.fonts?.ready;

  const blob = await domToBlob(captureNode, {
    scale: 2,
    backgroundColor: '#ffffff',
  });

  if (!blob) {
    throw new Error('No se pudo generar la imagen de la orden.');
  }

  return blob;
}

function isMobileDevice(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function downloadBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `orden-de-servicio-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function copiarVistaPreviaAlClipboard(
  captureNode: HTMLElement | null,
  toast?: (props: Toast) => void,
  preparedBlob?: Blob | null,
): Promise<PreviewImageResult> {
  if (!captureNode) {
    toast?.({
      title: 'Error de captura',
      description: 'No se encontró la orden para generar la imagen.',
      variant: 'destructive',
    });
    return 'failed';
  }

  try {
    const blob = preparedBlob ?? await crearBlobVistaPrevia(captureNode);
    if (isMobileDevice()) {
      downloadBlob(blob);
      toast?.({
        title: 'Imagen guardada',
        description: 'Adjunta esta imagen desde Fotos o Archivos en WhatsApp.',
        variant: 'success',
        duration: 6000,
      });
      return 'downloaded';
    }
    const imageFile = new File([blob], 'orden-de-servicio.png', { type: 'image/png' });

    if (isMobileDevice() && navigator.share) {
      const shareData: ShareData = {
        title: 'Orden de servicio',
        files: [imageFile],
      };

      if (!navigator.canShare || navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          toast?.({
            title: 'Imagen compartida',
            description: 'La orden se compartió correctamente.',
            variant: 'success',
          });
          return 'shared';
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return 'cancelled';
          }
          console.warn('El menú para compartir no estuvo disponible; se usará el método alternativo.', error);
        }
      }
    }

    const ClipboardItemClass = window.ClipboardItem;
    if (ClipboardItemClass && navigator.clipboard?.write && document.hasFocus()) {
      const item = new ClipboardItemClass({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      toast?.({
        title: 'Imagen copiada',
        description: 'La vista previa está lista para pegarla en WhatsApp.',
        variant: 'success',
        duration: 5000,
      });
      return 'copied';
    }

    downloadBlob(blob);
    toast?.({
      title: 'Imagen descargada',
      description: 'Tu navegador no permite copiar imágenes. Adjunta el PNG descargado en WhatsApp.',
      variant: 'default',
      duration: 6000,
    });
    return 'downloaded';
  } catch (error) {
    console.error('Error al compartir la vista previa:', error);
    toast?.({
      title: 'No se pudo compartir',
      description: (error as Error).message || 'Intenta nuevamente desde un navegador actualizado.',
      variant: 'destructive',
      duration: 5000,
    });
    return 'failed';
  }
}
