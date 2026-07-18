import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonIcon,
  IonAvatar,
  IonList,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personOutline, logOutOutline } from 'ionicons/icons';
import { MsalExternalAuthService } from '@shared/iam-msal-external';
import { UserProfile } from '@shared/iam-msal-core';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardContent,
    IonItem,
    IonLabel,
    IonIcon,
    IonAvatar,
    IonList
  ],
})
export class Tab1Page implements OnInit {
  private msalAuthService = inject(MsalExternalAuthService);
  private router = inject(Router);
  private alertController = inject(AlertController);

  currentUser: UserProfile | null = null;

  constructor() {
    addIcons({ personOutline, logOutOutline });
  }

  ngOnInit() {
    if (this.msalAuthService.isLoggedIn()) {
      this.currentUser = this.msalAuthService.getUserProfile();
    } else {
      this.router.navigate(['/login']);
    }
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Wylogowanie',
      message: 'Czy na pewno chcesz się wylogować?',
      buttons: [
        {
          text: 'Anuluj',
          role: 'cancel'
        },
        {
          text: 'Wyloguj',
          handler: () => {
            this.msalAuthService.logout().subscribe({
              next: () => {
                this.router.navigate(['/login']);
              },
              error: (error: unknown) => {
                console.error('Logout failed:', error);
                this.router.navigate(['/login']); // Navigate anyway
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }

  getUserInitials(): string {
    if (!this.currentUser) return '??';
    const name = this.currentUser.name || this.currentUser.email || '';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    } else if (words.length === 1 && words[0]) {
      return words[0].charAt(0).toUpperCase();
    }
    return '??';
  }

  getUserDisplayName(): string {
    if (!this.currentUser) return 'Nieznany użytkownik';
    return this.currentUser.name || this.currentUser.email || 'Nieznany użytkownik';
  }

  getUserEmail(): string {
    if (!this.currentUser) return '';
    return this.currentUser.email || '';
  }
}
