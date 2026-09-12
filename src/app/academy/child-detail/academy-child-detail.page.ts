import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonSegmentView,
  IonSegmentContent,
  IonLabel,
  IonList,
  IonItem,
  IonInput,
  IonButton,
  IonBadge,
  IonNote,
  IonText,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonToggle,
  RefresherCustomEvent,
  ToggleCustomEvent,
  ToastController
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  AcademyApiService,
  AcademyBillingPlanDto,
  AcademyGuardianDto,
  AthleteDetailsDto,
  AthleteGradeDto,
  FeeChargeDto,
  MonthlyAttendanceDto,
  dayKey,
  disciplineKey,
  formatZloty,
  frequencyKey,
  shortTime
} from '@konraddevoak/academy-api';
import { Browser } from '@capacitor/browser';
import { CarnetPaymentCallbackService } from '../../core/services/carnet-payment-callback.service';
import { MembersApiService } from '../../core/services/members-api.service';
import { StorefrontContextService } from '../../core/services/storefront-context.service';

type ChildDetailSegment = 'athlete' | 'guardian' | 'schedule' | 'attendance' | 'payments' | 'grades';

// Child detail with the six sub-views from prompt G2. The ion-segment / ion-segment-view pattern is
// copied from schedule.page.html — the ion-segment-view MUST stay mounted ([hidden], never *ngIf) or
// the click/swipe sync breaks permanently.
@Component({
  selector: 'app-academy-child-detail',
  templateUrl: 'academy-child-detail.page.html',
  styleUrls: ['academy-child-detail.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonSegmentView,
    IonSegmentContent,
    IonLabel,
    IonList,
    IonItem,
    IonInput,
    IonButton,
    IonBadge,
    IonNote,
    IonText,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonToggle,
    TranslatePipe
  ]
})
export class AcademyChildDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private formBuilder = inject(FormBuilder);
  private academyApi = inject(AcademyApiService);
  private membersApi = inject(MembersApiService);
  private storefrontContext = inject(StorefrontContextService);
  private paymentCallback = inject(CarnetPaymentCallbackService);
  private toastController = inject(ToastController);
  private translate = inject(TranslateService);

  athleteId = '';
  storefrontId: string | null = null;
  isLoading = true;
  loadFailed = false;
  segment: ChildDetailSegment = 'athlete';
  isSavingGuardian = false;
  isPaying = false;
  isEnablingBillingPlan = false;
  isTogglingAutoRenewal = false;
  isRetryingCharge = false;

  athlete: AthleteDetailsDto | null = null;
  guardian: AcademyGuardianDto | null = null;
  attendance: MonthlyAttendanceDto[] = [];
  grades: AthleteGradeDto[] = [];
  payments: FeeChargeDto[] = [];
  billingPlan: AcademyBillingPlanDto | null = null;

  guardianForm: FormGroup = this.formBuilder.group({
    phone: ['', [Validators.required]]
  });

  readonly disciplineKey = disciplineKey;
  readonly frequencyKey = frequencyKey;
  readonly dayKey = dayKey;
  readonly shortTime = shortTime;
  readonly formatZloty = formatZloty;

  ngOnInit() {
    this.athleteId = this.route.snapshot.paramMap.get('athleteId') ?? '';
    this.load();
  }

  private load(refresherEvent?: RefresherCustomEvent) {
    this.isLoading = !refresherEvent;
    this.membersApi.getMyMemberships().subscribe({
      next: async (memberships) => {
        const storefrontId = await this.storefrontContext.resolve(memberships);
        this.storefrontId = storefrontId;

        if (!storefrontId || !this.athleteId) {
          this.isLoading = false;
          this.loadFailed = true;
          refresherEvent?.target.complete();
          return;
        }

        this.loadDetail(storefrontId, refresherEvent);
      },
      error: (error: unknown) => {
        console.error('Failed to resolve storefront:', error);
        this.isLoading = false;
        this.loadFailed = true;
        refresherEvent?.target.complete();
      }
    });
  }

  private loadDetail(storefrontId: string, refresherEvent?: RefresherCustomEvent) {
    forkJoin({
      athlete: this.academyApi.getAthlete(storefrontId, this.athleteId),
      guardian: this.academyApi.getMyGuardian(storefrontId).pipe(catchError(() => of(null))),
      attendance: this.academyApi
        .getAthleteAttendance(storefrontId, this.athleteId)
        .pipe(catchError(() => of([] as MonthlyAttendanceDto[]))),
      grades: this.academyApi
        .getAthleteGrades(storefrontId, this.athleteId)
        .pipe(catchError(() => of([] as AthleteGradeDto[]))),
      payments: this.academyApi
        .getAthletePayments(storefrontId, this.athleteId)
        .pipe(catchError(() => of([] as FeeChargeDto[]))),
      billingPlan: this.academyApi
        .getBillingPlan(storefrontId, this.athleteId)
        .pipe(catchError(() => of(null as AcademyBillingPlanDto | null)))
    }).subscribe({
      next: ({ athlete, guardian, attendance, grades, payments, billingPlan }) => {
        this.athlete = athlete;
        this.guardian = guardian;
        this.attendance = attendance;
        this.grades = grades;
        this.payments = payments;
        this.billingPlan = billingPlan;
        this.guardianForm.patchValue({ phone: guardian?.phone ?? athlete.guardianPhone ?? '' });
        this.loadFailed = false;
        this.isLoading = false;
        refresherEvent?.target.complete();
      },
      error: (error: unknown) => {
        console.error('Failed to load athlete detail:', error);
        this.loadFailed = true;
        this.isLoading = false;
        refresherEvent?.target.complete();
      }
    });
  }

  refresh(event: RefresherCustomEvent) {
    this.load(event);
  }

  get locality(): string | null {
    return this.athlete?.group?.locality ?? null;
  }

  saveGuardianPhone() {
    if (!this.guardianForm.valid || !this.storefrontId || !this.guardian || this.isSavingGuardian) return;

    this.isSavingGuardian = true;
    this.academyApi
      .updateGuardian({
        storefrontId: this.storefrontId,
        firstName: this.guardian.firstName,
        lastName: this.guardian.lastName,
        phone: this.guardianForm.value.phone
      })
      .subscribe({
        next: () => {
          this.isSavingGuardian = false;
          this.guardian = { ...this.guardian!, phone: this.guardianForm.value.phone };
          this.guardianForm.markAsPristine();
          this.showToast('academy.childDetail.guardian.saved', 'success');
        },
        error: (error: unknown) => {
          console.error('Failed to update guardian:', error);
          this.isSavingGuardian = false;
          this.showToast('academy.childDetail.guardian.saveError', 'danger');
        }
      });
  }

  // Start a one-time P24 payment for a month's fee. Mirrors carnet.page.ts signUp(): open the checkout
  // URL, wait for the browser to come back via the deep link, then reload — the real outcome is decided
  // by the backend's async IPN, so never assume success here.
  payFeeCharge(charge: FeeChargeDto) {
    if (!this.storefrontId || this.isPaying) return;

    this.isPaying = true;
    this.academyApi.payFeeCharge(this.storefrontId, this.athleteId, charge.period).subscribe({
      next: async (result) => {
        if (result.redirectUrl) {
          await Browser.open({ url: result.redirectUrl });
          await this.paymentCallback.waitForReturn();
        }
        this.isPaying = false;
        this.load();
      },
      error: (error: unknown) => {
        console.error('Failed to start fee payment:', error);
        this.isPaying = false;
        this.showToast('academy.payments.payError', 'danger');
      }
    });
  }

  // Enrolls (or re-enrolls after PaymentFailed) with a fresh P24 card-token registration — same
  // open-then-wait-for-deep-link flow as payFeeCharge(). Real activation happens async via the backend's
  // p24/notify IPN, so this only reloads afterward, never assumes success.
  enableBillingPlan() {
    if (!this.storefrontId || this.isEnablingBillingPlan) return;

    this.isEnablingBillingPlan = true;
    this.academyApi.enableBillingPlan(this.storefrontId, this.athleteId).subscribe({
      next: async (result) => {
        if (result.redirectUrl) {
          await Browser.open({ url: result.redirectUrl });
          await this.paymentCallback.waitForReturn();
        }
        this.isEnablingBillingPlan = false;
        this.load();
      },
      error: (error: unknown) => {
        console.error('Failed to enable billing plan:', error);
        this.isEnablingBillingPlan = false;
        this.showToast('academy.billingPlan.enableError', 'danger');
      }
    });
  }

  // Mirrors carnet.page.ts toggleAutoRenewal() — pauses/resumes the recurring charge job without losing
  // the stored card token.
  toggleAutoRenewal(event: ToggleCustomEvent) {
    if (!this.storefrontId || !this.billingPlan || this.isTogglingAutoRenewal) return;

    const enabled = event.detail.checked;
    this.isTogglingAutoRenewal = true;
    this.academyApi.setBillingPlanAutoRenewal(this.storefrontId, this.athleteId, enabled).subscribe({
      next: () => {
        this.billingPlan = { ...this.billingPlan!, autoRenewalEnabled: enabled };
        this.isTogglingAutoRenewal = false;
      },
      error: (error: unknown) => {
        console.error('Failed to toggle auto-renewal:', error);
        this.isTogglingAutoRenewal = false;
        this.load();
        this.showToast('academy.billingPlan.toggleError', 'danger');
      }
    });
  }

  // Resets dunning after PaymentFailed — the backend does not charge synchronously, so this just reloads
  // to show the plan back in Active status; the next AcademyBillingJob tick retries the stored token.
  retryBillingPlanCharge() {
    if (!this.storefrontId || this.isRetryingCharge) return;

    this.isRetryingCharge = true;
    this.academyApi.retryBillingPlanCharge(this.storefrontId, this.athleteId).subscribe({
      next: () => {
        this.isRetryingCharge = false;
        this.load();
        this.showToast('academy.billingPlan.retryStarted', 'success');
      },
      error: (error: unknown) => {
        console.error('Failed to retry billing plan charge:', error);
        this.isRetryingCharge = false;
        this.showToast('academy.billingPlan.retryError', 'danger');
      }
    });
  }

  private async showToast(messageKey: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message: this.translate.instant(messageKey),
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
