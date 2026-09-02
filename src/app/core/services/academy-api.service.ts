import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExternalConfigService } from '@shared/iam-msal-external';
import {
  AcademyBillingPlanDto,
  AcademyFeeChargeCheckoutResultDto,
  AcademyGuardianDto,
  AcceptInvitationRequest,
  AthleteDetailsDto,
  AthleteDto,
  AthleteGradeDto,
  FeeChargeDto,
  MonthlyAttendanceDto,
  RegisterAthleteRequest,
  UpdateGuardianRequest
} from '../models/academy.model';

// Parent-facing calls to Sandbox's Modules.Academy (`api/academy/me/*`, MemberBearer). Same pattern as
// CarnetsApiService. Every `me/*` route needs storefrontId as a query param (a Guardian row is
// per-storefront); the acting guardian is resolved backend-side from the token, never sent.
@Injectable({ providedIn: 'root' })
export class AcademyApiService {
  private http = inject(HttpClient);
  private configService = inject(ExternalConfigService);

  private apiUrl(path: string): string {
    const baseUri = this.configService.getConfig()?.apiConfig?.uri ?? '';
    return `${baseUri}/api/academy/${path}`;
  }

  private storefrontParams(storefrontId: string): HttpParams {
    return new HttpParams().set('storefrontId', storefrontId);
  }

  getMyGuardian(storefrontId: string): Observable<AcademyGuardianDto> {
    return this.http.get<AcademyGuardianDto>(this.apiUrl('me/guardian'), {
      params: this.storefrontParams(storefrontId)
    });
  }

  updateGuardian(request: UpdateGuardianRequest): Observable<void> {
    return this.http.patch<void>(this.apiUrl('me/guardian'), request);
  }

  getMyAthletes(storefrontId: string): Observable<AthleteDto[]> {
    return this.http.get<AthleteDto[]>(this.apiUrl('me/athletes'), {
      params: this.storefrontParams(storefrontId)
    });
  }

  // Returns the new athlete's id.
  registerAthlete(request: RegisterAthleteRequest): Observable<string> {
    return this.http.post<string>(this.apiUrl('me/athletes'), request);
  }

  getAthlete(storefrontId: string, athleteId: string): Observable<AthleteDetailsDto> {
    return this.http.get<AthleteDetailsDto>(this.apiUrl(`me/athletes/${athleteId}`), {
      params: this.storefrontParams(storefrontId)
    });
  }

  getAthleteAttendance(storefrontId: string, athleteId: string): Observable<MonthlyAttendanceDto[]> {
    return this.http.get<MonthlyAttendanceDto[]>(this.apiUrl(`me/athletes/${athleteId}/attendance`), {
      params: this.storefrontParams(storefrontId)
    });
  }

  getAthleteGrades(storefrontId: string, athleteId: string): Observable<AthleteGradeDto[]> {
    return this.http.get<AthleteGradeDto[]>(this.apiUrl(`me/athletes/${athleteId}/grades`), {
      params: this.storefrontParams(storefrontId)
    });
  }

  // One FeeChargeDto per month (desc by period), each with its PaymentRecord[] and a server-computed
  // Paid/Due status. Guardian-scoped on the backend — no AcademyPayments gate for the parent.
  getAthletePayments(storefrontId: string, athleteId: string): Observable<FeeChargeDto[]> {
    return this.http.get<FeeChargeDto[]>(this.apiUrl(`me/athletes/${athleteId}/payments`), {
      params: this.storefrontParams(storefrontId)
    });
  }

  // Starts a one-time P24 payment for one month's fee. Returns the hosted-checkout URL to open in the
  // browser; the PaymentRecord is created by the backend's async IPN, so re-fetch after the return.
  payFeeCharge(
    storefrontId: string,
    athleteId: string,
    period: string
  ): Observable<AcademyFeeChargeCheckoutResultDto> {
    return this.http.post<AcademyFeeChargeCheckoutResultDto>(
      this.apiUrl(`me/athletes/${athleteId}/fee-charges/${period}/pay`),
      null,
      { params: this.storefrontParams(storefrontId) }
    );
  }

  // POST api/academy/invitations/accept (not under me/*). Consumed by the invite deep-link flow (G3).
  acceptInvitation(request: AcceptInvitationRequest): Observable<void> {
    return this.http.post<void>(this.apiUrl('invitations/accept'), request);
  }

  // Recurring monthly billing (Phase H3). `null` from the backend means no plan exists yet — not a 404.
  getBillingPlan(storefrontId: string, athleteId: string): Observable<AcademyBillingPlanDto | null> {
    return this.http.get<AcademyBillingPlanDto | null>(this.apiUrl(`me/athletes/${athleteId}/billing-plan`), {
      params: this.storefrontParams(storefrontId)
    });
  }

  // Enrolls (or re-enrolls after PaymentFailed) with a fresh P24 card-token registration. Returns the
  // hosted-checkout URL, same open-then-wait-for-deep-link flow as payFeeCharge()/carnet.page.ts signUp().
  enableBillingPlan(storefrontId: string, athleteId: string): Observable<AcademyFeeChargeCheckoutResultDto> {
    return this.http.post<AcademyFeeChargeCheckoutResultDto>(
      this.apiUrl(`me/athletes/${athleteId}/billing-plan`),
      null,
      { params: this.storefrontParams(storefrontId) }
    );
  }

  setBillingPlanAutoRenewal(storefrontId: string, athleteId: string, enabled: boolean): Observable<void> {
    return this.http.patch<void>(
      this.apiUrl(`me/athletes/${athleteId}/billing-plan`),
      { enabled },
      { params: this.storefrontParams(storefrontId) }
    );
  }

  // Resets dunning after PaymentFailed — does not charge synchronously, the next AcademyBillingJob tick
  // retries the stored card token.
  retryBillingPlanCharge(storefrontId: string, athleteId: string): Observable<void> {
    return this.http.post<void>(
      this.apiUrl(`me/athletes/${athleteId}/billing-plan/retry`),
      null,
      { params: this.storefrontParams(storefrontId) }
    );
  }
}
