import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { inject, provideAppInitializer } from '@angular/core';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { AppInitService, ExternalConfigService } from '@shared/iam-msal-external';
import { ACADEMY_API_BASE_URL } from '@konraddevoak/academy-api';
import { authTokenInterceptor } from './app/interceptors/auth-token.interceptor';
import { ThemeService } from './app/core/services/theme.service';

// Call the element loader before the bootstrapModule/bootstrapApplication call
defineCustomElements(window);

bootstrapApplication(AppComponent, {
  providers: [
    {
      provide: RouteReuseStrategy,
      useClass: IonicRouteStrategy
    },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authTokenInterceptor])),
    {
      // @konraddevoak/academy-api resolves its base URL from this token — same source the app uses
      // for every other backend call. Empty in same-origin dev/prod (relative /api/academy/...).
      provide: ACADEMY_API_BASE_URL,
      useFactory: (config: ExternalConfigService) => config.getConfig()?.apiConfig?.uri ?? '',
      deps: [ExternalConfigService],
    },
    // Runtime i18n (ngx-translate) — same setup as LocalBizWeb. Polish is the only shipped language;
    // there is no in-app language switcher. `en.json` exists as a parallel file for future use. The
    // http loader reads the bundled asset (assets/i18n/<lang>.json in www/), so it works offline; the
    // auth interceptor skips it (URL has no '/api/').
    provideTranslateService({
      lang: 'pl',
      fallbackLang: 'pl',
      loader: provideTranslateHttpLoader({ prefix: 'assets/i18n/', suffix: '.json' }),
    }),
    provideAppInitializer(() => {
      const appInitService = inject(AppInitService);
      return appInitService.init()();
    }),
    provideAppInitializer(() => {
      const themeService = inject(ThemeService);
      return themeService.init();
    }),
  ],
});
