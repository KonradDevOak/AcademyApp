import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PayNowPaymentConfirmationDto {
  guardianChargeId: string;
  // 'Paid' (recorded, by this call or earlier by the webhook), 'Failed' (PayNow reports a terminal
  // failure) or 'Pending' (no final status yet — ask again).
  status: 'Paid' | 'Failed' | 'Pending';
}

// PayNow return-page confirmation (POST api/academy/me/payments/paynow/confirm). Deliberately local to
// this app rather than in @konraddevoak/academy-api: that package is consumed here as a published
// prerelease, and this call is needed as soon as the backend endpoint exists. Same rationale as
// MembersApiService. Base URL from this app's own environment.apiBaseUrl, never the backend-supplied one.
@Injectable({ providedIn: 'root' })
export class AcademyPayNowApiService {
  private readonly http = inject(HttpClient);

  // paymentId is the value PayNow appended to the return URL. It is only a lookup key: the backend finds
  // the payment this guardian started, asks PayNow for its real status and records it — the redirect's own
  // paymentStatus is untrusted browser input and is never sent.
  confirmPayment(paymentId: string): Observable<PayNowPaymentConfirmationDto> {
    return this.http.post<PayNowPaymentConfirmationDto>(
      `${environment.apiBaseUrl}/api/academy/me/payments/paynow/confirm`,
      null,
      { params: new HttpParams().set('paymentId', paymentId) }
    );
  }
}
