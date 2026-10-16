import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AcademyApiService, GuardianChargeDto, GuardianPaymentsDto } from '@konraddevoak/academy-api';
import { provideTranslateService } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import {
  clearAcademyPaymentReturnContext,
  saveAcademyPaymentReturnContext
} from '../academy-payment-return-context';
import { AcademyPayNowApiService, PayNowPaymentConfirmationDto } from './academy-paynow-api';
import { ACADEMY_PAYMENT_POLL_CONFIG, AcademyPaymentCallbackComponent } from './academy-payment-callback';

function guardianCharge(overrides: Partial<GuardianChargeDto> = {}): GuardianChargeDto {
  return {
    id: 'gc-1',
    period: '2026-09',
    year: 2026,
    month: 9,
    expectedAmountGrosze: 15000,
    adjustedAmountGrosze: 0,
    effectiveAmountGrosze: 15000,
    paidAmountGrosze: 0,
    creditAppliedGrosze: 0,
    remainingGrosze: 15000,
    status: 'Due',
    dueAt: null,
    siblingDiscountPercent: 0,
    lines: [],
    onlineFeeGrosze: 300,
    onlineTotalGrosze: 15300,
    payments: [],
    ...overrides
  };
}

function payments(...charges: GuardianChargeDto[]): GuardianPaymentsDto {
  return { creditGrosze: 0, onlineFeePercent: 2, onlinePaymentEnabled: true, charges };
}

describe('AcademyPaymentCallbackComponent', () => {
  const selectedId = signal<string | null>('sf-1');
  let getMyPayments: jasmine.Spy;
  let confirmPayment: jasmine.Spy;

  async function render(): Promise<ComponentFixture<AcademyPaymentCallbackComponent>> {
    const fixture = TestBed.createComponent(AcademyPaymentCallbackComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<AcademyPaymentCallbackComponent>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(() => {
    selectedId.set('sf-1');
    getMyPayments = jasmine.createSpy('getMyPayments').and.returnValue(of(payments()));
    confirmPayment = jasmine.createSpy('confirmPayment');
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: AcademyApiService, useValue: { getMyPayments } },
        { provide: AcademyPayNowApiService, useValue: { confirmPayment } },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: selectedId.asReadonly() } },
        // intervalMs: 0 and a low attempt count so a "pending" test doesn't actually wait ~30s.
        { provide: ACADEMY_PAYMENT_POLL_CONFIG, useValue: { intervalMs: 0, maxAttempts: 2 } },
        provideRouter([])
      ]
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shows the error state when there is no saved payment-return context', async () => {
    const fixture = await render();

    expect(text(fixture)).toContain('academy.paymentCallback.error');
    expect(getMyPayments).not.toHaveBeenCalled();
  });

  it('shows the error state when there is context but no selected storefront', async () => {
    saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });
    selectedId.set(null);
    const fixture = await render();

    expect(text(fixture)).toContain('academy.paymentCallback.error');
  });

  it('polls until the guardian charge is Paid, then shows success and clears the context', async () => {
    saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });
    getMyPayments.and.returnValues(
      of(payments(guardianCharge({ status: 'Due' }))),
      of(payments(guardianCharge({ status: 'Paid' })))
    );
    const fixture = await render();

    expect(getMyPayments).toHaveBeenCalledTimes(2);
    expect(getMyPayments).toHaveBeenCalledWith('sf-1');
    expect(text(fixture)).toContain('academy.paymentCallback.success');
    expect(localStorage.getItem('academy.academy-payment-return')).toBeNull();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/academy');
  });

  it('does not report success when only a different charge is Paid', async () => {
    saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });
    getMyPayments.and.returnValue(
      of(payments(guardianCharge({ id: 'gc-1', status: 'Due' }), guardianCharge({ id: 'gc-0', status: 'Paid' })))
    );
    const fixture = await render();

    expect(text(fixture)).toContain('academy.paymentCallback.pending');
    expect(text(fixture)).not.toContain('academy.paymentCallback.success');
  });

  it('shows a pending (not error) state when the charge never turns Paid within the attempt budget', async () => {
    saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });
    getMyPayments.and.returnValue(of(payments(guardianCharge({ status: 'Due' }))));
    const fixture = await render();

    expect(getMyPayments).toHaveBeenCalledTimes(2); // maxAttempts from the test poll config
    expect(text(fixture)).toContain('academy.paymentCallback.pending');
    // The context is deliberately kept so a page reload can resume polling.
    expect(localStorage.getItem('academy.academy-payment-return')).not.toBeNull();
  });

  it('retries the poll from the pending state on demand', async () => {
    saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });
    getMyPayments.and.returnValue(of(payments(guardianCharge({ status: 'Due' }))));
    const fixture = await render();
    expect(text(fixture)).toContain('academy.paymentCallback.pending');

    getMyPayments.calls.reset();
    getMyPayments.and.returnValue(of(payments(guardianCharge({ status: 'Paid' }))));
    const retryButton = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
    retryButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text(fixture)).toContain('academy.paymentCallback.success');
  });

  it('keeps polling past a transient network error instead of failing immediately', async () => {
    saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });
    getMyPayments.and.returnValues(
      throwError(() => new Error('network')),
      of(payments(guardianCharge({ status: 'Paid' })))
    );
    const fixture = await render();

    expect(text(fixture)).toContain('academy.paymentCallback.success');
  });

  it('is unaffected by a context left over from an unrelated payment already cleared elsewhere', async () => {
    clearAcademyPaymentReturnContext();
    const fixture = await render();

    expect(text(fixture)).toContain('academy.paymentCallback.error');
  });
  describe('PayNow return (paymentId in the URL)', () => {
    function confirmation(status: PayNowPaymentConfirmationDto['status']): PayNowPaymentConfirmationDto {
      return { guardianChargeId: 'gc-1', status };
    }

    async function renderWithPaymentId(): Promise<ComponentFixture<AcademyPaymentCallbackComponent>> {
      await TestBed.inject(Router).navigateByUrl('/?paymentId=P4WF-7ZR-D5D-ZT7&paymentStatus=CONFIRMED');
      return render();
    }

    it('confirms the paymentId with the backend and shows success without waiting for a webhook', async () => {
      saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });
      confirmPayment.and.returnValue(of(confirmation('Paid')));
      const fixture = await renderWithPaymentId();

      expect(confirmPayment).toHaveBeenCalledOnceWith('P4WF-7ZR-D5D-ZT7');
      expect(getMyPayments).not.toHaveBeenCalled();
      expect(text(fixture)).toContain('academy.paymentCallback.success');
      expect(localStorage.getItem('academy.academy-payment-return')).toBeNull();
    });

    it('never trusts the redirect paymentStatus: a Pending confirmation is not success', async () => {
      saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });
      confirmPayment.and.returnValue(of(confirmation('Pending')));
      const fixture = await renderWithPaymentId();

      expect(confirmPayment).toHaveBeenCalledTimes(2); // once per attempt (test poll config: 2)
      expect(text(fixture)).toContain('academy.paymentCallback.pending');
      expect(text(fixture)).not.toContain('academy.paymentCallback.success');
    });

    it('keeps asking until PayNow settles the payment', async () => {
      saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });
      confirmPayment.and.returnValues(of(confirmation('Pending')), of(confirmation('Paid')));
      const fixture = await renderWithPaymentId();

      expect(confirmPayment).toHaveBeenCalledTimes(2);
      expect(text(fixture)).toContain('academy.paymentCallback.success');
    });

    it('shows a failed state (not pending) when PayNow reports a terminal failure, and stops asking', async () => {
      saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });
      confirmPayment.and.returnValue(of(confirmation('Failed')));
      const fixture = await renderWithPaymentId();

      expect(confirmPayment).toHaveBeenCalledTimes(1);
      expect(text(fixture)).toContain('academy.paymentCallback.failed');
      expect(text(fixture)).not.toContain('academy.paymentCallback.pending');
    });

    it('falls back to polling the charge when the confirm call errors', async () => {
      saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });
      confirmPayment.and.returnValue(throwError(() => new Error('network')));
      getMyPayments.and.returnValue(of(payments(guardianCharge({ status: 'Paid' }))));
      const fixture = await renderWithPaymentId();

      expect(getMyPayments).toHaveBeenCalled();
      expect(text(fixture)).toContain('academy.paymentCallback.success');
    });

    it('does not call the confirm endpoint on a P24 return (no paymentId)', async () => {
      saveAcademyPaymentReturnContext({ guardianChargeId: 'gc-1' });
      getMyPayments.and.returnValue(of(payments(guardianCharge({ status: 'Paid' }))));
      await render();

      expect(confirmPayment).not.toHaveBeenCalled();
    });
  });
});
