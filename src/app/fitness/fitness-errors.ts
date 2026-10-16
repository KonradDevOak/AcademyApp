import { HttpErrorResponse } from '@angular/common/http';
import { getErrorCode } from '../academy/register-athlete-errors';

// Keyed by backend error code (independent of HTTP status), covering the Classes/Carnets member endpoints
// used by the fitness screens. Returns an i18n key (public/assets/i18n/pl.json fitness.errors.*), not
// translated text — call sites pipe it through TranslatePipe.
const FITNESS_ERROR_KEYS: Record<string, string> = {
  auto_enrollment_window_still_open: 'fitness.errors.enrollmentNotOpen',
  member_booking_blocked: 'fitness.errors.bookingBlocked',
  session_full: 'fitness.errors.sessionFull',
  already_enrolled: 'fitness.errors.alreadyEnrolled',
  member_consent_required: 'fitness.errors.consentRequired',
  member_membership_not_active: 'fitness.errors.membershipNotActive',
  carnet_already_exists: 'fitness.errors.carnetAlreadyExists',
  carnet_payment_not_configured: 'fitness.errors.paymentNotConfigured',
  carnets_pay_now_recurring_not_supported: 'fitness.errors.recurringNotSupported',
  invalid_discount_code: 'fitness.errors.invalidDiscountCode'
};

const GENERIC_KEY = 'fitness.errors.generic';

export function fitnessErrorKey(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return GENERIC_KEY;
  }
  const code = getErrorCode(error);
  return (code && FITNESS_ERROR_KEYS[code]) || GENERIC_KEY;
}

export function isConsentRequiredError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && getErrorCode(error) === 'member_consent_required';
}
