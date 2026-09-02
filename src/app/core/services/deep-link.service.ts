import { Injectable, InjectionToken, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';

// Same InjectionToken-wrapping pattern as GEOLOCATION_PLUGIN / PREFERENCES_PLUGIN — a Capacitor
// plugin object is a Proxy whose `get` trap defeats jasmine.spyOn re-assignment, so tests swap this
// token instead of the plugin.
export const CAPACITOR_APP = new InjectionToken<typeof App>('CAPACITOR_APP', {
  providedIn: 'root',
  factory: () => App
});

// Parent-invitation deep link. Two shapes reach the app for the same link:
//  - custom scheme  `pl.localbiz.fitnessclub://invite/academy?token=…&storefrontId=…`
//    (the backend landing page AcademyInviteController bounces the mobile browser here, and this is
//     also the fallback while Android App Links / iOS Universal Links verification is not yet live)
//  - https App Link `https://api.localbiz.pl/api/academy/invite?token=…&storefrontId=…`
//    (once verified, the OS hands the https URL straight to the app with no landing page)
const CUSTOM_SCHEME_PREFIX = 'pl.localbiz.fitnessclub://invite/academy';
const HTTPS_INVITE_URL = /^https?:\/\/[^/]+\/api\/academy\/invite(?:\?|$)/i;

// The app's first central deep-link router (the two older listeners — CIAM auth-callback and P24
// payment-callback — stay independent for now: different hosts, and both are verified on-device, so
// folding them in here is a separate, riskier change). Registers one appUrlOpen listener for the
// backgrounded/running case and reads getLaunchUrl() for the cold-start case (app launched by the
// link). Routes matching links to the self-contained AcademyInvitePage.
@Injectable({ providedIn: 'root' })
export class DeepLinkService {
  private zone = inject(NgZone);
  private router = inject(Router);
  private app = inject(CAPACITOR_APP);
  private initialized = false;

  constructor() {
    this.app.addListener('appUrlOpen', (event) => this.zone.run(() => this.handle(event.url)));
  }

  // Called once from AppComponent. Covers the cold start: the app was launched (not just resumed) by
  // tapping the link, so the URL arrives via getLaunchUrl(), never appUrlOpen.
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

    const isInvite = url.startsWith(CUSTOM_SCHEME_PREFIX) || HTTPS_INVITE_URL.test(url);
    if (!isInvite) {
      return;
    }

    let params: URLSearchParams;
    try {
      params = new URL(url).searchParams;
    } catch {
      return;
    }

    const token = params.get('token');
    const storefrontId = params.get('storefrontId');
    if (!token || !storefrontId) {
      return;
    }

    this.router.navigate(['/academy-invite'], { queryParams: { token, storefrontId } });
  }
}
