import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonText,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { peopleOutline, searchOutline, exitOutline, checkmarkCircle } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { MembersApiService } from '../core/services/members-api.service';
import { StorefrontContextService } from '../core/services/storefront-context.service';
import { MembershipsCacheService } from '../core/services/memberships-cache.service';
import { ThemeService } from '../core/services/theme.service';
import { MembershipDto } from '../core/models/member.model';
import { ManualJoinComponent } from '../components/manual-join/manual-join.component';
import { NotificationBellComponent } from '../components/notification-bell/notification-bell.component';
import { pickBackgroundImage } from '../core/utils/club-background.util';

@Component({
  selector: 'app-clubs',
  templateUrl: 'clubs.page.html',
  styleUrls: ['clubs.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonText,
    ManualJoinComponent,
    NotificationBellComponent
  ],
})
export class ClubsPage implements OnInit, OnDestroy {
  private membersApi = inject(MembersApiService);
  private storefrontContext = inject(StorefrontContextService);
  private membershipsCache = inject(MembershipsCacheService);
  private themeService = inject(ThemeService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);
  private router = inject(Router);
  private themeSubscription?: Subscription;

  memberships: MembershipDto[] = [];
  isLoading = true;
  activeStorefrontId: string | null = null;
  isDarkTheme = false;

  constructor() {
    addIcons({ peopleOutline, searchOutline, exitOutline, checkmarkCircle });
  }

  ngOnInit() {
    this.themeSubscription = this.themeService.preference$.subscribe((preference) => {
      this.isDarkTheme = this.themeService.isDarkFor(preference);
    });
    this.loadMemberships();
  }

  ngOnDestroy() {
    this.themeSubscription?.unsubscribe();
  }

  // Cache-first (see MembershipsCacheService) — used for the initial load so the tile grid can render
  // instantly from a warm cache instead of always waiting on a network round-trip.
  async loadMemberships() {
    this.isLoading = true;
    try {
      this.memberships = await this.membershipsCache.getOrRefresh();
      this.activeStorefrontId = await this.storefrontContext.getPersistedIfValid(this.memberships);
    } catch (error: unknown) {
      console.error('Failed to load memberships:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Bypasses the cache — used after an action that actually changed the membership list (join/leave),
  // so the new/removed tile shows up immediately instead of waiting out the cache's staleness window.
  async refreshMemberships() {
    this.isLoading = true;
    try {
      this.memberships = await this.membershipsCache.refresh();
      this.activeStorefrontId = await this.storefrontContext.getPersistedIfValid(this.memberships);
    } catch (error: unknown) {
      console.error('Failed to refresh memberships:', error);
    } finally {
      this.isLoading = false;
    }
  }

  backgroundFor(membership: MembershipDto): string | null {
    return pickBackgroundImage(
      membership.clubBackgroundDarkImage ?? null,
      membership.clubBackgroundLightImage ?? null,
      this.isDarkTheme
    );
  }

  goToFindClub() {
    this.router.navigateByUrl('/find-club');
  }

  // Tapping a tile both marks it as the active club (for Grafik/Karnet) and decides where to land:
  // straight to Grafik once consents are out of the way, otherwise the club hub (Zgody/Ankieta) as today.
  async selectClub(membership: MembershipDto) {
    await this.storefrontContext.select(membership.storefrontId);
    this.activeStorefrontId = membership.storefrontId;

    this.membersApi.getPendingConsents(membership.storefrontId).subscribe({
      next: (consents) => {
        if (consents.length === 0) {
          this.router.navigateByUrl('/tabs/schedule');
        } else {
          this.router.navigate(['/tabs/clubs', membership.storefrontId]);
        }
      },
      error: (error: unknown) => {
        console.error('Failed to load pending consents:', error);
        this.router.navigate(['/tabs/clubs', membership.storefrontId]);
      }
    });
  }

  async confirmLeave(storefrontId: string) {
    const alert = await this.alertController.create({
      header: 'Opuść klub',
      message: 'Czy na pewno chcesz opuścić ten klub?',
      buttons: [
        { text: 'Anuluj', role: 'cancel' },
        {
          text: 'Opuść',
          role: 'destructive',
          handler: () => this.leave(storefrontId)
        }
      ]
    });
    await alert.present();
  }

  private leave(storefrontId: string) {
    this.membersApi.leave(storefrontId).subscribe({
      next: () => this.refreshMemberships(),
      error: (error: unknown) => {
        console.error('Failed to leave storefront:', error);
        this.showToast('Nie udało się opuścić klubu. Spróbuj ponownie.', 'danger');
      }
    });
  }

  private async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({ message, duration: 3000, color, position: 'top' });
    await toast.present();
  }
}
