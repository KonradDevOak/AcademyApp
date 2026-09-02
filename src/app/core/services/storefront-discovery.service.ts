import { Injectable, InjectionToken, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { Geolocation } from '@capacitor/geolocation';
import { ExternalConfigService } from '@shared/iam-msal-external';
import { StorefrontDiscoveryResultDto } from '../models/storefront.model';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Which vertical(s) to search. 'all' (the default) fans out one request per vertical and merges the
// results — the backend's businessType param takes a single value, so a cross-vertical list needs two
// calls. FitnessClub is multi-vertical: a parent looking for a sports academy and a member looking for
// a fitness club both land on the same find-club screen.
export type DiscoveryVertical = 'fitness' | 'academy' | 'all';

// Capacitor plugin objects (like `Geolocation`) are a Proxy whose `get` trap always returns a fresh
// wrapper function regardless of any property assignment — `spyOn(Geolocation, 'checkPermissions')`
// silently has no effect on the real call site, because jasmine's re-assignment never survives the next
// property read through that trap. Routing the plugin through an injection token (same singleton at
// runtime, via the factory below) is what actually makes it swappable in tests.
export const GEOLOCATION_PLUGIN = new InjectionToken<typeof Geolocation>('GEOLOCATION_PLUGIN', {
  providedIn: 'root',
  factory: () => Geolocation
});

// Each vertical's discovery scope: a BusinessType plus its "actually joinable" readiness gate (every
// Services label a member/parent needs already enabled). See Sandbox's BrowsePublicStorefrontsHandler.
const VERTICAL_QUERY: Record<'fitness' | 'academy', Record<string, string>> = {
  fitness: { businessType: 'Fitness', requireFitnessReadiness: 'true' },
  academy: { businessType: 'SportsSchool', requireAcademyReadiness: 'true' }
};

@Injectable({ providedIn: 'root' })
export class StorefrontDiscoveryService {
  private http = inject(HttpClient);
  private configService = inject(ExternalConfigService);
  private geolocation = inject(GEOLOCATION_PLUGIN);

  search(options: {
    search?: string;
    coordinates?: Coordinates | null;
    vertical?: DiscoveryVertical;
  }): Observable<StorefrontDiscoveryResultDto[]> {
    const vertical = options.vertical ?? 'all';
    const targets: ('fitness' | 'academy')[] = vertical === 'all' ? ['fitness', 'academy'] : [vertical];

    const requests = targets.map((target) => this.searchVertical(target, options));
    return forkJoin(requests).pipe(
      map((lists) => this.mergeResults(lists.reduce((all, list) => all.concat(list), [])))
    );
  }

  // Each vertical's request is already sorted server-side (by distance when coordinates were given,
  // otherwise alphabetically); re-apply the same order across the merged list so a two-vertical search
  // doesn't show fitness clubs then academies as two separate blocks.
  private mergeResults(results: StorefrontDiscoveryResultDto[]): StorefrontDiscoveryResultDto[] {
    const haveDistance = results.length > 0 && results.every((r) => r.distanceKm !== null);
    return [...results].sort((a, b) =>
      haveDistance ? a.distanceKm! - b.distanceKm! : a.name.localeCompare(b.name, 'pl')
    );
  }

  private searchVertical(
    target: 'fitness' | 'academy',
    options: { search?: string; coordinates?: Coordinates | null }
  ): Observable<StorefrontDiscoveryResultDto[]> {
    const baseUri = this.configService.getConfig()?.apiConfig?.uri ?? '';

    let params = new HttpParams();
    for (const [key, value] of Object.entries(VERTICAL_QUERY[target])) {
      params = params.set(key, value);
    }
    if (options.search) params = params.set('search', options.search);
    if (options.coordinates) {
      params = params
        .set('lat', options.coordinates.latitude)
        .set('lng', options.coordinates.longitude);
    }

    return this.http.get<StorefrontDiscoveryResultDto[]>(`${baseUri}/api/storefronts/public`, { params });
  }

  // Best-effort — returns null on denial/timeout/unavailability (e.g. desktop browser without
  // location support, or a member who declines the permission prompt) so callers can silently fall
  // back to alphabetical sorting instead of blocking the whole discovery flow on GPS.
  async getCurrentPosition(): Promise<Coordinates | null> {
    try {
      const permission = await this.geolocation.checkPermissions();
      let status = permission.location;

      if (status === 'prompt' || status === 'prompt-with-rationale') {
        status = (await this.geolocation.requestPermissions()).location;
      }

      if (status !== 'granted') return null;

      const position = await this.geolocation.getCurrentPosition({ timeout: 10000 });
      return { latitude: position.coords.latitude, longitude: position.coords.longitude };
    } catch (error) {
      console.warn('Geolocation unavailable, falling back to alphabetical sort:', error);
      return null;
    }
  }
}
