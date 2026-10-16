import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ClubConsentDocumentDto,
  ClubDiscoveryResultDto,
  ClubPublicProfileDto,
  PublicDisciplineDto
} from '../models/storefront';
import { ACADEMY_BUSINESS_TYPE } from '../models/business-type';

export interface ClubSearch {
  search?: string;
  latitude?: number;
  longitude?: number;
}

// Anonymous discovery calls behind the academy finder and the academy card. requireReadiness keeps only
// academies with at least one section's services fully switched on (i.e. actually joinable from this app).
@Injectable({ providedIn: 'root' })
export class ClubDiscoveryService {
  private readonly http = inject(HttpClient);

  search(query: ClubSearch): Observable<ClubDiscoveryResultDto[]> {
    let params = new HttpParams()
      .set('businessType', ACADEMY_BUSINESS_TYPE)
      .set('requireReadiness', 'true');
    const search = query.search?.trim();
    if (search) {
      params = params.set('search', search);
    }
    if (query.latitude !== undefined && query.longitude !== undefined) {
      params = params.set('lat', query.latitude).set('lng', query.longitude);
    }
    return this.http.get<ClubDiscoveryResultDto[]>(`${environment.apiBaseUrl}/api/storefronts/public`, { params });
  }

  getProfile(storefrontId: string): Observable<ClubPublicProfileDto> {
    return this.http.get<ClubPublicProfileDto>(`${environment.apiBaseUrl}/api/storefronts/${storefrontId}/public`);
  }

  // Resolves an academy by its own linked domain — what the QR code generated in LocalBizWeb encodes
  // (https://{their-domain}). Same anonymous endpoint Showcase uses to resolve a tenant by Host header.
  resolveByDomain(domain: string): Observable<ClubPublicProfileDto> {
    return this.http.get<ClubPublicProfileDto>(`${environment.apiBaseUrl}/api/storefronts/resolve`, {
      params: new HttpParams().set('domain', domain)
    });
  }

  getClubDocuments(storefrontId: string): Observable<ClubConsentDocumentDto[]> {
    return this.http.get<ClubConsentDocumentDto[]>(
      `${environment.apiBaseUrl}/api/consent-documents/public/${storefrontId}`
    );
  }

  getAcademyDisciplines(storefrontId: string): Observable<PublicDisciplineDto[]> {
    return this.http.get<PublicDisciplineDto[]>(
      `${environment.apiBaseUrl}/api/academy/public/${storefrontId}/disciplines`
    );
  }
}

