/**
 * Central configuration for the agency this deployment serves.
 *
 * TourFile is built for one tour operator at a time — there is no
 * multi-tenant data model (no tenantId in Firestore). To point this
 * codebase at a different agency, edit the values below and redeploy;
 * no other file should need branding/currency/locale/city literals.
 */

export const agency = {
  name: "TourFile",

  currency: {
    /** Symbol prefixed to formatted amounts, e.g. "Bs. 1,234.56". */
    symbol: "Bs.",
    /** Intl.NumberFormat locale used for thousands/decimal separators. */
    locale: "es-BO",
  },

  /** Cities this agency operates tours in. Used for rule-matching UI. */
  cities: ["La Paz", "Uyuni"] as const,

  /** Daily WhatsApp report reminder shown in generated service orders. */
  defaultServiceOrderNote:
    "TODOS LOS GUÍAS DEBEN ENVIAR UN INFORME DIARIO POR WHATSAPP A LA SEÑORA JUDITH SOBRE LOS SERVICIOS REALIZADOS.\n" +
    "GUIA DEBE PRESENTAR COPIA DE PASAPORTE DE PAX DESPUES DE CADA SERVICIO JUNTO A SU LIQUIDACION Y CAJA CHICA\n" +
    "LA CAJA CHICA CUBRE 1 BOTELLA DE AGUA POR DÍA PARA CADA PAX, GUÍA Y CHOFER. NO INCLUYE TRANSFERS NI SERVICIOS EN EL LAGO.",
} as const;

export type AgencyCity = (typeof agency.cities)[number];

/**
 * Formats a number as this agency's currency, matching the pattern used
 * throughout the guide-liquidation module: "Bs. 1,234.56".
 */
export function formatMoney(amount: number, options?: { maximumFractionDigits?: number }): string {
  const formatted = amount.toLocaleString(agency.currency.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  });
  return `${agency.currency.symbol} ${formatted}`;
}
