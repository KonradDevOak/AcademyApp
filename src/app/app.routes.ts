import { Routes } from '@angular/router';
import { CustomerGuard } from '@shared/iam-msal-external';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'complete-profile',
    canActivate: [CustomerGuard],
    loadComponent: () =>
      import('./complete-profile/complete-profile.component').then(m => m.CompleteProfileComponent)
  },
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
];
