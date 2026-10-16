import { ChangeDetectionStrategy, Component, InjectionToken, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CarnetDto, CarnetsApiService } from '@konraddevoak/fitness-api';
import { TranslatePipe } from '@ngx-translate/core';
import {
  FitnessPaymentReturnContext,
  clearFitnessPaymentReturnContext,
  readFitnessPaymentReturnContext
} from '../fitness-payment-return-context';

export interface FitnessPaymentPollConfig {
  intervalMs: number;
  maxAttempts: number;
}

// Human-scale defaults; specs override to {intervalMs: 0, maxAttempts: 2}.
export const FITNESS_PAYMENT_POLL_CONFIG = new InjectionToken<FitnessPaymentPollConfig>('FITNESS_PAYMENT_POLL_CONFIG', {
  factory: () => ({ intervalMs: 3000, maxAttempts: 10 })
});

type CallbackStatus = 'polling' | 'success' | 'pending' | 'failed' | 'error';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The carnet was credited once it is Active and differs from the pre-checkout snapshot — a first activation,
// a reactivation, or one more period paid ahead.
export function isCarnetCredited(carnet: CarnetDto | null, context: FitnessPaymentReturnContext): boolean {
  if (!carnet || carnet.status !== 'Active') {
    return false;
  }
  return context.previousStatus !== 'Active' || carnet.currentPeriodEnd !== context.previousPeriodEnd;
}

// Landing route after the carnet checkout (P24/PayNow) in the system browser, routed here by DeepLinkService
// from the backend's api/carnets/payment-callback bounce. Arriving here does NOT mean the payment succeeded, so this never assumes
// success from the redirect alone. PayNow appends a paymentId and sends no webhooks, so each attempt first
// asks the backend to confirm it (the backend verifies with PayNow itself); P24 credits through its IPN, so
// the carnet is polled until it reflects the payment. The gateway's own status params are ignored.
@Component({
  selector: 'app-fitness-payment-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './fitness-payment-callback.html',
  styleUrl: '../../academy/payments/academy-payment-callback.scss'
})
export class FitnessPaymentCallbackComponent implements OnInit {
  private readonly api = inject(CarnetsApiService);
  private readonly paymentId = inject(ActivatedRoute).snapshot.queryParamMap.get('paymentId');
  private readonly pollConfig = inject(FITNESS_PAYMENT_POLL_CONFIG);

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
    const context = readFitnessPaymentReturnContext();
    if (!context) {
      this._status.set('error');
      return;
    }

    this._status.set('polling');
    this._attempt.set(0);

    for (let attempt = 1; attempt <= this.pollConfig.maxAttempts; attempt++) {
      this._attempt.set(attempt);

      if (this.paymentId) {
        try {
          const confirmation = await firstValueFrom(this.api.confirmPayNow(this.paymentId));
          if (confirmation.status === 'Paid') {
            this.finish('success');
            return;
          }
          if (confirmation.status === 'Failed') {
            this.finish('failed');
            return;
          }
        } catch (error) {
          // Not fatal — fall through to the plain poll and try again next attempt.
          console.error('Failed to confirm PayNow carnet payment:', error);
        }
      }

      try {
        const carnet = await firstValueFrom(this.api.getMyCarnet(context.storefrontId));
        if (isCarnetCredited(carnet, context)) {
          this.finish('success');
          return;
        }
      } catch (error) {
        console.error('Failed to poll carnet status:', error);
      }

      if (attempt < this.pollConfig.maxAttempts) {
        await sleep(this.pollConfig.intervalMs);
      }
    }

    // Not an error — the gateway may still be settling or the member abandoned the checkout.
    this._status.set('pending');
  }

  private finish(status: 'success' | 'failed'): void {
    clearFitnessPaymentReturnContext();
    this._status.set(status);
  }
}
