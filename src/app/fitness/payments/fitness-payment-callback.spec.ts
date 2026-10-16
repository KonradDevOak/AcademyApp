import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CarnetDto, CarnetsApiService } from '@konraddevoak/fitness-api';
import {
  clearFitnessPaymentReturnContext,
  readFitnessPaymentReturnContext,
  saveFitnessPaymentReturnContext
} from '../fitness-payment-return-context';
import { FITNESS_PAYMENT_POLL_CONFIG, FitnessPaymentCallbackComponent, isCarnetCredited } from './fitness-payment-callback';

function carnet(status: string, periodEnd: string): CarnetDto {
  return { status, currentPeriodEnd: periodEnd } as CarnetDto;
}

describe('isCarnetCredited', () => {
  const firstPayment = { storefrontId: 'sf', previousStatus: null, previousPeriodEnd: null };
  const payAhead = { storefrontId: 'sf', previousStatus: 'Active', previousPeriodEnd: '2026-10-31' };

  it('is true once a first payment activated the carnet', () => {
    expect(isCarnetCredited(carnet('Active', '2026-10-31'), firstPayment)).toBeTrue();
  });

  it('waits for the period to move when paying ahead on an active carnet', () => {
    expect(isCarnetCredited(carnet('Active', '2026-10-31'), payAhead)).toBeFalse();
    expect(isCarnetCredited(carnet('Active', '2026-11-30'), payAhead)).toBeTrue();
  });

  it('is false while the carnet is not active', () => {
    expect(isCarnetCredited(carnet('PendingFirstPayment', '2026-10-31'), firstPayment)).toBeFalse();
    expect(isCarnetCredited(null, firstPayment)).toBeFalse();
  });
});

describe('FitnessPaymentCallbackComponent', () => {
  let fixture: ComponentFixture<FitnessPaymentCallbackComponent>;
  let api: jasmine.SpyObj<CarnetsApiService>;

  function create(paymentId: string | null): void {
    api = jasmine.createSpyObj<CarnetsApiService>(['getMyCarnet', 'confirmPayNow']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: CarnetsApiService, useValue: api },
        { provide: FITNESS_PAYMENT_POLL_CONFIG, useValue: { intervalMs: 0, maxAttempts: 2 } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(paymentId ? { paymentId } : {}) } }
        }
      ]
    });
  }

  function status(): string {
    return (fixture.componentInstance as unknown as { status(): string }).status();
  }

  afterEach(() => clearFitnessPaymentReturnContext());

  it('reports an error without a saved checkout context', async () => {
    create(null);
    fixture = TestBed.createComponent(FitnessPaymentCallbackComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(status()).toBe('error');
  });

  it('confirms a PayNow payment through the backend', async () => {
    saveFitnessPaymentReturnContext({ storefrontId: 'sf-1', previousStatus: null, previousPeriodEnd: null });
    create('PN-1');
    api.confirmPayNow.and.returnValue(of({ carnetId: 'c-1', status: 'Paid' }));
    fixture = TestBed.createComponent(FitnessPaymentCallbackComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.confirmPayNow).toHaveBeenCalledWith('PN-1');
    expect(status()).toBe('success');
    expect(readFitnessPaymentReturnContext()).toBeNull();
  });

  it('reports a PayNow failure', async () => {
    saveFitnessPaymentReturnContext({ storefrontId: 'sf-1', previousStatus: null, previousPeriodEnd: null });
    create('PN-1');
    api.confirmPayNow.and.returnValue(of({ carnetId: 'c-1', status: 'Failed' }));
    fixture = TestBed.createComponent(FitnessPaymentCallbackComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(status()).toBe('failed');
  });

  it('polls the carnet for a P24 return and ends pending when nothing changes', async () => {
    saveFitnessPaymentReturnContext({ storefrontId: 'sf-1', previousStatus: null, previousPeriodEnd: null });
    create(null);
    api.getMyCarnet.and.returnValue(of(carnet('PendingFirstPayment', '2026-10-31')));
    fixture = TestBed.createComponent(FitnessPaymentCallbackComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(api.getMyCarnet).toHaveBeenCalledTimes(2);
    expect(status()).toBe('pending');
  });
});
