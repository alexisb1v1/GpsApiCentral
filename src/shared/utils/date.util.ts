/**
 * Utilidades para el manejo de fechas con zona horaria de Perú (America/Lima).
 */

/**
 * Obtiene la fecha en formato YYYY-MM-DD en la zona horaria 'America/Lima'.
 * Si no se provee una fecha, utiliza la fecha y hora actuales.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Obtiene la hora en formato HH:MM en la zona horaria 'America/Lima'.
 */
export function getLocalTimeString(date: Date): string {
  return date.toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
  });
}
