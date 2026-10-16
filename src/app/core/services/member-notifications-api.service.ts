import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MemberNotificationInbox } from '../models/member-notification';

@Injectable({ providedIn: 'root' })
export class MemberNotificationsApiService {
  private http = inject(HttpClient);

  private get base(): string {
    return `${environment.apiBaseUrl}/api/notifications/member/inbox`;
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
