import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { AppInitService, MsalExternalAuthService } from '@shared/iam-msal-external';
import { ACADEMY_API_BASE_URL } from '@konraddevoak/academy-api';
import { FITNESS_API_BASE_URL } from '@konraddevoak/fitness-api';
import { authTokenInterceptor } from './app/interceptors/auth-token.interceptor';
import { ThemeService } from './app/shared/services/theme.service';
import { environment } from './environments/environment';

// Call the element loader before the bootstrapModule/bootstrapApplication call
defineCustomElements(window);

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Ionic supplies the overlays/menu/accordion; routing itself is plain Angular (no ion-router-outlet)
    // so the screens ported from AcademyWeb keep its document-style scrolling and history.
    provideIonicAngular({ mode: 'md' }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authTokenInterceptor])),
    // Same base URL for every backend call, as in AcademyWeb.
    { provide: ACADEMY_API_BASE_URL, useValue: environment.apiBaseUrl },
    { provide: FITNESS_API_BASE_URL, useValue: environment.apiBaseUrl },
    // Runtime i18n (ngx-translate) — same setup and same pl.json as AcademyWeb. The http loader reads
    // the bundled asset (assets/i18n/<lang>.json in www/), so it works offline; the auth interceptor
    // skips it (URL has no '/api/').
    provideTranslateService({
      lang: 'pl',
      fallbackLang: 'pl',
      loader: provideTranslateHttpLoader({ prefix: 'assets/i18n/', suffix: '.json' }),
    }),
    // Config first, then MSAL: CustomerGuard reads isLoggedIn() synchronously on the first
    // navigation, so the cached account must already be restored by then.
    provideAppInitializer(async () => {
      const appInitService = inject(AppInitService);
      const authService = inject(MsalExternalAuthService);
      await appInitService.init()();
      await authService.initialize();
    }),
    provideAppInitializer(() => inject(ThemeService).init()),
  ],
});
