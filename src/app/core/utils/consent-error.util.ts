import { HttpErrorResponse } from '@angular/common/http';

// Shared by every join flow (clubs.page.ts's manual code entry, find-club.page.ts's list "Dołącz"
// button) — JoinStorefrontHandler on the backend gates joining on pending consents and returns this
// error code (409/400) instead of succeeding, so the UI can redirect to the consents page instead of
// just showing a generic failure toast.
export function isConsentRequiredError(error: HttpErrorResponse): boolean {
  const errors = error?.error?.errors;
  return Array.isArray(errors) && errors.some((e: { code?: string }) => e.code === 'member_consent_required');
}
