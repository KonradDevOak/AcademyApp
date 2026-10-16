import { ChangeDetectionStrategy, Component, InjectionToken, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AcademyApiService } from '@konraddevoak/academy-api';
import { TranslatePipe } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { AcademyPayNowApiService } from './academy-paynow-api';
import {
  clearAcademyPaymentReturnContext,
  readAcademyPaymentReturnContext
} from '../academy-payment-return-context';

export interface AcademyPaymentPollConfig {
  intervalMs: number;
  maxAttempts: number;
}

// Real, human-scale defaults for production; specs override this to {intervalMs: 0, maxAttempts: 2}
// so a test doesn't actually wait tens of seconds for a poll loop to finish.
export const ACADEMY_PAYMENT_POLL_CONFIG = new InjectionToken<AcademyPaymentPollConfig>(
  'ACADEMY_PAYMENT_POLL_CONFIG',
  { factory: () => ({ intervalMs: 3000, maxAttempts: 10 }) }
);

type CallbackStatus = 'polling' | 'success' | 'pending' | 'failed' | 'error';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Landing route after the gateway checkout started by academy-payments.ts's pay(). Arriving here does
// NOT mean the payment succeeded — the gateway lands here on failure/cancellation too — so this never
// assumes success from the redirect alone.
//
// P24: the real outcome is the backend's async p24/notify webhook, so this polls GET me/payments for the
// guardian charge to flip to "Paid".
// PayNow: the redirect carries a paymentId. The paynow/notify webhook can't be relied on (PayNow can't reach
// a local/unregistered backend), so each attempt first asks the backend to confirm that paymentId — it
// verifies the status with PayNow itself and records the payment — and only then falls back to polling. The
// redirect's own paymentStatus param is ignored (untrusted browser input).
//
// The checkout runs in the system browser; the backend's payment-callback return page bounces it to
// pl.localbiz.academy://payment-callback<query>, and DeepLinkService routes that here (also when the member
// just closes the checkout tab — then without a paymentId).
@Component({
  selector: 'app-academy-payment-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './academy-payment-callback.html',
  styleUrl: './academy-payment-callback.scss'
})
export class AcademyPaymentCallbackComponent implements OnInit {
  private readonly api = inject(AcademyApiService);
  private readonly payNowApi = inject(AcademyPayNowApiService);
  private readonly paymentId = inject(ActivatedRoute).snapshot.queryParamMap.get('paymentId');
  private readonly storefrontContext = inject(StorefrontContextService);
  private readonly pollConfig = inject(ACADEMY_PAYMENT_POLL_CONFIG);

  private readonly _status = signal<CallbackStatus>('polling');
  private readonly _attempt = signal(0);

  protected readonly status = this._status.asReadonly();
  protected readonly attempt = this._attempt.asReadonly();
  protected readonly maxAttempts = this.pollConfig.maxAttempts;

  ngOnInit(): void {
    void this.startPolling();
  }

  protected retry(): void {
    void this.startPolling();
  }

  private async startPolling(): Promise<void> {
    const context = readAcademyPaymentReturnContext();
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!context || !storefrontId) {
      this._status.set('error');
      return;
    }

    this._status.set('polling');
    this._attempt.set(0);

    for (let attempt = 1; attempt <= this.pollConfig.maxAttempts; attempt++) {
      this._attempt.set(attempt);

      if (this.paymentId) {
        try {
          const confirmation = await firstValueFrom(this.payNowApi.confirmPayment(this.paymentId));
          if (confirmation.status === 'Paid') {
            clearAcademyPaymentReturnContext();
            this._status.set('success');
            return;
          }
          if (confirmation.status === 'Failed') {
            clearAcademyPaymentReturnContext();
            this._status.set('failed');
            return;
          }
        } catch (error) {
          // Not fatal — fall through to the plain poll below and try again next attempt.
          console.error('Failed to confirm PayNow payment:', error);
        }
      }

      try {
        const payments = await firstValueFrom(this.api.getMyPayments(storefrontId));
        const charge = payments.charges.find((c) => c.id === context.guardianChargeId);
        if (charge?.status === 'Paid') {
          clearAcademyPaymentReturnContext();
          this._status.set('success');
          return;
        }
      } catch (error) {
        console.error('Failed to poll guardian charge status:', error);
      }

      if (attempt < this.pollConfig.maxAttempts) {
        await sleep(this.pollConfig.intervalMs);
      }
    }

    // Not an error — the payment may still be in flight (P24 IPN can lag) or the parent may have
    // abandoned the checkout. Either way we don't know, so we say so rather than guessing.
    this._status.set('pending');
  }
}
