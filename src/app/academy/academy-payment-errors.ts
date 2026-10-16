import { HttpErrorResponse } from '@angular/common/http';
import { getErrorCode } from './register-athlete-errors';

// Keyed by backend error code (independent of HTTP status), covering the guardian payment surface used
// from academy-payments.ts (payGuardianCharge). Returns an i18n key (see
// public/assets/i18n/pl.json academy.paymentErrors.*), not translated text — call sites pipe it
// through TranslatePipe/TranslateService.
const ACADEMY_PAYMENT_ERROR_KEYS: Record<string, string> = {
  guardian_charge_not_found: 'academy.paymentErrors.guardianChargeNotFound',
  guardian_charge_already_paid: 'academy.paymentErrors.guardianChargeAlreadyPaid',
  academy_payment_not_configured: 'academy.paymentErrors.academyPaymentNotConfigured',
  academy_online_payment_disabled: 'academy.paymentErrors.academyOnlinePaymentDisabled'
};

const GENERIC_KEY = 'academy.paymentErrors.generic';

export function academyPaymentErrorKey(error: HttpErrorResponse): string {
  const code = getErrorCode(error);
  return (code && ACADEMY_PAYMENT_ERROR_KEYS[code]) || GENERIC_KEY;
}
