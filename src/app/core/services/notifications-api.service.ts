import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExternalConfigService } from '@shared/iam-msal-external';

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private http = inject(HttpClient);
  private configService = inject(ExternalConfigService);

  private apiUrl(path: string): string {
    const baseUri = this.configService.getConfig()?.apiConfig?.uri ?? '';
    return `${baseUri}/api/notifications/${path}`;
  }

  registerDeviceToken(platform: 'Android' | 'iOS', token: string): Observable<void> {
    return this.http.post<void>(this.apiUrl('native-push-subscriptions/member'), { platform, token });
  }

  unregisterDeviceToken(token: string): Observable<void> {
    const params = new HttpParams().set('token', token);
    return this.http.delete<void>(this.apiUrl('native-push-subscriptions/member'), { params });
  }
}
