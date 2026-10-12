export type ClassType = { id: string; name: string; description: string; duration_minutes: number };
export type Session = ClassType & { class_type_id: string; starts_at: string; ends_at: string; capacity: number; remaining: number };
export type Confirmation = { public_reference: string; name: string; class_name: string; starts_at: string; ends_at: string; duration_minutes: number };
export const TIME_ZONE = 'Europe/Madrid';
export const DEMO_NOTICE = 'Negocio de ejemplo: clases, horarios e imágenes ilustrativos. Las reservas son pruebas, no citas reales';
export function dateLabel(value: string, includeYear = true) { return new Intl.DateTimeFormat('es-ES', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', ...(includeYear ? { year: 'numeric' as const } : {}) }).format(new Date(value)); }
export function timeLabel(value: string) { return new Intl.DateTimeFormat('es-ES', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
export function localDate(value = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value); }
