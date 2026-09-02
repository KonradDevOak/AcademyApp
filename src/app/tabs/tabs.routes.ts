import { Routes } from '@angular/router';
import { CustomerGuard } from '@shared/iam-msal-external';
import { TabsPage } from './tabs.page';

// Mounted under path 'tabs' via app.routes.ts's `loadChildren` — paths here are relative to that
// prefix, so TabsPage itself takes the empty path (giving '/tabs/clubs', not '/tabs/tabs/clubs').
export const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    canActivate: [CustomerGuard],
    children: [
      {
        path: 'clubs',
        loadComponent: () =>
          import('../clubs/clubs.page').then((m) => m.ClubsPage),
      },
      {
        path: 'clubs/:storefrontId',
        loadComponent: () =>
          import('../club-detail/club-detail.page').then((m) => m.ClubDetailPage),
      },
      {
        path: 'clubs/:storefrontId/consents',
        loadComponent: () =>
          import('../consents/consents.page').then((m) => m.ConsentsPage),
      },
      {
        path: 'clubs/:storefrontId/health-questionnaire',
        loadComponent: () =>
          import('../health-questionnaire/health-questionnaire.page').then((m) => m.HealthQuestionnairePage),
      },
      {
        path: 'schedule',
        loadComponent: () =>
          import('../schedule/schedule.page').then((m) => m.SchedulePage),
      },
      {
        path: 'carnet',
        loadComponent: () =>
          import('../carnet/carnet.page').then((m) => m.CarnetPage),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('../tab1/tab1.page').then((m) => m.Tab1Page),
      },
      // Academy vertical (BusinessType=SportsSchool). The tab bar shows these instead of
      // schedule/carnet when the active club is a sports academy — see tabs.page. G1 ships placeholder
      // pages; G2 replaces their content. `clubs`/`profile` are shared with the fitness vertical.
      {
        path: 'academy-children',
        loadComponent: () =>
          import('../academy/children/academy-children.page').then((m) => m.AcademyChildrenPage),
      },
      {
        path: 'academy-children/onboarding',
        loadComponent: () =>
          import('../academy/onboarding/academy-onboarding.page').then((m) => m.AcademyOnboardingPage),
      },
      {
        path: 'academy-children/:athleteId',
        loadComponent: () =>
          import('../academy/child-detail/academy-child-detail.page').then((m) => m.AcademyChildDetailPage),
      },
      {
        path: '',
        redirectTo: 'clubs',
        pathMatch: 'full',
      },
    ],
  },
];
