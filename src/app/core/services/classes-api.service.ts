import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExternalConfigService } from '@shared/iam-msal-external';
import { ClassTypeDto, MakeupCreditDto, MemberSessionDto, MyEnrollmentDto } from '../models/classes.model';

@Injectable({ providedIn: 'root' })
export class ClassesApiService {
  private http = inject(HttpClient);
  private configService = inject(ExternalConfigService);

  private apiUrl(path: string): string {
    const baseUri = this.configService.getConfig()?.apiConfig?.uri ?? '';
    return `${baseUri}/api/classes/${path}`;
  }

  getSessions(storefrontId: string, from?: string, to?: string): Observable<MemberSessionDto[]> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<MemberSessionDto[]>(this.apiUrl(`${storefrontId}/sessions`), { params });
  }

  enroll(sessionId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl(`sessions/${sessionId}/enroll`), {});
  }

  unenroll(sessionId: string): Observable<void> {
    return this.http.delete<void>(this.apiUrl(`sessions/${sessionId}/enroll`));
  }

  joinWaitlist(sessionId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl(`sessions/${sessionId}/waitlist`), {});
  }

  leaveWaitlist(sessionId: string): Observable<void> {
    return this.http.delete<void>(this.apiUrl(`sessions/${sessionId}/waitlist`));
  }

  reportAbsence(sessionId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl(`sessions/${sessionId}/report-absence`), {});
  }

  redeemMakeupCredit(creditId: string, sessionId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl(`makeup-credits/${creditId}/redeem`), { sessionId });
  }

  getMyEnrollments(storefrontId: string): Observable<MyEnrollmentDto[]> {
    const params = new HttpParams().set('storefrontId', storefrontId);
    return this.http.get<MyEnrollmentDto[]>(this.apiUrl('me/enrollments'), { params });
  }

  getMyMakeupCredits(storefrontId: string): Observable<MakeupCreditDto[]> {
    const params = new HttpParams().set('storefrontId', storefrontId);
    return this.http.get<MakeupCreditDto[]>(this.apiUrl('me/makeup-credits'), { params });
  }

  getClassTypes(storefrontId: string): Observable<ClassTypeDto[]> {
    return this.http.get<ClassTypeDto[]>(this.apiUrl(`${storefrontId}/class-types`));
  }
}
