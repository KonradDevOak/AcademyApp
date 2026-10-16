import { HttpErrorResponse } from '@angular/common/http';
import { getErrorCode, registerAthleteErrorKey } from './register-athlete-errors';

function httpError(body: unknown, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('getErrorCode', () => {
  it('reads the first code from an { errors: [...] } body', () => {
    expect(getErrorCode(httpError({ errors: [{ code: 'guardian_not_found' }] }))).toBe('guardian_not_found');
  });

  it('returns undefined when the body has no errors array', () => {
    expect(getErrorCode(httpError({ message: 'boom' }))).toBeUndefined();
    expect(getErrorCode(httpError(null))).toBeUndefined();
    expect(getErrorCode(httpError('plain text'))).toBeUndefined();
  });
});

describe('registerAthleteErrorKey', () => {
  it('maps every known backend code to an i18n key', () => {
    const cases: Record<string, string> = {
      guardian_not_found: 'academy.onboarding.errors.guardianNotFound'
    };
    for (const [code, key] of Object.entries(cases)) {
      expect(registerAthleteErrorKey(httpError({ errors: [{ code }] }))).toBe(key);
    }
  });

  it('maps guardian_not_found even though it arrives as a 404', () => {
    const error = httpError({ errors: [{ code: 'guardian_not_found' }] }, 404);
    expect(registerAthleteErrorKey(error)).toBe('academy.onboarding.errors.guardianNotFound');
  });

  it('falls back to a generic key for an unknown or missing code', () => {
    expect(registerAthleteErrorKey(httpError({ errors: [{ code: 'something_else' }] }))).toBe(
      'academy.onboarding.errors.generic'
    );
    expect(registerAthleteErrorKey(httpError(null))).toBe('academy.onboarding.errors.generic');
  });
});
