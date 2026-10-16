import { Injectable, NgZone, inject } from '@angular/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

/**
 * Native custom URL scheme the P24 checkout return-URL landing page (backend
 * `MemberCarnetsController.P24PaymentCallback`) redirects back to once a member finishes (or
 * abandons) the hosted checkout opened via Browser.open(). Mirrors NATIVE_REDIRECT_URI in
 * msal-external-auth.service.ts — same App.addListener('appUrlOpen', ...) mechanism, registered
 * independently (Capacitor calls every registered listener, no shared/central deep-link router
 * exists in this app).
 */
const PAYMENT_NATIVE_REDIRECT_URI = 'pl.localbiz.academy://payment-callback';

// Reaching this deep link is pure UX (the browser landed back in the app) — it does NOT mean the
// payment succeeded. The real outcome is decided by the backend's async P24 IPN webhook; callers
// must re-fetch the carnet's actual state after waitForReturn() resolves, never assume success.
@Injectable({ providedIn: 'root' })
export class CarnetPaymentCallbackService {
  private zone = inject(NgZone);
  private pendingResolve: (() => void) | null = null;

  constructor() {
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) =>
      this.zone.run(() => this.handleAppUrlOpen(event.url)));
  }

  // Called right after Browser.open({url: redirectUrl}) so signUp()/retryPayment() can await the
  // round trip before refreshing carnet state, instead of refreshing immediately while the member
  // is still in the system browser.
  waitForReturn(): Promise<void> {
    return new Promise((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  private async handleAppUrlOpen(url: string): Promise<void> {
    if (!url.startsWith(PAYMENT_NATIVE_REDIRECT_URI)) {
      return;
    }

    await Browser.close().catch(() => { /* already closed, ignore */ });

    this.pendingResolve?.();
    this.pendingResolve = null;
  }
}
