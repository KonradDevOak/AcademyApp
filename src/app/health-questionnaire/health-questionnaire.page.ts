import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonTextarea,
  IonButton,
  IonIcon,
  IonText,
  IonSpinner,
  IonNote,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { medkitOutline, openOutline } from 'ionicons/icons';
import { Browser } from '@capacitor/browser';
import { MembersApiService } from '../core/services/members-api.service';
import { PendingConsentDto } from '../core/models/member.model';

// AnswersJson is an opaque, backend-unvalidated string (Modules.Members/CLAUDE.md: "zestaw pytań
// nieustalony") — this shape is a reasonable v1 minimum, not something the backend depends on.
interface HealthQuestionnaireAnswers {
  hasHealthContraindications: boolean;
  hasChronicCondition: boolean;
  takesRegularMedication: boolean;
  additionalNotes: string;
}

const HEALTH_DATA_PROCESSING_DOCUMENT_TYPE = 'HealthDataProcessing';

@Component({
  selector: 'app-health-questionnaire',
  templateUrl: 'health-questionnaire.page.html',
  styleUrls: ['health-questionnaire.page.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonToggle,
    IonTextarea,
    IonButton,
    IonIcon,
    IonText,
    IonSpinner,
    IonNote
  ]
})
export class HealthQuestionnairePage implements OnInit {
  private membersApi = inject(MembersApiService);
  private route = inject(ActivatedRoute);
  private formBuilder = inject(FormBuilder);
  private toastController = inject(ToastController);

  storefrontId = '';
  isLoading = true;
  isSubmitting = false;
  lastSubmittedAt: string | null = null;
  healthDataConsent: PendingConsentDto | null = null;
  form: FormGroup;

  constructor() {
    addIcons({ medkitOutline, openOutline });
    this.form = this.formBuilder.group({
      hasHealthContraindications: [false],
      hasChronicCondition: [false],
      takesRegularMedication: [false],
      additionalNotes: [''],
      healthDataConsentAccepted: [false]
    });
  }

  ngOnInit() {
    this.storefrontId = this.route.snapshot.paramMap.get('storefrontId') ?? '';
    this.load();
  }

  private load() {
    this.isLoading = true;
    this.membersApi.getPendingConsents(this.storefrontId).subscribe({
      next: (consents) => {
        this.healthDataConsent = consents.find((c) => c.documentType === HEALTH_DATA_PROCESSING_DOCUMENT_TYPE)
          ?? null;
      },
      error: (error: unknown) => console.error('Failed to load pending consents:', error)
    });

    this.membersApi.getHealthQuestionnaire(this.storefrontId).subscribe({
      next: (submission) => {
        this.isLoading = false;
        if (!submission) return;

        this.lastSubmittedAt = submission.submittedAt;
        try {
          const answers = JSON.parse(submission.answersJson) as HealthQuestionnaireAnswers;
          this.form.patchValue(answers);
        } catch {
          // Older/foreign-shaped AnswersJson — leave the form at its defaults rather than fail loading.
        }
      },
      error: (error: unknown) => {
        console.error('Failed to load health questionnaire:', error);
        this.isLoading = false;
      }
    });
  }

  async openContent(contentUrl: string) {
    await Browser.open({ url: contentUrl });
  }

  get requiresConsent(): boolean {
    return this.healthDataConsent !== null;
  }

  get canSubmit(): boolean {
    return !this.requiresConsent || this.form.value.healthDataConsentAccepted === true;
  }

  submit() {
    if (!this.canSubmit || this.isSubmitting) return;

    const { healthDataConsentAccepted, ...answers } = this.form.value;
    const answersJson = JSON.stringify(answers satisfies HealthQuestionnaireAnswers);

    this.isSubmitting = true;
    this.membersApi.submitHealthQuestionnaire(this.storefrontId, answersJson, healthDataConsentAccepted)
      .subscribe({
        next: async () => {
          this.isSubmitting = false;
          this.lastSubmittedAt = new Date().toISOString();
          await this.showToast('Ankieta zapisana.', 'success');
        },
        error: async (error: unknown) => {
          this.isSubmitting = false;
          console.error('Failed to submit health questionnaire:', error);
          await this.showToast('Nie udało się zapisać ankiety. Spróbuj ponownie.', 'danger');
        }
      });
  }

  private async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({ message, duration: 3000, color, position: 'top' });
    await toast.present();
  }
}
