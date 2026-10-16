import { DOCUMENT } from '@angular/common';
import { Injectable, Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, fromEvent } from 'rxjs';
import { isClubBusinessType } from '../models/business-type';
import { MembershipDto } from '../models/member';
import { MembersApiService } from './members-api';

export type MembershipStatus = 'idle' | 'loading' | 'loaded' | 'error';

// A list older than this is re-fetched quietly when the tab becomes visible again.
export const MEMBERSHIPS_STALE_AFTER_MS = 60_000;

// Holds the caller's active club memberships. Kept in memory only — the payload is small; a persisted
// cache would risk showing a stale club list right after accepting an invite. Fetched once per app start,
// then refreshed quietly whenever the app comes back to the foreground (the WebView fires
// visibilitychange on resume) after MEMBERSHIPS_STALE_AFTER_MS, so a club the member was removed from
// (or just joined on another device) doesn't linger until the next restart.
@Injectable({ providedIn: 'root' })
export class MembershipContextService {
  private readonly api = inject(MembersApiService);
  private readonly document = inject(DOCUMENT);

  private readonly _memberships = signal<MembershipDto[]>([]);
  private readonly _status = signal<MembershipStatus>('idle');

  readonly memberships: Signal<MembershipDto[]> = this._memberships.asReadonly();
  readonly status: Signal<MembershipStatus> = this._status.asReadonly();

  private inFlight: Promise<void> | null = null;
  private refreshing: Promise<void> | null = null;
  private loadedAt = 0;

  constructor() {
    fromEvent(this.document, 'visibilitychange')
      .pipe(
        filter(() => this.document.visibilityState === 'visible'),
        takeUntilDestroyed()
      )
      .subscribe(() => void this.refreshIfStale());
  }

  // Fetch once. Concurrent callers (the guard plus each component's constructor) share one request.
  ensureLoaded(): Promise<void> {
    if (this._status() === 'loaded') {
      return Promise.resolve();
    }
    return this.load();
  }

  // Force a re-fetch — used by the "no membership" screen's refresh button and after an invitation is
  // accepted.
  reload(): Promise<void> {
    this.inFlight = null;
    return this.load();
  }

  // Background refresh: no 'loading' state (the shell would swap the page for a spinner) and a failure
  // keeps the list already shown — only a successful response replaces it.
  refreshIfStale(): Promise<void> {
    if (this._status() !== 'loaded' || this.inFlight || this.refreshing) {
      return this.refreshing ?? Promise.resolve();
    }
    if (Date.now() - this.loadedAt < MEMBERSHIPS_STALE_AFTER_MS) {
      return Promise.resolve();
    }

    this.refreshing = firstValueFrom(this.api.getMyMemberships())
      .then((memberships) => this.accept(memberships))
      .catch(() => undefined)
      .finally(() => {
        this.refreshing = null;
      });

    return this.refreshing;
  }

  private load(): Promise<void> {
    if (this.inFlight) {
      return this.inFlight;
    }

    this._status.set('loading');
    this.inFlight = firstValueFrom(this.api.getMyMemberships())
      .then((memberships) => {
        this.accept(memberships);
        this._status.set('loaded');
      })
      .catch(() => {
        this._memberships.set([]);
        this._status.set('error');
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  private accept(memberships: MembershipDto[] | null): void {
    this._memberships.set((memberships ?? []).filter((m) => isClubBusinessType(m.businessType)));
    this.loadedAt = Date.now();
  }
}
