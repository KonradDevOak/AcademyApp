import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { MsalExternalAuthService } from '@shared/iam-msal-external';

/**
 * Attaches the member's MemberBearer access token to requests aimed at the backend API.
 * Backend base URL comes from environment (not the loaded config) since this runs on every
 * request, including ones issued before config has finished loading.
 */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(MsalExternalAuthService);

  // MSAL's own token-endpoint calls (to Entra) bypass Angular's HttpClient entirely (msal-browser
  // uses its own fetch internally), so matching broadly here can't leak the Bearer token to them.
  if (!req.url.includes('/api/')) {
    return next(req);
  }

  return from(authService.getAccessToken()).pipe(
    switchMap((token$) => token$),
    switchMap((token) => {
      if (!token) {
        return next(req);
      }
      return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    })
  );
};
