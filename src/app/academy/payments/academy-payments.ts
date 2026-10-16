import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AcademyApiService,
  GuardianChargeDto,
  GuardianPaymentsDto,
  formatZloty
} from '@konraddevoak/academy-api';
import { TranslatePipe } from '@ngx-translate/core';
import { ClubTermsConsentComponent } from '../../shared/club-terms-consent/club-terms-consent';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { monthKey } from '../academy-labels.pl';
import { academyPaymentErrorKey } from '../academy-payment-errors';
import { AcademyPaymentRedirectService } from '../academy-payment-redirect';
import { saveAcademyPaymentReturnContext } from '../academy-payment-return-context';

type PaymentsStatus = 'loading' | 'loaded' | 'error';

// The single place on /academy where a parent sees and pays the club's monthly charge for ALL their children
// together (one charge per parent, priced per child × discipline from the club's slot prices and sibling
// discount — the lines). A closed month may waive part of it (no training held, or a month missed entirely with
// only excused absences); money paid beyond what a month ends up costing carries over as credit to the next
// months. All of it is settled by the backend; this view only renders it. Online payment adds the club's
// gateway surcharge to what is still owed; the quote (`onlineFeeGrosze`/`onlineTotalGrosze`) is computed
// by the backend so what is shown here is exactly what P24 is asked for. Cash/bank transfer carry no
// surcharge and are recorded by the organizer.
//
// Paying is a full-page redirect to P24 (via the injectable AcademyPaymentRedirectService, so specs can
// mock it instead of Karma navigating away); the outcome is picked up by /academy/payment-callback, which
// polls after the round trip.
@Component({
  selector: 'app-academy-payments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ClubTermsConsentComponent],
  templateUrl: './academy-payments.html',
  styleUrl: './academy-payments.scss'
})
export class AcademyPaymentsComponent implements OnInit {
  private readonly api = inject(AcademyApiService);
  private readonly storefrontContext = inject(StorefrontContextService);
  private readonly redirect = inject(AcademyPaymentRedirectService);

  private readonly _status = signal<PaymentsStatus>('loading');
  private readonly _payments = signal<GuardianPaymentsDto | null>(null);
  private readonly _payingPeriod = signal<string | null>(null);
  private readonly _paymentError = signal<string | null>(null);

  protected readonly status = this._status.asReadonly();
  protected readonly payments = this._payments.asReadonly();
  protected readonly payingPeriod = this._payingPeriod.asReadonly();
  protected readonly paymentError = this._paymentError.asReadonly();
  protected readonly storefrontId = this.storefrontContext.selectedStorefrontId;
  // The club-terms checkbox above the list — required before any online payment (the backend rejects
  // the checkout without it).
  protected readonly termsAccepted = signal(false);
  protected readonly canPayOnline = computed(() => {
    const payments = this._payments();
    return !!payments?.onlinePaymentEnabled && payments.charges.some((c) => c.status !== 'Paid');
  });

  // Nothing to show at all: the club has issued no charge yet.
  // Public (not protected), same reason as currentPeriodPaid: with nothing to pay, AcademyHomeComponent
  // opens the roster panel by default instead of payments.
  readonly hasNothing = computed(() => {
    const payments = this._payments();
    return !!payments && payments.charges.length === 0 && payments.creditGrosze === 0;
  });

  // Public (not protected): read by AcademyHomeComponent via a viewChild query to decide section order
  // and which accordion panel opens by default (see its class comment). `charges` is sorted
  // newest-period-first by the backend (GuardianPaymentsReader), so charges[0] is the current/most
  // recent one; no charge yet issued is "not settled" (stay at the top, nothing to react to), matching
  // the pre-reorder default.
  readonly currentPeriodPaid = computed(() => this._payments()?.charges[0]?.status === 'Paid');

  // Public (not protected), same reason as currentPeriodPaid: lets AcademyHomeComponent wait for the
  // real payment status before seeding the accordion's default-open panel, instead of seeding from the
  // pre-load "not paid" default and never revisiting it.
  readonly resolved = computed(() => this._status() !== 'loading');

  protected readonly monthKey = monthKey;
  protected readonly formatZloty = formatZloty;

  protected statusKey(charge: GuardianChargeDto): string {
    switch (charge.status) {
      case 'Paid':
        return 'academy.payments.paid';
      case 'Overdue':
        return 'academy.payments.overdue';
      default:
        return 'academy.payments.due';
    }
  }

  // dueAt is the exclusive end of the club's due day; the parent's last day to pay is the day before that instant.
  protected dueDate(dueAt: string): string {
    const lastDay = new Date(new Date(dueAt).getTime() - 1);
    return `${String(lastDay.getDate()).padStart(2, '0')}.${String(lastDay.getMonth() + 1).padStart(2, '0')}`;
  }

  ngOnInit(): void {
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected pay(charge: GuardianChargeDto): void {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId || this._payingPeriod() || !this.termsAccepted()) {
      return;
    }

    this._payingPeriod.set(charge.period);
    this._paymentError.set(null);
    this.api.payGuardianCharge(storefrontId, charge.period, this.termsAccepted()).subscribe({
      next: (result) => {
        saveAcademyPaymentReturnContext({ guardianChargeId: result.guardianChargeId });
        this.redirect.redirectTo(result.redirectUrl);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to start guardian payment:', error);
        this._payingPeriod.set(null);
        this._paymentError.set(academyPaymentErrorKey(error));
      }
    });
  }

  private async load(): Promise<void> {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId) {
      // Unreachable in practice — activeStorefrontChildGuard redirects before /academy renders.
      this._status.set('error');
      return;
    }

    this._status.set('loading');
    try {
      this._payments.set(await firstValueFrom(this.api.getMyPayments(storefrontId)));
      this._status.set('loaded');
    } catch (error) {
      console.error('Failed to load guardian payments:', error);
      this._status.set('error');
    }
  }
}
