import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
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
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { peopleOutline, searchOutline, exitOutline, checkmarkCircle } from 'ionicons/icons';
import { MembersApiService } from '../core/services/members-api.service';
import { StorefrontContextService } from '../core/services/storefront-context.service';
import { MembershipDto } from '../core/models/member.model';
import { ManualJoinComponent } from '../components/manual-join/manual-join.component';

@Component({
  selector: 'app-clubs',
  templateUrl: 'clubs.page.html',
  styleUrls: ['clubs.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
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
    ManualJoinComponent
  ],
})
export class ClubsPage implements OnInit {
  private membersApi = inject(MembersApiService);
  private storefrontContext = inject(StorefrontContextService);
  private alertController = inject(AlertController);
  private router = inject(Router);

  memberships: MembershipDto[] = [];
  isLoading = true;
  activeStorefrontId: string | null = null;

  constructor() {
    addIcons({ peopleOutline, searchOutline, exitOutline, checkmarkCircle });
  }

  ngOnInit() {
    this.loadMemberships();
  }

  loadMemberships() {
    this.isLoading = true;
    this.membersApi.getMyMemberships().subscribe({
      next: async (memberships) => {
        this.memberships = memberships;
        this.isLoading = false;
        this.activeStorefrontId = await this.storefrontContext.getPersistedIfValid(memberships);
      },
      error: (error: unknown) => {
        console.error('Failed to load memberships:', error);
        this.isLoading = false;
      }
    });
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
      next: () => this.loadMemberships(),
      error: (error: unknown) => console.error('Failed to leave storefront:', error)
    });
  }
}
