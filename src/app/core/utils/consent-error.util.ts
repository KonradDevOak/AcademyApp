import { HttpErrorResponse } from '@angular/common/http';

// Reads the first backend error code from a Shared.Infrastructure.Exceptions.ExceptionToResponseMapper-
// shaped 400/409 body ({ errors: [{ code, message }] }) — undefined for any other error shape (network
// error, 401/500 with no body, etc.); callers should always fall back to a generic message in that case.
export function getErrorCode(error: HttpErrorResponse): string | undefined {
  const errors = error?.error?.errors;
  return Array.isArray(errors) ? errors[0]?.code : undefined;
}

// Shared by every join flow (clubs.page.ts's manual code entry, find-club.page.ts's list "Dołącz"
// button) — JoinStorefrontHandler on the backend gates joining on pending consents and returns this
// error code (409/400) instead of succeeding, so the UI can redirect to the consents page instead of
// just showing a generic failure toast.
export function isConsentRequiredError(error: HttpErrorResponse): boolean {
  return getErrorCode(error) === 'member_consent_required';
}
