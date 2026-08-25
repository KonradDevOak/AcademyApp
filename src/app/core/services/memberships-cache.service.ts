import { Injectable, InjectionToken, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { MembersApiService } from './members-api.service';
import { MembershipDto } from '../models/member.model';

// Same InjectionToken-wrapping pattern as GEOLOCATION_PLUGIN (storefront-discovery.service.ts) —
// Capacitor plugin objects are a Proxy whose `get` trap defeats jasmine.spyOn re-assignment, so tests
// swap this token instead of the plugin object directly.
export const PREFERENCES_PLUGIN = new InjectionToken<typeof Preferences>('PREFERENCES_PLUGIN', {
  providedIn: 'root',
  factory: () => Preferences
});

const STORAGE_KEY = 'memberships-cache';

// Mobile app, metered/slow connections — memberships (incl. club background image URLs, which cost the
// backend a real FileHub/Azure round-trip per club) rarely change, so avoid refetching on every app
// open. 24h is a pragmatic default: short enough that a joined/left club or a newly-uploaded background
// shows up the same day, long enough to skip the network call on most opens.
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

interface CachedMemberships {
  memberships: MembershipDto[];
  fetchedAt: number;
}

@Injectable({ providedIn: 'root' })
export class MembershipsCacheService {
  private membersApi = inject(MembersApiService);
  private preferences = inject(PREFERENCES_PLUGIN);
  private readonly subject = new BehaviorSubject<MembershipDto[]>([]);

  readonly memberships$ = this.subject.asObservable();

  // Cache-first: returns the cached list when it's fresh, otherwise fetches from the backend. The
  // main entry point most callers (clubs.page, StorefrontContextService) should use.
  async getOrRefresh(): Promise<MembershipDto[]> {
    const cached = await this.readCache();
    if (cached && Date.now() - cached.fetchedAt < STALE_AFTER_MS) {
      this.subject.next(cached.memberships);
      return cached.memberships;
    }
    return this.refresh();
  }

  // Always hits the backend, regardless of cache freshness — for callers that know the list changed
  // (join/leave a club).
  async refresh(): Promise<MembershipDto[]> {
    const memberships = await firstValueFrom(this.membersApi.getMyMemberships());
    this.subject.next(memberships);
    await this.preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify({ memberships, fetchedAt: Date.now() } satisfies CachedMemberships)
    });
    return memberships;
  }

  async invalidate(): Promise<void> {
    this.subject.next([]);
    await this.preferences.remove({ key: STORAGE_KEY });
  }

  private async readCache(): Promise<CachedMemberships | null> {
    const { value } = await this.preferences.get({ key: STORAGE_KEY });
    if (!value) return null;
    try {
      return JSON.parse(value) as CachedMemberships;
    } catch {
      return null;
    }
  }
}
