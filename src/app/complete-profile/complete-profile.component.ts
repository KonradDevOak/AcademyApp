import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  IonInput,
  IonButton,
  IonSpinner,
  ToastController
} from '@ionic/angular/standalone';
import { MembersApiService } from '../core/services/members-api.service';

@Component({
  selector: 'app-complete-profile',
  templateUrl: './complete-profile.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonSpinner
  ]
})
export class CompleteProfileComponent {
  private formBuilder = inject(FormBuilder);
  private membersApi = inject(MembersApiService);
  private router = inject(Router);
  private toastController = inject(ToastController);

  form: FormGroup;
  isSaving = false;

  constructor() {
    this.form = this.formBuilder.group({
      displayName: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  submit() {
    if (!this.form.valid || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.membersApi.completeProfile(this.form.value.displayName).subscribe({
      next: () => {
        this.isSaving = false;
        // First-time members (no memberships yet) land on the club search/discovery flow instead of
        // an empty tabs shell — see find-club.page.ts. Fails open to /tabs on error: worst case they
        // reach the same "Nie masz jeszcze klubu" empty state via clubs.page.html's own CTA.
        this.membersApi.getMyMemberships().subscribe({
          next: (memberships) => this.router.navigate([memberships.length === 0 ? '/find-club' : '/tabs']),
          error: () => this.router.navigate(['/tabs'])
        });
      },
      error: async (error: unknown) => {
        console.error('complete-profile failed:', error);
        this.isSaving = false;
        const toast = await this.toastController.create({
          message: 'Nie udało się zapisać profilu. Spróbuj ponownie.',
          duration: 3000,
          color: 'danger',
          position: 'top'
        });
        await toast.present();
      }
    });
  }
}
