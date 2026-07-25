import { Injectable, InjectionToken, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Geolocation } from '@capacitor/geolocation';
import { ExternalConfigService } from '@shared/iam-msal-external';
import { StorefrontDiscoveryResultDto } from '../models/storefront.model';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Capacitor plugin objects (like `Geolocation`) are a Proxy whose `get` trap always returns a fresh
// wrapper function regardless of any property assignment — `spyOn(Geolocation, 'checkPermissions')`
// silently has no effect on the real call site, because jasmine's re-assignment never survives the next
// property read through that trap. Routing the plugin through an injection token (same singleton at
// runtime, via the factory below) is what actually makes it swappable in tests.
export const GEOLOCATION_PLUGIN = new InjectionToken<typeof Geolocation>('GEOLOCATION_PLUGIN', {
  providedIn: 'root',
  factory: () => Geolocation
});

// Clubhouse is the Fitness-vertical app — every discovery request is scoped to storefronts that both
// declare BusinessType=Fitness AND have every Services label a member needs already enabled (grafik +
// karnety + lista klubowiczów). See Sandbox's BrowsePublicStorefrontsHandler for the actual filtering.
const FITNESS_BUSINESS_TYPE = 'Fitness';

@Injectable({ providedIn: 'root' })
export class StorefrontDiscoveryService {
  private http = inject(HttpClient);
  private configService = inject(ExternalConfigService);
  private geolocation = inject(GEOLOCATION_PLUGIN);

  search(options: { search?: string; coordinates?: Coordinates | null }): Observable<StorefrontDiscoveryResultDto[]> {
    const baseUri = this.configService.getConfig()?.apiConfig?.uri ?? '';

    let params = new HttpParams()
      .set('businessType', FITNESS_BUSINESS_TYPE)
      .set('requireFitnessReadiness', 'true');
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
