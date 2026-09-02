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
    path: 'find-club',
    canActivate: [CustomerGuard],
    loadComponent: () => import('./find-club/find-club.page').then(m => m.FindClubPage)
  },
  {
    // Parent-invitation deep link target (DeepLinkService routes here). Deliberately NOT behind
    // CustomerGuard — the parent is usually logged out when they tap the link; the page drives the
    // CIAM login itself as its first step.
    path: 'academy-invite',
    loadComponent: () => import('./academy/invite/academy-invite.page').then(m => m.AcademyInvitePage)
  },
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
];
