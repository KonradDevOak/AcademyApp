import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private http = inject(HttpClient);

  private apiUrl(path: string): string {
    return `${environment.apiBaseUrl}/api/notifications/${path}`;
  }

  registerDeviceToken(platform: 'Android' | 'iOS', token: string): Observable<void> {
    return this.http.post<void>(this.apiUrl('native-push-subscriptions/member'), { platform, token });
  }

  unregisterDeviceToken(token: string): Observable<void> {
    const params = new HttpParams().set('token', token);
    return this.http.delete<void>(this.apiUrl('native-push-subscriptions/member'), { params });
  }
}
