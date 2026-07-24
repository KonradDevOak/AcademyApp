import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonSpinner,
  LoadingController,
  ToastController
} from '@ionic/angular/standalone';
import { tap, catchError, of, filter } from 'rxjs';
import { MsalExternalAuthService } from '@shared/iam-msal-external';
import { MembersApiService } from '../../core/services/members-api.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonSpinner
  ]
})
export class LoginComponent implements OnInit, OnDestroy {
  private msalAuthService = inject(MsalExternalAuthService);
  private membersApi = inject(MembersApiService);
  private router = inject(Router);
  private loadingController = inject(LoadingController);
  private toastController = inject(ToastController);

  isLoading = false;
  isLoginFailed = false;
  errorMessage = '';

  displayText = '';
  showCursor = true;
  showLoginAction = false;

  // Length of the first (white) word for whichever phrase is currently being typed/deleted —
  // the rest of displayText renders as the second (grey) word. See getters below.
  private firstWordLength = 'Local'.length;

  private animationTimeout?: ReturnType<typeof setTimeout>;

  get displayTextFirstWord(): string {
    return this.displayText.slice(0, this.firstWordLength);
  }

  get displayTextSecondWord(): string {
    return this.displayText.slice(this.firstWordLength);
  }

  ngOnInit() {
    if (this.msalAuthService.isLoggedIn()) {
      this.handleSuccessfulLogin();
      return;
    }

    if (this.prefersReducedMotion()) {
      this.firstWordLength = 'Fitness'.length;
      this.displayText = 'Fitness Club';
      this.showCursor = false;
      this.showLoginAction = true;
      return;
    }

    this.runAnimation();
  }

  ngOnDestroy() {
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }
  }

  private prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private runAnimation() {
    const steps: Array<() => Promise<void>> = [
      () => this.wait(700),
      () => {
        this.firstWordLength = 'Local'.length;
        return this.typeText('LocalBiz');
      },
      () => this.wait(900),
      () => this.deleteText(),
      () => {
        this.firstWordLength = 'Fitness'.length;
        return this.typeText('Fitness Club');
      }
    ];

    steps
      .reduce((chain, step) => chain.then(step), Promise.resolve())
      .then(() => {
        this.showCursor = false;
        this.showLoginAction = true;
      });
  }

  private typeText(text: string): Promise<void> {
    return new Promise((resolve) => {
      let i = this.displayText.length;
      const typeChar = () => {
        if (i >= text.length) {
          resolve();
          return;
        }
        this.displayText = text.slice(0, i + 1);
        i++;
        this.animationTimeout = setTimeout(typeChar, 90);
      };
      typeChar();
    });
  }

  private deleteText(): Promise<void> {
    return new Promise((resolve) => {
      const deleteChar = () => {
        if (this.displayText.length === 0) {
          resolve();
          return;
        }
        this.displayText = this.displayText.slice(0, -1);
        this.animationTimeout = setTimeout(deleteChar, 45);
      };
      deleteChar();
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.animationTimeout = setTimeout(resolve, ms);
    });
  }

  async onLogin() {
    this.isLoading = true;
    this.isLoginFailed = false;
    this.errorMessage = '';

    const loading = await this.loadingController.create({
      message: 'Otwieranie logowania…',
      spinner: 'circular'
    });
    await loading.present();

    this.msalAuthService.login().pipe(
      tap((success: boolean) => {
        if (!success) {
          this.isLoginFailed = true;
          this.errorMessage = 'Logowanie nie powiodło się. Spróbuj ponownie.';
        }
      }),
      filter((success: boolean) => success),
      tap(() => this.handleSuccessfulLogin()),
      catchError((error) => {
        console.error('Login error:', error);
        this.isLoginFailed = true;
        this.errorMessage = 'Błąd podczas logowania. Spróbuj ponownie.';
        this.isLoading = false;
        return of(false);
      })
    ).subscribe({
      complete: async () => {
        await loading.dismiss();
        this.isLoading = false;

        if (this.isLoginFailed) {
          await this.showToast(this.errorMessage, 'danger');
        }
      }
    });
  }

  private handleSuccessfulLogin() {
    this.membersApi.getMe().subscribe({
      // A brand new member (never called complete-profile before) has no Member row yet —
      // GET me returns 200 with a null body in that case, not an error (GetMeHandler.cs).
      next: (member) => {
        if (!member || !member.profileCompletedAt) {
          this.router.navigate(['/complete-profile']);
        } else {
          this.router.navigate(['/tabs']);
        }
      },
      error: (error: unknown) => {
        console.error('GET members/me failed after login:', error);
        this.router.navigate(['/complete-profile']);
      }
    });
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
