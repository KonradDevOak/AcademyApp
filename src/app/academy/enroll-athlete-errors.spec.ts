import { HttpErrorResponse } from '@angular/common/http';
import { enrollAthleteErrorKey } from './enroll-athlete-errors';

function httpError(body: unknown, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('enrollAthleteErrorKey', () => {
  it('maps every known backend code to an i18n key', () => {
    const cases: Record<string, string> = {
      slot_already_pending_request: 'academy.enroll.errors.alreadyPendingRequest',
      slot_already_enrolled: 'academy.enroll.errors.alreadyEnrolled',
      slot_full: 'academy.enroll.errors.full',
      slot_not_full: 'academy.enroll.errors.notFull',
      already_on_slot_waitlist: 'academy.enroll.errors.alreadyOnWaitlist',
      slot_waitlist_entry_not_found: 'academy.enroll.errors.waitlistEntryNotFound',
      guardian_not_found: 'academy.enroll.errors.guardianNotFound'
    };
    for (const [code, key] of Object.entries(cases)) {
      expect(enrollAthleteErrorKey(httpError({ errors: [{ code }] }))).toBe(key);
    }
  });

  it('falls back to a generic key for an unknown or missing code', () => {
    expect(enrollAthleteErrorKey(httpError({ errors: [{ code: 'something_else' }] }))).toBe(
      'academy.enroll.errors.generic'
    );
    expect(enrollAthleteErrorKey(httpError(null))).toBe('academy.enroll.errors.generic');
  });
});
