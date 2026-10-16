import { Injectable, InjectionToken, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Browser } from '@capacitor/browser';

// Same InjectionToken-wrapping pattern as CAPACITOR_APP — a Capacitor plugin object is a Proxy that
// defeats jasmine.spyOn, so specs swap this token instead.
export const CAPACITOR_BROWSER = new InjectionToken<typeof Browser>('CAPACITOR_BROWSER', {
  providedIn: 'root',
  factory: () => Browser
});

// In-app route that resumes a checkout once the gateway hands control back. Remembered across the round
// trip (Android may kill the backgrounded app meanwhile), read by DeepLinkService when the backend's
// return page bounces to pl.localbiz.academy://payment-callback — that one deep link serves both the
// academy fee and the carnet checkout, so the app itself has to know which one it started.
const PENDING_RETURN_STORAGE_KEY = 'academy.pending-payment-return';

const SECTION_CALLBACK: Record<string, string> = {
  academy: '/academy/payment-callback',
  classes: '/classes/payment-callback'
};

// Native counterpart of AcademyWeb's full-page gateway redirect: the checkout opens in the system browser
// (Custom Tabs) instead of navigating the WebView away from the app, and the return lands on the same
// callback screens the web portal uses. The callback route follows from the section the checkout was
// started in (/academy or /classes).
@Injectable({ providedIn: 'root' })
export class PaymentRedirectService {
  private readonly browser = inject(CAPACITOR_BROWSER);
  private readonly router = inject(Router);

  redirectTo(url: string): void {
    const section = this.router.url.split(/[/?#]/)[1] ?? '';
    writePendingReturn(SECTION_CALLBACK[section] ?? null);
    void this.browser.open({ url });
  }
}

export function readPendingPaymentReturn(): string | null {
  try {
    return localStorage.getItem(PENDING_RETURN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingPaymentReturn(): void {
  writePendingReturn(null);
}

function writePendingReturn(path: string | null): void {
  try {
    if (path === null) {
      localStorage.removeItem(PENDING_RETURN_STORAGE_KEY);
    } else {
      localStorage.setItem(PENDING_RETURN_STORAGE_KEY, path);
    }
  } catch {
    // Ignore — the deep link then falls back to the academy callback screen.
  }
}
