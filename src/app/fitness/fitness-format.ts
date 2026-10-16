// Instants arrive as UTC ISO strings; these render them on the viewer's own clock (Polish formatting, same
// as the rest of the app's copy).

const DATE = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DAY_TIME = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});
const TIME = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });

// "14.10.2026"
export function formatDate(instant: string): string {
  return DATE.format(new Date(instant));
}

// "wt., 14.10, 18:00"
export function formatDayTime(instant: string): string {
  return DAY_TIME.format(new Date(instant));
}

// "18:00"
export function formatTime(instant: string): string {
  return TIME.format(new Date(instant));
}
