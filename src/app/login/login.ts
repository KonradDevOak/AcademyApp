import { Component, DestroyRef, NgZone, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { MsalExternalAuthService } from '@shared/iam-msal-external';
import { CAPACITOR_BROWSER } from '../shared/payments/payment-redirect';

@Component({
  selector: 'app-login',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(MsalExternalAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browser = inject(CAPACITOR_BROWSER);
  private readonly zone = inject(NgZone);

  /** True while we are handing off to Entra or finishing the sign-in after returning from it. */
  readonly signingIn = signal(false);

  ngOnInit(): void {
    this.watchBrowserClose();

    // Already signed in (cached account restored at startup): forward straight to the requested route
    // so the user never sees the login screen again once authenticated.
    if (this.authService.isLoggedIn()) {
      this.signingIn.set(true);
      void this.goToReturnUrl();
      return;
    }

    // The sign-in completes in the system browser; the vendored MSAL fork finishes it when CIAM
    // redirects back to the app (appUrlOpen) and flips isLoggedIn$.
    this.authService.isLoggedIn$
      .pipe(
        filter((loggedIn) => loggedIn),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.signingIn.set(true);
        void this.goToReturnUrl();
      });
  }

  login(): void {
    this.signingIn.set(true);
    this.authService.loginRedirect().catch(() => this.signingIn.set(false));
  }

  // The member closed the CIAM tab without signing in — bring the login button back. The listener
  // fires on every Custom Tab close, including the one after a successful sign-in, hence the check.
  private watchBrowserClose(): void {
    const listener = this.browser.addListener('browserFinished', () =>
      this.zone.run(() => {
        if (!this.authService.isLoggedIn()) {
          this.signingIn.set(false);
        }
      })
    );
    this.destroyRef.onDestroy(() => void listener.then((handle) => handle.remove()));
  }

  private goToReturnUrl(): Promise<boolean> {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
    return this.router.navigateByUrl(returnUrl);
  }
}
