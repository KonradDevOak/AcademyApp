import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExternalConfigService } from '@shared/iam-msal-external';
import { StorefrontPublicProfileDto } from '../models/storefront.model';

// Minimal plumbing for Sandbox's new anonymous GET /api/storefronts/{id}/public (see
// Sandbox/ai/BACKEND_CAPABILITIES.md §28) — resolves the same public-safe profile as
// StorefrontDiscoveryService's search(), but for one already-known storefrontId (from a member's
// Membership) rather than a domain/search query. No consuming screen yet — added ahead of the actual
// per-club background feature, which is a separate, unspecified follow-up.
@Injectable({ providedIn: 'root' })
export class StorefrontProfileService {
  private http = inject(HttpClient);
  private configService = inject(ExternalConfigService);

  getPublicProfile(storefrontId: string): Observable<StorefrontPublicProfileDto> {
    const baseUri = this.configService.getConfig()?.apiConfig?.uri ?? '';
    return this.http.get<StorefrontPublicProfileDto>(`${baseUri}/api/storefronts/${storefrontId}/public`);
  }
}
