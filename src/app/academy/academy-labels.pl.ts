// dayKey() (i18n key-builder, no Polish text) now comes straight
// from @konraddevoak/academy-api — this file only keeps what that package doesn't cover:
// monthKey() (MonthlyAttendanceDto/FeeChargeDto carry a bare 1-indexed number, no period label) and gradeResultKey()
// (GradeAwardDto.result).

// 1-indexed to match MonthlyAttendanceDto.month/FeeChargeDto.month (index 0 is a placeholder,
// never read). Keys mirror public/assets/i18n/pl.json's academy.month.*.
const MONTH_KEYS: readonly string[] = [
  '',
  'academy.month.1',
  'academy.month.2',
  'academy.month.3',
  'academy.month.4',
  'academy.month.5',
  'academy.month.6',
  'academy.month.7',
  'academy.month.8',
  'academy.month.9',
  'academy.month.10',
  'academy.month.11',
  'academy.month.12'
];

export function monthKey(month: number): string {
  return MONTH_KEYS[month] ?? '';
}

// GradeAwardDto.result is "Passed" | "Failed" — mirrors
// public/assets/i18n/pl.json's academy.childDetail.grades.result.*. An unrecognized value still
// resolves to a (missing) key under the same namespace rather than raw backend text, so it renders
// as *something* key-shaped instead of leaking an English enum value into the Polish UI.
export function gradeResultKey(result: string): string {
  return `academy.childDetail.grades.result.${result}`;
}

// AttendanceSessionStatusDto.status — mirrors public/assets/i18n/{pl,en}.json's
// academy.childDetail.attendance.status.*.
export function sessionStatusKey(status: string): string {
  return `academy.childDetail.attendance.status.${status}`;
}
