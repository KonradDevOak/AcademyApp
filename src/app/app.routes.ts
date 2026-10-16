import { Routes } from '@angular/router';
import { CustomerGuard } from '@shared/iam-msal-external';
import {
  activeStorefrontChildGuard,
  activeStorefrontGuard,
  homeRedirectGuard,
  requireSection
} from './core/guards/active-storefront-guard';

export const routes: Routes = [
  {
    // Screens outside the authenticated shell. Componentless matching falls through to the shell below
    // for every other path.
    path: '',
    loadComponent: () => import('./shell/public-layout/public-layout').then((m) => m.PublicLayoutComponent),
    children: [
      {
        path: 'login',
        loadComponent: () => import('./login/login').then((m) => m.LoginComponent)
      },
      {
        // Public entry point — mirrors /login, stays outside CustomerGuard because it IS
        // the entry into login, not a screen behind it. Reached through DeepLinkService from the
        // invitation e-mail link or the backend's api/academy/invite hand-off page.
        path: 'invite',
        loadComponent: () => import('./invite/invite').then((m) => m.InviteComponent)
      },
      // Legal pages are public: payment operators and visitors must read them without an account, and a
      // club's default consent version links straight to /klub/:storefrontId/*.
      {
        path: 'regulamin',
        data: { document: 'platformTerms' },
        loadComponent: () => import('./legal/platform-legal-page').then((m) => m.PlatformLegalPageComponent)
      },
      {
        path: 'polityka-prywatnosci',
        data: { document: 'platformPrivacy' },
        loadComponent: () => import('./legal/platform-legal-page').then((m) => m.PlatformLegalPageComponent)
      },
      {
        path: 'klub/:storefrontId/regulamin',
        data: { documentType: 'StudioTerms' },
        loadComponent: () => import('./legal/club-legal-page').then((m) => m.ClubLegalPageComponent)
      },
      {
        path: 'klub/:storefrontId/polityka-prywatnosci',
        data: { documentType: 'StudioRodo' },
        loadComponent: () => import('./legal/club-legal-page').then((m) => m.ClubLegalPageComponent)
      }
    ]
  },
  {
    path: '',
    canActivate: [CustomerGuard],
    loadComponent: () => import('./shell/app-shell').then((m) => m.AppShellComponent),
    children: [
      {
        // Never renders — homeRedirectGuard always redirects (many academies -> /clubs, one -> its first
        // section, none -> /find-club). The component is only there because a route needs something to load.
        path: '',
        pathMatch: 'full',
        canActivate: [homeRedirectGuard],
        loadComponent: () => import('./clubs/clubs').then((m) => m.ClubsComponent)
      },
      {
        path: 'academy',
        canActivateChild: [activeStorefrontChildGuard, requireSection('academy')],
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./academy/academy-home').then((m) => m.AcademyHomeComponent)
          },
          {
            path: 'add',
            loadComponent: () =>
              import('./academy/children/academy-add-child').then((m) => m.AcademyAddChildComponent)
          },
          {
            path: 'children/:athleteId/edit',
            loadComponent: () =>
              import('./academy/children/academy-add-child').then((m) => m.AcademyAddChildComponent)
          },
          {
            path: 'children/:athleteId/enroll',
            loadComponent: () =>
              import('./academy/children/academy-enroll-athlete').then(
                (m) => m.AcademyEnrollAthleteComponent
              )
          },
          {
            // Static `add`, `children/:athleteId/edit` and `children/:athleteId/enroll` are matched
            // before this, so the bare param segment is safe last.
            path: 'children/:athleteId',
            loadComponent: () =>
              import('./academy/children/academy-child-detail').then(
                (m) => m.AcademyChildDetailComponent
              )
          },
          {
            // Landing route after the gateway checkout in the system browser — DeepLinkService routes the
            // backend's payment-callback return (or a closed checkout tab) here.
            path: 'payment-callback',
            loadComponent: () =>
              import('./academy/payments/academy-payment-callback').then(
                (m) => m.AcademyPaymentCallbackComponent
              )
          }
        ]
      },
      {
        // "Zajęcia i karnety" — class schedule and passes. The screens still live under fitness/.
        path: 'classes',
        canActivateChild: [activeStorefrontChildGuard, requireSection('classes')],
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./fitness/fitness-home').then((m) => m.FitnessHomeComponent)
          },
          {
            // Landing route after the carnet checkout in the system browser — see DeepLinkService.
            path: 'payment-callback',
            loadComponent: () =>
              import('./fitness/payments/fitness-payment-callback').then((m) => m.FitnessPaymentCallbackComponent)
          }
        ]
      },
      {
        path: 'clubs',
        loadComponent: () => import('./clubs/clubs').then((m) => m.ClubsComponent)
      },
      {
        path: 'clubs/:storefrontId',
        loadComponent: () => import('./club-detail/club-detail').then((m) => m.ClubDetailComponent)
      },
      {
        path: 'clubs/:storefrontId/health',
        loadComponent: () =>
          import('./health-questionnaire/health-questionnaire').then((m) => m.HealthQuestionnaireComponent)
      },
      {
        path: 'find-club',
        loadComponent: () => import('./find-club/find-club').then((m) => m.FindClubComponent)
      },
      {
        path: 'profile',
        canActivate: [activeStorefrontGuard],
        loadComponent: () => import('./profile/profile').then((m) => m.ProfileComponent)
      },
      // Former club picker / no-club / fitness screens, kept as redirects for bookmarks and in-flight returnUrls.
      { path: 'select-club', redirectTo: 'clubs' },
      { path: 'fitness', pathMatch: 'full', redirectTo: 'classes' },
      { path: 'fitness/payment-callback', redirectTo: 'classes/payment-callback' },
      { path: 'no-club', redirectTo: 'find-club' },
      // Former native tab routes and the old invitation screen — still reachable from push notifications
      // and links sent before this layout.
      { path: 'tabs', pathMatch: 'full', redirectTo: '' },
      { path: 'tabs/clubs', redirectTo: 'clubs' },
      { path: 'tabs/clubs/:storefrontId', redirectTo: 'clubs/:storefrontId' },
      { path: 'tabs/profile', redirectTo: 'profile' },
      { path: 'tabs/academy-children', redirectTo: 'academy' },
      { path: 'tabs/schedule', redirectTo: 'classes' },
      { path: 'tabs/carnet', redirectTo: 'classes' }
    ]
  },
  { path: '**', redirectTo: '' }
];
