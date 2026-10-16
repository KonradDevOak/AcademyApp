import { HttpErrorResponse } from '@angular/common/http';
import { academyPaymentErrorKey } from './academy-payment-errors';

function errorWithCode(code: string, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ error: { errors: [{ code }] }, status });
}

describe('academyPaymentErrorKey', () => {
  it('maps guardian_charge_not_found (404) to its i18n key', () => {
    expect(academyPaymentErrorKey(errorWithCode('guardian_charge_not_found', 404))).toBe(
      'academy.paymentErrors.guardianChargeNotFound'
    );
  });

  it('maps guardian_charge_already_paid', () => {
    expect(academyPaymentErrorKey(errorWithCode('guardian_charge_already_paid'))).toBe(
      'academy.paymentErrors.guardianChargeAlreadyPaid'
    );
  });

  it('maps academy_payment_not_configured', () => {
    expect(academyPaymentErrorKey(errorWithCode('academy_payment_not_configured'))).toBe(
      'academy.paymentErrors.academyPaymentNotConfigured'
    );
  });

  it('maps academy_online_payment_disabled', () => {
    expect(academyPaymentErrorKey(errorWithCode('academy_online_payment_disabled'))).toBe(
      'academy.paymentErrors.academyOnlinePaymentDisabled'
    );
  });

  it('falls back to a generic key for a code that no longer has a UI (per-child / billing-plan)', () => {
    expect(academyPaymentErrorKey(errorWithCode('billing_plan_not_found', 404))).toBe(
      'academy.paymentErrors.generic'
    );
  });

  it('falls back to a generic key for an unknown code', () => {
    expect(academyPaymentErrorKey(errorWithCode('something_else'))).toBe('academy.paymentErrors.generic');
  });

  it('falls back to a generic key when the body carries no error code', () => {
    const error = new HttpErrorResponse({ error: {}, status: 500 });
    expect(academyPaymentErrorKey(error)).toBe('academy.paymentErrors.generic');
  });
});
