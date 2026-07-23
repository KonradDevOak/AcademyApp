import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonSpinner,
  IonText
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { documentTextOutline, medkitOutline, chevronForwardOutline } from 'ionicons/icons';
import { MembersApiService } from '../core/services/members-api.service';
import { MembershipDto } from '../core/models/member.model';

@Component({
  selector: 'app-club-detail',
  templateUrl: 'club-detail.page.html',
  styleUrls: ['club-detail.page.scss'],
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonSpinner,
    IonText
  ]
})
export class ClubDetailPage implements OnInit {
  private membersApi = inject(MembersApiService);
  private route = inject(ActivatedRoute);

  storefrontId = '';
  membership: MembershipDto | null = null;
  isLoading = true;

  constructor() {
    addIcons({ documentTextOutline, medkitOutline, chevronForwardOutline });
  }

  ngOnInit() {
    this.storefrontId = this.route.snapshot.paramMap.get('storefrontId') ?? '';
    this.membersApi.getMyMemberships().subscribe({
      next: (memberships) => {
        this.membership = memberships.find((m) => m.storefrontId === this.storefrontId) ?? null;
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Failed to load membership:', error);
        this.isLoading = false;
      }
    });
  }
}
