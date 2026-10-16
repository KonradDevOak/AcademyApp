import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { MembersApiService } from '../core/services/members-api';
import { formatDate } from '../fitness/fitness-format';

// Shape of AnswersJson — owned by the client (the backend stores it opaquely). Same fields as the native
// AcademyApp so submissions from either client read the same for the club's staff.
export interface HealthQuestionnaireAnswers {
  hasHealthContraindications: boolean;
  hasChronicCondition: boolean;
  takesRegularMedication: boolean;
  additionalNotes: string;
}

type LoadStatus = 'loading' | 'loaded' | 'error';

// The member's health questionnaire for one academy (classes & passes section) — prefilled from the latest submission, every save
// appends a new version. The health-data consent checkbox is always required: the backend demands it whenever
// the club has published a HealthDataProcessing document, and that document is not part of the pending
// consents list, so the client cannot tell up front.
@Component({
  selector: 'app-health-questionnaire',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './health-questionnaire.html',
  styleUrl: './health-questionnaire.scss'
})
export class HealthQuestionnaireComponent implements OnInit {
  private readonly membersApi = inject(MembersApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly storefrontId = inject(ActivatedRoute).snapshot.paramMap.get('storefrontId') ?? '';

  private readonly _status = signal<LoadStatus>('loading');
  private readonly _lastSubmittedAt = signal<string | null>(null);
  private readonly _saving = signal(false);
  private readonly _result = signal<'saved' | 'failed' | null>(null);

  protected readonly status = this._status.asReadonly();
  protected readonly lastSubmittedAt = this._lastSubmittedAt.asReadonly();
  protected readonly saving = this._saving.asReadonly();
  protected readonly result = this._result.asReadonly();
  protected readonly formatDate = formatDate;

  protected readonly form = this.fb.nonNullable.group({
    hasHealthContraindications: [false],
    hasChronicCondition: [false],
    takesRegularMedication: [false],
    additionalNotes: [''],
    healthDataConsentAccepted: [false]
  });

  ngOnInit(): void {
    void this.load();
  }

  protected async submit(): Promise<void> {
    const { healthDataConsentAccepted, ...answers } = this.form.getRawValue();
    if (!healthDataConsentAccepted || this._saving()) {
      this.form.controls.healthDataConsentAccepted.markAsTouched();
      return;
    }

    this._saving.set(true);
    this._result.set(null);
    try {
      await firstValueFrom(
        this.membersApi.submitHealthQuestionnaire(
          this.storefrontId,
          JSON.stringify(answers satisfies HealthQuestionnaireAnswers),
          true
        )
      );
      this._lastSubmittedAt.set(new Date().toISOString());
      this._result.set('saved');
    } catch (error) {
      console.error('Failed to submit the health questionnaire:', error);
      this._result.set('failed');
    } finally {
      this._saving.set(false);
    }
  }

  private async load(): Promise<void> {
    this._status.set('loading');
    try {
      const submission = await firstValueFrom(this.membersApi.getHealthQuestionnaire(this.storefrontId));
      if (submission) {
        this._lastSubmittedAt.set(submission.submittedAt);
        try {
          this.form.patchValue(JSON.parse(submission.answersJson) as Partial<HealthQuestionnaireAnswers>);
        } catch {
          // Older/foreign-shaped AnswersJson — keep the defaults rather than fail loading.
        }
      }
      this._status.set('loaded');
    } catch (error) {
      console.error('Failed to load the health questionnaire:', error);
      this._status.set('error');
    }
  }
}
