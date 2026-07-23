import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExternalConfigService } from '@shared/iam-msal-external';
import {
  CarnetCheckoutResultDto,
  CarnetDto,
  MembershipTypeDto,
  SignUpForCarnetRequest
} from '../models/carnets.model';

@Injectable({ providedIn: 'root' })
export class CarnetsApiService {
  private http = inject(HttpClient);
  private configService = inject(ExternalConfigService);

  private apiUrl(path: string): string {
    const baseUri = this.configService.getConfig()?.apiConfig?.uri ?? '';
    return `${baseUri}/api/carnets/${path}`;
  }

  // null when the member has no carnet for this storefront yet — treat any error response the same
  // way at the call site (backend has no dedicated "not found" contract documented for this route).
  getMyCarnet(storefrontId: string): Observable<CarnetDto> {
    const params = new HttpParams().set('storefrontId', storefrontId);
    return this.http.get<CarnetDto>(this.apiUrl('me/carnet'), { params });
  }

  signUp(request: SignUpForCarnetRequest): Observable<CarnetCheckoutResultDto> {
    return this.http.post<CarnetCheckoutResultDto>(this.apiUrl('me/carnets'), request);
  }

  setAutoRenewal(storefrontId: string, enabled: boolean): Observable<void> {
    return this.http.patch<void>(this.apiUrl('me/carnet/auto-renewal'), { storefrontId, enabled });
  }

  requestCancellation(storefrontId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl('me/carnet/request-cancellation'), { storefrontId });
  }

  withdrawCancellation(storefrontId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl('me/carnet/withdraw-cancellation'), { storefrontId });
  }

  acceptPriceChange(storefrontId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl('me/carnet/accept-price-change'), { storefrontId });
  }

  retryPayment(storefrontId: string): Observable<CarnetCheckoutResultDto> {
    return this.http.post<CarnetCheckoutResultDto>(this.apiUrl('me/carnet/retry-payment'), { storefrontId });
  }

  getMembershipTypes(storefrontId: string): Observable<MembershipTypeDto[]> {
    return this.http.get<MembershipTypeDto[]>(this.apiUrl(`${storefrontId}/membership-types`));
  }
}
