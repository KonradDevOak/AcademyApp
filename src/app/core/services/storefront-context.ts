import { Injectable, Signal, signal } from '@angular/core';
import { MembershipDto } from '../models/member';

// localStorage (not sessionStorage): the active-club choice must survive an app restart,
// the WebView keeps it in the app's private data. Namespaced to avoid colliding
// with MSAL's own localStorage entries.
const ACTIVE_STOREFRONT_STORAGE_KEY = 'academy.active-storefront-id';

export type NavigationOutcome = 'ok' | 'needs-picker' | 'empty';

export interface NavigationResolution {
  outcome: NavigationOutcome;
  storefrontId?: string;
}

// Tracks "which club am I currently looking at". A parent can belong to several clubs, so the shell
// and the guard need one place to read/set the active storefront id.
@Injectable({ providedIn: 'root' })
export class StorefrontContextService {
  private readonly _selectedId = signal<string | null>(readPersisted());

  readonly selectedStorefrontId: Signal<string | null> = this._selectedId.asReadonly();

  select(storefrontId: string): void {
    this._selectedId.set(storefrontId);
    writePersisted(storefrontId);
  }

  clear(): void {
    this._selectedId.set(null);
    writePersisted(null);
  }

  // Read-only: returns the remembered id only if it still matches one of the given memberships.
  // Never auto-selects and never prompts.
  getPersistedIfValid(memberships: MembershipDto[]): string | null {
    const current = this._selectedId();
    return current && memberships.some((m) => m.storefrontId === current) ? current : null;
  }

  // Decides where a guarded route should send the user, given their memberships:
  //   0 memberships              -> 'empty'        (show the no-membership screen)
  //   1 membership               -> 'ok'          (auto-selected silently, no picker)
  //   >1, valid remembered pick  -> 'ok'
  //   >1, no valid remembered    -> 'needs-picker' (show the club picker)
  resolveForNavigation(memberships: MembershipDto[]): NavigationResolution {
    if (memberships.length === 0) {
      this.clear();
      return { outcome: 'empty' };
    }

    if (memberships.length === 1) {
      this.select(memberships[0].storefrontId);
      return { outcome: 'ok', storefrontId: memberships[0].storefrontId };
    }

    const remembered = this.getPersistedIfValid(memberships);
    if (remembered) {
      return { outcome: 'ok', storefrontId: remembered };
    }

    return { outcome: 'needs-picker' };
  }
}

function readPersisted(): string | null {
  try {
    return localStorage.getItem(ACTIVE_STOREFRONT_STORAGE_KEY);
  } catch {
    // Private-browsing modes can throw on access — degrade to in-memory only.
    return null;
  }
}

function writePersisted(storefrontId: string | null): void {
  try {
    if (storefrontId === null) {
      localStorage.removeItem(ACTIVE_STOREFRONT_STORAGE_KEY);
    } else {
      localStorage.setItem(ACTIVE_STOREFRONT_STORAGE_KEY, storefrontId);
    }
  } catch {
    // Ignore — the selection still lives in the signal for this session.
  }
}
