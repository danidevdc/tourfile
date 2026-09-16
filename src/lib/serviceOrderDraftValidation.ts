import type { ServiceOrderData } from './serviceOrderGenerator';

export function getServiceOrderDraftError(order: ServiceOrderData): string | null {
  if (!order.file.trim()) return 'Ingresa el número de file.';
  if (!order.guia.trim()) return 'Selecciona una guía principal.';
  if (order.services.length === 0) return 'Añade o genera al menos un servicio antes de guardar.';

  const incompleteIndex = order.services.findIndex(
    (service) => !service.fecha.trim() || !service.servicio.trim()
  );
  if (incompleteIndex !== -1) {
    return `Completa la fecha y la actividad del servicio ${incompleteIndex + 1}.`;
  }

  return null;
}
