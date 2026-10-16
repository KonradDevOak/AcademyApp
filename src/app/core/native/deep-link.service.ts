import { Injectable, InjectionToken, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import {
  CAPACITOR_BROWSER,
  clearPendingPaymentReturn,
  readPendingPaymentReturn
} from '../../shared/payments/payment-redirect';

// A Capacitor plugin object is a Proxy whose `get` trap defeats jasmine.spyOn re-assignment, so tests
// swap this token instead of the plugin.
export const CAPACITOR_APP = new InjectionToken<typeof App>('CAPACITOR_APP', {
  providedIn: 'root',
  factory: () => App
});

// Parent invitation. Three shapes reach the app for the same invitation:
//  - https App Link `https://academy.localbiz.pl/invite?token=…&storefrontId=…` — the link invitation
//    e-mails carry today (the AcademyWeb portal URL; the OS hands it to the app once verified)
//  - custom scheme  `pl.localbiz.academy://invite/academy?token=…&storefrontId=…` — the backend's
//    api/academy/invite landing page bounces a mobile browser here
//  - https App Link `https://<api host>/api/academy/invite?token=…` — that landing page itself
const INVITE_SCHEME_PREFIX = 'pl.localbiz.academy://invite/academy';
const HTTPS_INVITE_URL = /^https?:\/\/[^/]+(?:\/api\/academy)?\/invite(?:\?|$)/i;

// Gateway return: the backend's payment return page (academy fee and carnet checkout alike) bounces a
// mobile browser to this scheme with the gateway's query (paymentId for PayNow).
const PAYMENT_CALLBACK_PREFIX = 'pl.localbiz.academy://payment-callback';
const DEFAULT_PAYMENT_CALLBACK_ROUTE = '/academy/payment-callback';

// One-time carnet renewal link sent by the Carnets reminder job.
const CARNET_PREFIX = 'pl.localbiz.academy://carnet';

// Central router for every deep link except the CIAM auth callback, which the vendored MSAL fork
// handles itself. One appUrlOpen listener for the running/backgrounded app, getLaunchUrl() for a cold
// start (app launched by the link).
@Injectable({ providedIn: 'root' })
export class DeepLinkService {
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly app = inject(CAPACITOR_APP);
  private readonly browser = inject(CAPACITOR_BROWSER);
  private initialized = false;

  constructor() {
    this.app.addListener('appUrlOpen', (event) => this.zone.run(() => this.handle(event.url)));
    // The member closed the checkout tab without finishing — still land on the callback screen, which
    // polls the backend and reports the payment honestly as pending/unpaid.
    this.browser.addListener('browserFinished', () => this.zone.run(() => this.resumePendingPayment({})));
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    try {
      const launch = await this.app.getLaunchUrl();
      if (launch?.url) {
        this.zone.run(() => this.handle(launch.url));
      }
    } catch {
      // getLaunchUrl is a no-op on the web / older platforms — nothing to process.
    }
  }

  private handle(url: string): void {
    if (!url) {
      return;
    }

    if (url.startsWith(PAYMENT_CALLBACK_PREFIX)) {
      void this.browser.close().catch(() => undefined);
      this.resumePendingPayment(queryOf(url), DEFAULT_PAYMENT_CALLBACK_ROUTE);
      return;
    }

    if (url.startsWith(CARNET_PREFIX)) {
      void this.router.navigateByUrl('/classes');
      return;
    }

    if (url.startsWith(INVITE_SCHEME_PREFIX) || HTTPS_INVITE_URL.test(url)) {
      const params = queryOf(url);
      if (params['token'] && params['storefrontId']) {
        void this.router.navigate(['/invite'], {
          queryParams: { token: params['token'], storefrontId: params['storefrontId'] }
        });
      }
    }
  }

  private resumePendingPayment(queryParams: Record<string, string>, fallbackRoute?: string): void {
    const route = readPendingPaymentReturn() ?? fallbackRoute;
    if (!route) {
      return;
    }
    clearPendingPaymentReturn();
    void this.router.navigate([route], { queryParams });
  }
}

function queryOf(url: string): Record<string, string> {
  try {
    return Object.fromEntries(new URL(url).searchParams.entries());
  } catch {
    return {};
  }
}
