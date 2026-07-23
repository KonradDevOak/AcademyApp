import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonText,
  IonSpinner,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { documentTextOutline, checkmarkCircleOutline, openOutline } from 'ionicons/icons';
import { Browser } from '@capacitor/browser';
import { MembersApiService } from '../core/services/members-api.service';
import { PendingConsentDto } from '../core/models/member.model';

@Component({
  selector: 'app-consents',
  templateUrl: 'consents.page.html',
  styleUrls: ['consents.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonText,
    IonSpinner
  ]
})
export class ConsentsPage implements OnInit {
  private membersApi = inject(MembersApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastController = inject(ToastController);

  storefrontId = '';
  returnTo: string | null = null;
  pendingConsents: PendingConsentDto[] = [];
  acceptedDocumentTypes = new Set<string>();
  isLoading = true;
  isSubmitting = false;

  constructor() {
    addIcons({ documentTextOutline, checkmarkCircleOutline, openOutline });
  }

  ngOnInit() {
    this.storefrontId = this.route.snapshot.paramMap.get('storefrontId') ?? '';
    this.returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    this.loadPendingConsents();
  }

  loadPendingConsents() {
    this.isLoading = true;
    this.membersApi.getPendingConsents(this.storefrontId).subscribe({
      next: (consents) => {
        this.pendingConsents = consents;
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Failed to load pending consents:', error);
        this.isLoading = false;
      }
    });
  }

  async openContent(contentUrl: string) {
    await Browser.open({ url: contentUrl });
  }

  isAccepted(documentType: string): boolean {
    return this.acceptedDocumentTypes.has(documentType);
  }

  accept(consent: PendingConsentDto) {
    this.membersApi.acceptConsent(this.storefrontId, consent.documentType, consent.documentVersionId).subscribe({
      next: () => this.acceptedDocumentTypes.add(consent.documentType),
      error: async (error: unknown) => {
        console.error('Failed to accept consent:', error);
        await this.showToast('Nie udało się zapisać zgody. Spróbuj ponownie.', 'danger');
      }
    });
  }

  get allAccepted(): boolean {
    return this.pendingConsents.length > 0
      && this.pendingConsents.every((c) => this.isAccepted(c.documentType));
  }

  async continue() {
    if (this.returnTo === 'join') {
      this.isSubmitting = true;
      this.membersApi.join(this.storefrontId).subscribe({
        next: async () => {
          this.isSubmitting = false;
          await this.showToast('Dołączono do klubu!', 'success');
          await this.router.navigate(['/tabs/clubs']);
        },
        error: async (error: unknown) => {
          this.isSubmitting = false;
          console.error('Failed to join storefront after accepting consents:', error);
          await this.showToast('Nie udało się dołączyć. Spróbuj ponownie.', 'danger');
        }
      });
      return;
    }

    await this.router.navigate(['/tabs/clubs', this.storefrontId]);
  }

  private async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({ message, duration: 3000, color, position: 'top' });
    await toast.present();
  }
}
