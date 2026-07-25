import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline } from 'ionicons/icons';
import { MembersApiService } from '../../core/services/members-api.service';
import { isConsentRequiredError } from '../../core/utils/consent-error.util';

// Fallback join path for members who already have a storefrontId (e.g. from reception) — used both as
// the "Mam kod od recepcji" expander in find-club.page.html and as the join form on clubs.page.html's
// empty state. Owns the full join+consent-redirect+toast flow itself so both call sites stay in sync.
@Component({
  selector: 'app-manual-join',
  templateUrl: 'manual-join.component.html',
  imports: [CommonModule, ReactiveFormsModule, IonItem, IonLabel, IonInput, IonButton, IonIcon],
})
export class ManualJoinComponent {
  private membersApi = inject(MembersApiService);
  private formBuilder = inject(FormBuilder);
  private toastController = inject(ToastController);
  private router = inject(Router);

  @Output() joined = new EventEmitter<void>();

  joinForm: FormGroup;
  isJoining = false;

  constructor() {
    addIcons({ addOutline });
    this.joinForm = this.formBuilder.group({
      storefrontId: ['', [Validators.required]]
    });
  }

  join() {
    if (!this.joinForm.valid || this.isJoining) {
      return;
    }

    const storefrontId = this.joinForm.value.storefrontId;
    this.isJoining = true;
    this.membersApi.join(storefrontId).subscribe({
      next: async () => {
        this.isJoining = false;
        this.joinForm.reset();
        this.joined.emit();
        const toast = await this.toastController.create({
          message: 'Dołączono do klubu!',
          duration: 2000,
          color: 'success',
          position: 'top'
        });
        await toast.present();
      },
      error: async (error: HttpErrorResponse) => {
        this.isJoining = false;

        if (isConsentRequiredError(error)) {
          await this.router.navigate(['/tabs/clubs', storefrontId, 'consents'], {
            queryParams: { returnTo: 'join' }
          });
          return;
        }

        console.error('Failed to join storefront:', error);
        const toast = await this.toastController.create({
          message: 'Nie udało się dołączyć. Sprawdź identyfikator klubu.',
          duration: 3000,
          color: 'danger',
          position: 'top'
        });
        await toast.present();
      }
    });
  }
}
