import { HttpErrorResponse } from '@angular/common/http';

// Shape of the backend error body (Shared.Infrastructure ExceptionToResponseMapper):
// { errors: [{ code, message }] }. Mirrors the native app's consent-error.util.ts.
interface ApiErrorBody {
  errors?: { code?: string; message?: string }[];
}

export function getErrorCode(error: HttpErrorResponse): string | undefined {
  const body = error?.error as ApiErrorBody | undefined;
  return Array.isArray(body?.errors) ? body.errors[0]?.code : undefined;
}

// Keyed by the backend error code, independent of HTTP status: guardian_not_found is actually a
// 404 (GuardianNotFoundException : NotFoundException), the rest are 400. Returns an i18n key
// (see public/assets/i18n/pl.json academy.onboarding.errors.*), not translated text — call sites
// pipe it through TranslatePipe/TranslateService.
const REGISTER_ATHLETE_ERROR_KEYS: Record<string, string> = {
  guardian_not_found: 'academy.onboarding.errors.guardianNotFound'
};

const GENERIC_KEY = 'academy.onboarding.errors.generic';

export function registerAthleteErrorKey(error: HttpErrorResponse): string {
  const code = getErrorCode(error);
  return (code && REGISTER_ATHLETE_ERROR_KEYS[code]) || GENERIC_KEY;
}
