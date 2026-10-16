import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// Child photo upload/removal (PUT/DELETE api/academy/me/athletes/{id}/photo). Local to this app rather than in
// @konraddevoak/academy-api: uploads are multipart and only this portal needs them. Same rationale (and base-URL
// rule — this app's own environment.apiBaseUrl) as AcademyPayNowApiService.
@Injectable({ providedIn: 'root' })
export class AcademyAthletePhotoApiService {
  private readonly http = inject(HttpClient);

  upload(storefrontId: string, athleteId: string, photo: Blob): Observable<void> {
    const form = new FormData();
    // The server checks the real bytes against the declared type, so the part carries the blob's own type.
    form.append('file', photo, 'photo.jpg');
    return this.http.put<void>(`${environment.apiBaseUrl}/api/academy/me/athletes/${athleteId}/photo`, form, {
      params: new HttpParams().set('storefrontId', storefrontId)
    });
  }

  remove(storefrontId: string, athleteId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/api/academy/me/athletes/${athleteId}/photo`, {
      params: new HttpParams().set('storefrontId', storefrontId)
    });
  }
}
