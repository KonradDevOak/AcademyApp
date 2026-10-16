import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CAPACITOR_BROWSER } from '../../shared/payments/payment-redirect';
import { environment } from '../../../environments/environment';

// The screens are ported from the AcademyWeb portal as-is, so their plain links assume a browser tab:
// `target="_blank"` documents and club websites, consent texts pointing at the portal itself, a relative
// fallback to /klub/:id/regulamin. One document-level listener gives them native meaning instead of
// touching every template:
//  - a link into the portal (or a relative one) opens the matching in-app route
//  - any other http(s) link opens in the system browser (Custom Tabs), never inside the app's WebView
//  - tel:/mailto: and everything else keep their default — Capacitor hands them to the OS
// RouterLink anchors are left alone: their own click handler runs first and cancels the default.
@Injectable({ providedIn: 'root' })
export class ExternalLinkService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly browser = inject(CAPACITOR_BROWSER);
  private readonly destroyRef = inject(DestroyRef);
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    const listener = (event: MouseEvent) => this.onClick(event);
    this.document.addEventListener('click', listener);
    this.destroyRef.onDestroy(() => this.document.removeEventListener('click', listener));
  }

  private onClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }
    const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor) {
      return;
    }

    const href = anchor.getAttribute('href') ?? '';
    const inAppPath = toInAppPath(href);
    if (inAppPath !== null) {
      event.preventDefault();
      this.zone.run(() => void this.router.navigateByUrl(inAppPath));
      return;
    }

    if (/^https?:\/\//i.test(href)) {
      event.preventDefault();
      void this.browser.open({ url: href });
    }
  }
}

// Maps a portal URL or a relative link to the in-app route it stands for; null for anything else.
export function toInAppPath(href: string): string | null {
  if (href.startsWith('/') && !href.startsWith('//')) {
    return href;
  }
  const portal = environment.webAppBaseUrl.replace(/\/+$/, '');
  if (portal && (href === portal || href.startsWith(`${portal}/`) || href.startsWith(`${portal}?`))) {
    return href.substring(portal.length) || '/';
  }
  return null;
}
