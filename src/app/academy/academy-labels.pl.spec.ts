import { gradeResultKey, monthKey } from './academy-labels.pl';

describe('monthKey', () => {
  it('maps 1-indexed month numbers to an i18n key', () => {
    expect(monthKey(1)).toBe('academy.month.1');
    expect(monthKey(9)).toBe('academy.month.9');
    expect(monthKey(12)).toBe('academy.month.12');
  });

  it('returns an empty string for an out-of-range month', () => {
    expect(monthKey(0)).toBe('');
    expect(monthKey(13)).toBe('');
  });
});

describe('gradeResultKey', () => {
  it('maps known exam results to an i18n key', () => {
    expect(gradeResultKey('Passed')).toBe('academy.childDetail.grades.result.Passed');
    expect(gradeResultKey('Failed')).toBe('academy.childDetail.grades.result.Failed');
  });

  it('falls back to the raw result under the same key namespace for an unknown value', () => {
    expect(gradeResultKey('Pending')).toBe('academy.childDetail.grades.result.Pending');
  });
});
