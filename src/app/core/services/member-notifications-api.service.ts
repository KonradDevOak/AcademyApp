import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExternalConfigService } from '@shared/iam-msal-external';
import { MemberNotificationInbox } from '../models/member-notification';

// Same api-URL convention as this app's own NotificationsApiService (config-service-resolved
// apiConfig.uri, not a fixed environment.apiBaseUrl like AcademyWeb uses) — see that service's own
// comment for why: GET /api/member-configuration's redirectUri/apiConfig.uri is set per-consumer at any
// given time, so every request here has to go through the live config rather than a build-time constant.
@Injectable({ providedIn: 'root' })
export class MemberNotificationsApiService {
  private http = inject(HttpClient);
  private configService = inject(ExternalConfigService);

  private get base(): string {
    const baseUri = this.configService.getConfig()?.apiConfig?.uri ?? '';
    return `${baseUri}/api/notifications/member/inbox`;
  }

  browse(page: number, pageSize: number): Observable<MemberNotificationInbox> {
    return this.http.get<MemberNotificationInbox>(this.base, { params: { page, pageSize } });
  }

  markRead(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/read`, {});
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.base}/read-all`, {});
  }
}
