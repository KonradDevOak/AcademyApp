import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExternalConfigService } from '@shared/iam-msal-external';
import {
  HealthQuestionnaireSubmissionDto,
  MemberDto,
  MembershipDto,
  PendingConsentDto
} from '../models/member.model';

@Injectable({ providedIn: 'root' })
export class MembersApiService {
  private http = inject(HttpClient);
  private configService = inject(ExternalConfigService);

  private apiUrl(path: string): string {
    const baseUri = this.configService.getConfig()?.apiConfig?.uri ?? '';
    return `${baseUri}/api/members/${path}`;
  }

  completeProfile(displayName: string): Observable<void> {
    return this.http.post<void>(this.apiUrl('complete-profile'), { displayName });
  }

  getMe(): Observable<MemberDto> {
    return this.http.get<MemberDto>(this.apiUrl('me'));
  }

  getMyMemberships(): Observable<MembershipDto[]> {
    return this.http.get<MembershipDto[]>(this.apiUrl('me/memberships'));
  }

  join(storefrontId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl(`${storefrontId}/join`), {});
  }

  leave(storefrontId: string): Observable<void> {
    return this.http.delete<void>(this.apiUrl(`${storefrontId}/leave`));
  }

  getPendingConsents(storefrontId: string): Observable<PendingConsentDto[]> {
    return this.http.get<PendingConsentDto[]>(this.apiUrl(`${storefrontId}/consents/pending`));
  }

  acceptConsent(storefrontId: string, documentType: string, documentVersionId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl(`${storefrontId}/consents/accept`), {
      documentType,
      documentVersionId
    });
  }

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

  // null when the member has never submitted the questionnaire for this storefront — not a 404,
  // the backend returns 200 with a null body (see GetMyHealthQuestionnaireHandler).
  getHealthQuestionnaire(storefrontId: string): Observable<HealthQuestionnaireSubmissionDto | null> {
    return this.http.get<HealthQuestionnaireSubmissionDto | null>(
      this.apiUrl(`${storefrontId}/health-questionnaire`)
    );
  }
}
