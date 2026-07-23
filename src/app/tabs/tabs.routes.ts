import { Routes } from '@angular/router';
import { CustomerGuard } from '@shared/iam-msal-external';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: 'tabs',
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
      }
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/clubs',
    pathMatch: 'full',
  },
];
