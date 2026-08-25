import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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

  // Resolves the same public-safe profile by a storefront's own linked domain instead of its id —
  // e.g. a domain scanned from the QR code the owner already generates in LocalBizWeb's "Kod QR"
  // section, which encodes nothing but https://{their-domain}. Same anonymous endpoint
  // (ResolveStorefrontHandler) Showcase already uses to resolve a tenant by Host header.
  resolveByDomain(domain: string): Observable<StorefrontPublicProfileDto> {
    const baseUri = this.configService.getConfig()?.apiConfig?.uri ?? '';
    return this.http.get<StorefrontPublicProfileDto>(`${baseUri}/api/storefronts/resolve`, {
      params: new HttpParams().set('domain', domain)
    });
  }
}
