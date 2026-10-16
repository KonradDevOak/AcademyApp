// Pure helper backing the "nearest upcoming session" row on the athlete tab of
// academy-child-detail — kept in its own file so nextOccurrence's date-math edge cases
// (today vs. this-week vs. next-week rollover) can be unit tested without instantiating the
// component.

// System.DayOfWeek (backend) and JS Date#getDay() both index Sunday=0..Saturday=6, so a direct
// string-name lookup is safe without any offset correction.
const DAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6
};

export function nextOccurrence(dayOfWeek: string, startTime: string, now: Date = new Date()): Date {
  const targetDay = DAY_INDEX[dayOfWeek];
  const [hours, minutes, seconds] = startTime.split(':').map(Number);
  const candidate = new Date(now);
  candidate.setHours(hours, minutes, seconds ?? 0, 0);
  let daysUntil = (targetDay - now.getDay() + 7) % 7;
  if (daysUntil === 0 && candidate.getTime() <= now.getTime()) {
    daysUntil = 7;
  }
  candidate.setDate(candidate.getDate() + daysUntil);
  return candidate;
}
