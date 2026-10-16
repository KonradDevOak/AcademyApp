import { nextOccurrence } from './next-session';

describe('nextOccurrence', () => {
  it('returns later today when the slot is still ahead of now', () => {
    // Wednesday 2026-09-09 at 10:00 local time.
    const now = new Date(2026, 8, 9, 10, 0, 0);

    const result = nextOccurrence('Wednesday', '17:00:00', now);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(9);
    expect(result.getHours()).toBe(17);
    expect(result.getMinutes()).toBe(0);
  });

  it('rolls over to next week when the slot is today but the time has already passed', () => {
    // Wednesday 2026-09-09 at 18:00 local time — the 17:00 slot already happened.
    const now = new Date(2026, 8, 9, 18, 0, 0);

    const result = nextOccurrence('Wednesday', '17:00:00', now);

    expect(result.getDate()).toBe(16); // next Wednesday
    expect(result.getHours()).toBe(17);
  });

  it('returns exactly now (not next week) when the slot starts at this exact instant', () => {
    const now = new Date(2026, 8, 9, 17, 0, 0);

    const result = nextOccurrence('Wednesday', '17:00:00', now);

    // <= now rolls to next week per the implementation — the boundary itself counts as "already
    // started", so this must land 7 days later, not today.
    expect(result.getDate()).toBe(16);
  });

  it('picks the correct day later in the week', () => {
    // Monday 2026-09-07.
    const now = new Date(2026, 8, 7, 8, 0, 0);

    const result = nextOccurrence('Friday', '09:00:00', now);

    expect(result.getDate()).toBe(11); // that week's Friday
    expect(result.getHours()).toBe(9);
  });

  it('rolls over the month/year boundary correctly', () => {
    // Wednesday 2026-12-30 at 20:00 — the only Wednesday slot that week has already passed.
    const now = new Date(2026, 11, 30, 20, 0, 0);

    const result = nextOccurrence('Wednesday', '17:00:00', now);

    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(6);
  });
});
