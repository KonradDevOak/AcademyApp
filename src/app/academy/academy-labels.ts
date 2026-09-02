// Maps Modules.Academy backend enum strings (PascalCase, e.g. "MartialArts", "TwicePerWeek", "Monday")
// to ngx-translate keys. The backend never returns localized text or a period label — the app owns all
// of that (see academy.model.ts). Used across all three academy screens.

export function disciplineKey(discipline: string): string {
  return 'academy.discipline.' + (discipline === 'MartialArts' ? 'martialArts' : 'acrobatics');
}

export function frequencyKey(frequency: string): string {
  return 'academy.frequency.' + (frequency === 'TwicePerWeek' ? 'twicePerWeek' : 'oncePerWeek');
}

export function dayKey(dayOfWeek: string): string {
  return 'academy.day.' + dayOfWeek.toLowerCase();
}

// "17:00:00" -> "17:00"
export function shortTime(time: string): string {
  return time?.length >= 5 ? time.substring(0, 5) : time;
}

// grosze -> "90,00 zł"
export function formatZloty(grosze: number): string {
  return (grosze / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
}
