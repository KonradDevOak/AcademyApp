import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { MsalExternalAuthService } from '../services/msal-external-auth.service';

/**
 * Guard sprawdzający czy użytkownik jest zalogowany (Entra External ID)
 */
@Injectable({ providedIn: 'root' })
export class CustomerGuard implements CanActivate {
  constructor(
    private externalAuthService: MsalExternalAuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    const isLoggedIn = this.externalAuthService.isLoggedIn();

    if (isLoggedIn) {
      return true;
    }

    console.warn('Access denied: Authentication required');
    this.router.navigate(['/login'], { 
      queryParams: { returnUrl: state.url } 
    });
    return false;
  }
}
