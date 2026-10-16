// Survives the round trip to the gateway in the system browser (localStorage, not signals — Android may
// kill the backgrounded app during checkout, and sessionStorage would die with it).
// A one-shot handoff for the current checkout attempt, namespaced like the other academy.* keys.
const FITNESS_PAYMENT_RETURN_STORAGE_KEY = 'academy.fitness-payment-return';

// What the carnet looked like right before checkout — the return page treats the payment as settled once
// the carnet is Active and differs from this snapshot (first activation, reactivation or a period paid
// ahead), since P24 credits asynchronously via its IPN.
export interface FitnessPaymentReturnContext {
  storefrontId: string;
  previousStatus: string | null;
  previousPeriodEnd: string | null;
}

export function saveFitnessPaymentReturnContext(context: FitnessPaymentReturnContext): void {
  try {
    localStorage.setItem(FITNESS_PAYMENT_RETURN_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Private-browsing modes can throw on access — the return page falls back to its no-context state.
  }
}

// Not removed on read, so a reload mid-poll resumes; callers clear it once resolved.
export function readFitnessPaymentReturnContext(): FitnessPaymentReturnContext | null {
  try {
    const raw = localStorage.getItem(FITNESS_PAYMENT_RETURN_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<FitnessPaymentReturnContext>;
    return parsed.storefrontId
      ? {
          storefrontId: parsed.storefrontId,
          previousStatus: parsed.previousStatus ?? null,
          previousPeriodEnd: parsed.previousPeriodEnd ?? null
        }
      : null;
  } catch {
    return null;
  }
}

export function clearFitnessPaymentReturnContext(): void {
  try {
    localStorage.removeItem(FITNESS_PAYMENT_RETURN_STORAGE_KEY);
  } catch {
    // Ignore — worst case the next read finds a stale entry from an already-resolved payment.
  }
}
