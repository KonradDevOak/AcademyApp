import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonButton,
  IonList,
  IonIcon,
  IonText,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { peopleOutline, searchOutline, exitOutline, chevronForwardOutline } from 'ionicons/icons';
import { MembersApiService } from '../core/services/members-api.service';
import { MembershipDto } from '../core/models/member.model';
import { ManualJoinComponent } from '../components/manual-join/manual-join.component';

@Component({
  selector: 'app-clubs',
  templateUrl: 'clubs.page.html',
  styleUrls: ['clubs.page.scss'],
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardContent,
    IonItem,
    IonLabel,
    IonButton,
    IonList,
    IonIcon,
    IonText,
    ManualJoinComponent
  ],
})
export class ClubsPage implements OnInit {
  private membersApi = inject(MembersApiService);
  private alertController = inject(AlertController);
  private router = inject(Router);

  memberships: MembershipDto[] = [];
  isLoading = true;

  constructor() {
    addIcons({ peopleOutline, searchOutline, exitOutline, chevronForwardOutline });
  }

  ngOnInit() {
    this.loadMemberships();
  }

  loadMemberships() {
    this.isLoading = true;
    this.membersApi.getMyMemberships().subscribe({
      next: (memberships) => {
        this.memberships = memberships;
        this.isLoading = false;
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
