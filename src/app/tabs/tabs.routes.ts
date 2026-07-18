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
