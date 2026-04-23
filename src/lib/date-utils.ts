import { format } from 'date-fns';

export function formatISO(date: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  return format(date, 'yyyy-MM-dd');
}

export function formatTime(date: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  return format(date, 'HH:mm');
}
