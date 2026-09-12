import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
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
  IonInput,
  IonCheckbox,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonSpinner,
  IonText,
  IonNote,
  ToastController
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AcademyApiService } from '@konraddevoak/academy-api';
import { MembersApiService } from '../../core/services/members-api.service';
import { StorefrontContextService } from '../../core/services/storefront-context.service';
import { getErrorCode } from '../../core/utils/consent-error.util';

// "Dodaj dziecko" — POST /api/academy/me/athletes. Form pattern from complete-profile.component.ts +
// health-questionnaire.page.ts. Requires an active Guardian for the caller (created on invite accept,
// G3); a guardian_not_found from the backend is surfaced as a specific message.
@Component({
  selector: 'app-academy-onboarding',
  templateUrl: 'academy-onboarding.page.html',
  styleUrls: ['academy-onboarding.page.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonCheckbox,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonSpinner,
    IonText,
    IonNote,
    TranslatePipe
  ]
})
export class AcademyOnboardingPage implements OnInit {
  private formBuilder = inject(FormBuilder);
  private academyApi = inject(AcademyApiService);
  private membersApi = inject(MembersApiService);
  private storefrontContext = inject(StorefrontContextService);
  private router = inject(Router);
  private toastController = inject(ToastController);
  private translate = inject(TranslateService);

  storefrontId: string | null = null;
  isResolving = true;
  isSaving = false;

  readonly localities = ['Drobin', 'Sierpc', 'Płock'];

  form: FormGroup = this.formBuilder.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    dateOfBirth: ['', [Validators.required]],
    acrobatics: [false],
    martialArts: [false],
    trainingFrequency: ['OncePerWeek', [Validators.required]],
    preferredLocality: ['']
  });

  private readonly errorMessages: Record<string, string> = {
    athlete_must_have_discipline: 'academy.onboarding.errors.mustHaveDiscipline',
    invalid_discipline: 'academy.onboarding.errors.invalidDiscipline',
    invalid_training_frequency: 'academy.onboarding.errors.invalidFrequency',
    guardian_not_found: 'academy.onboarding.errors.guardianNotFound'
  };

  ngOnInit() {
    this.membersApi.getMyMemberships().subscribe({
      next: async (memberships) => {
        this.storefrontId = await this.storefrontContext.resolve(memberships);
        this.isResolving = false;
      },
      error: (error: unknown) => {
        console.error('Failed to resolve storefront:', error);
        this.isResolving = false;
      }
    });
  }

  get selectedDisciplines(): string[] {
    const disciplines: string[] = [];
    if (this.form.value.acrobatics) disciplines.push('Acrobatics');
    if (this.form.value.martialArts) disciplines.push('MartialArts');
    return disciplines;
  }

  get canSubmit(): boolean {
    return this.form.valid && this.selectedDisciplines.length > 0 && !this.isSaving && !!this.storefrontId;
  }

  submit() {
    if (!this.canSubmit) return;

    this.isSaving = true;
    this.academyApi
      .registerAthlete({
        storefrontId: this.storefrontId!,
        firstName: this.form.value.firstName,
        lastName: this.form.value.lastName,
        dateOfBirth: this.form.value.dateOfBirth,
        disciplines: this.selectedDisciplines,
        trainingFrequency: this.form.value.trainingFrequency,
        preferredLocality: this.form.value.preferredLocality ?? ''
      })
      .subscribe({
        next: (athleteId) => {
          this.isSaving = false;
          this.router.navigateByUrl(`/tabs/academy-children/${athleteId}`);
        },
        error: (error: HttpErrorResponse) => {
          console.error('Failed to register athlete:', error);
          this.isSaving = false;
          const key = this.errorMessages[getErrorCode(error) ?? ''] ?? 'academy.onboarding.errors.generic';
          this.showToast(this.translate.instant(key));
        }
      });
  }

  private async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color: 'danger',
      position: 'top'
    });
    await toast.present();
  }
}
