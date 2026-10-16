// Survives the round trip to the gateway in the system browser (localStorage, not signals — Android may
// kill the backgrounded app during checkout, and sessionStorage would die with it). Namespaced like
// StorefrontContextService's key to avoid colliding with MSAL's own storage entries; a one-shot handoff,
// cleared by the callback page once the payment is resolved.
const ACADEMY_PAYMENT_RETURN_STORAGE_KEY = 'academy.academy-payment-return';

// The guardian-level charge being paid (one per parent per month across all their children) — the
// callback page polls getMyPayments() for it; the storefront comes from the selected-storefront context.
export interface AcademyPaymentReturnContext {
  guardianChargeId: string;
}

export function saveAcademyPaymentReturnContext(context: AcademyPaymentReturnContext): void {
  try {
    localStorage.setItem(ACADEMY_PAYMENT_RETURN_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Private-browsing modes can throw on access — the return page will just show its no-context
    // error state, same as if the parent opened it directly without ever starting a checkout.
  }
}

// Not removed here on read — a restart mid-poll (e.g. the parent closes and reopens the app) can re-read
// the same context and resume polling. Callers clear it explicitly once resolved
// (see clearAcademyPaymentReturnContext()).
export function readAcademyPaymentReturnContext(): AcademyPaymentReturnContext | null {
  try {
    const raw = localStorage.getItem(ACADEMY_PAYMENT_RETURN_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AcademyPaymentReturnContext>;
    return parsed.guardianChargeId ? { guardianChargeId: parsed.guardianChargeId } : null;
  } catch {
    return null;
  }
}

export function clearAcademyPaymentReturnContext(): void {
  try {
    localStorage.removeItem(ACADEMY_PAYMENT_RETURN_STORAGE_KEY);
  } catch {
    // Ignore — worst case the next read finds a stale entry from an already-resolved payment.
  }
}
