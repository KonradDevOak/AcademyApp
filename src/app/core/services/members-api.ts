import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  HealthQuestionnaireSubmissionDto,
  MemberDto,
  MembershipDto,
  PendingMemberConsentDto
} from '../models/member';

// Thin client for the Members module (api/members/*). Deliberately local to this app, not part of
// the @konraddevoak/academy-api package: Members is a cross-vertical platform surface (the classes & passes
// section uses it too), while that package is scoped to api/academy/*. Mirrors the native app's MembersApiService.
@Injectable({ providedIn: 'root' })
export class MembersApiService {
  private readonly http = inject(HttpClient);

  // Base URL comes from this app's own environment.apiBaseUrl ('' same-origin in dev, absolute in
  // prod), never from the GET api/member-configuration response's apiConfig.uri: that field is the
  // same shared, backend-supplied value also served to the native AcademyApp's dev preview (an
  // absolute, cross-origin URL there), so trusting it here made every request cross-origin and
  // CORS-blocked. Same fix pattern as iam-msal-external's redirectUri handling.
  private apiUrl(path: string): string {
    return `${environment.apiBaseUrl}/api/members/${path}`;
  }

  getMyMemberships(): Observable<MembershipDto[]> {
    return this.http.get<MembershipDto[]>(this.apiUrl('me/memberships'));
  }

  // profileCompletedAt === null drives the invite flow's "needs-profile" step. The
  // backend returns 200 with a `null` body (not 404) when no Member row exists yet — the type
  // reflects that so callers can't accidentally dereference a null MemberDto.
  //
  // With a storefrontId the backend overlays the club's CRM card (name/phone) onto the result — the card is the
  // source of truth for those fields and the member cannot edit them.
  getMe(storefrontId?: string): Observable<MemberDto | null> {
    return this.http.get<MemberDto | null>(this.apiUrl('me'), {
      params: storefrontId ? { storefrontId } : {}
    });
  }

  // Idempotent on the backend — first call is effectively signup, later calls just rename. Backend
  // has one displayName field, not separate first/last name.
  completeProfile(displayName: string): Observable<void> {
    return this.http.post<void>(this.apiUrl('complete-profile'), { displayName });
  }

  // Fetch before join() so the invite flow can show what needs accepting up front, rather than
  // parsing the documentType out of a join() 400's free-text message.
  getPendingConsents(storefrontId: string): Observable<PendingMemberConsentDto[]> {
    return this.http.get<PendingMemberConsentDto[]>(this.apiUrl(`${storefrontId}/consents/pending`));
  }

  acceptConsent(storefrontId: string, documentType: string, documentVersionId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl(`${storefrontId}/consents/accept`), {
      documentType,
      documentVersionId
    });
  }

  // Throws member_consent_required (400) if a required document's current version hasn't been
  // accepted yet — the invite flow calls getPendingConsents()/acceptConsent() first specifically to
  // avoid hitting that as the normal path.
  join(storefrontId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl(`${storefrontId}/join`), null);
  }

  // Ends the membership (Members cascades to Academy/Classes/Carnets — carnet cancelled, seats released).
  leave(storefrontId: string): Observable<void> {
    return this.http.delete<void>(this.apiUrl(`${storefrontId}/leave`));
  }

  // Latest own submission for the club, or null when none was submitted yet.
  getHealthQuestionnaire(storefrontId: string): Observable<HealthQuestionnaireSubmissionDto | null> {
    return this.http.get<HealthQuestionnaireSubmissionDto | null>(this.apiUrl(`${storefrontId}/health-questionnaire`));
  }

  // Append-only — every submit creates a new version. healthDataConsentAccepted must be true whenever the club
  // has published a HealthDataProcessing document (400 health_data_consent_required otherwise); sending true
  // when it hasn't is harmless (nothing is recorded).
  submitHealthQuestionnaire(
    storefrontId: string,
    answersJson: string,
    healthDataConsentAccepted: boolean
  ): Observable<string> {
    return this.http.post<string>(this.apiUrl(`${storefrontId}/health-questionnaire`), {
      answersJson,
      healthDataConsentAccepted
    });
  }
}
