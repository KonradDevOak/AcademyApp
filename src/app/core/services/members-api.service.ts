import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExternalConfigService } from '@shared/iam-msal-external';
import { MemberDto, MembershipDto } from '../models/member.model';

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
}
