import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonButton,
  IonText,
  IonSpinner,
  IonIcon,
  LoadingController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoMicrosoft } from 'ionicons/icons';
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
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardContent,
    IonButton,
    IonText,
    IonSpinner,
    IonIcon
  ]
})
export class LoginComponent implements OnInit {
  private msalAuthService = inject(MsalExternalAuthService);
  private membersApi = inject(MembersApiService);
  private router = inject(Router);
  private loadingController = inject(LoadingController);
  private toastController = inject(ToastController);

  isLoading = false;
  isLoginFailed = false;
  errorMessage = '';

  constructor() {
    addIcons({ logoMicrosoft });
  }

  ngOnInit() {
    if (this.msalAuthService.isLoggedIn()) {
      this.handleSuccessfulLogin();
    }
  }

  async onLoginWithMicrosoft() {
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
