import { HttpErrorResponse } from '@angular/common/http';
import { getErrorCode } from './register-athlete-errors';

// Same error-body shape/parsing as register-athlete-errors.ts (reused via getErrorCode) — this file
// only adds the mapping for the enrollment-request/waitlist exceptions from the backend (Tasks 4/7).
// Backend error codes are the exception class name in snake_case, minus the `Exception` suffix.
const ENROLL_ATHLETE_ERROR_KEYS: Record<string, string> = {
  slot_already_pending_request: 'academy.enroll.errors.alreadyPendingRequest',
  slot_already_enrolled: 'academy.enroll.errors.alreadyEnrolled',
  slot_full: 'academy.enroll.errors.full',
  slot_not_full: 'academy.enroll.errors.notFull',
  already_on_slot_waitlist: 'academy.enroll.errors.alreadyOnWaitlist',
  slot_waitlist_entry_not_found: 'academy.enroll.errors.waitlistEntryNotFound',
  guardian_not_found: 'academy.enroll.errors.guardianNotFound'
};

const GENERIC_KEY = 'academy.enroll.errors.generic';

export function enrollAthleteErrorKey(error: HttpErrorResponse): string {
  const code = getErrorCode(error);
  return (code && ENROLL_ATHLETE_ERROR_KEYS[code]) || GENERIC_KEY;
}
