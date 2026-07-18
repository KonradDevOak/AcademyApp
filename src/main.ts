import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { inject, provideAppInitializer } from '@angular/core';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

import { AppInitService } from '@shared/iam-msal-external';
import { authTokenInterceptor } from './app/interceptors/auth-token.interceptor';

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
    provideAppInitializer(() => {
      const appInitService = inject(AppInitService);
      return appInitService.init()();
    }),
  ],
});
