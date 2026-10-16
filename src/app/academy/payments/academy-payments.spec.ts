import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AcademyApiService, GuardianChargeDto, GuardianPaymentsDto } from '@konraddevoak/academy-api';
import { provideTranslateService } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { AcademyPaymentRedirectService } from '../academy-payment-redirect';
import { readAcademyPaymentReturnContext } from '../academy-payment-return-context';
import { AcademyPaymentsComponent } from './academy-payments';
import { ClubDiscoveryService } from '../../core/services/club-discovery';

function charge(overrides: Partial<GuardianChargeDto> = {}): GuardianChargeDto {
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
    dueAt: '2026-09-10T22:00:00Z',
    siblingDiscountPercent: 50,
    onlineFeeGrosze: 300,
    onlineTotalGrosze: 15300,
    lines: [
      {
        athleteId: 'a-1',
        athleteFirstName: 'Ania',
        disciplineId: 'd-1',
        disciplineName: 'Akrobatyka',
        slotCount: 2,
        unitPriceGrosze: 7000,
        discountPercent: 0,
        amountGrosze: 14000,
        isFullPrice: true,
        waivedGrosze: 0,
        waiverReason: null,
        carryOverDecision: null
      }
    ],
    payments: [],
    ...overrides
  };
}

function payments(overrides: Partial<GuardianPaymentsDto> = {}): GuardianPaymentsDto {
  return { creditGrosze: 0, onlineFeePercent: 2, onlinePaymentEnabled: true, charges: [charge()], ...overrides };
}

describe('AcademyPaymentsComponent', () => {
  const selectedId = signal<string | null>('sf-1');
  let getMyPayments: jasmine.Spy;
  let payGuardianCharge: jasmine.Spy;
  let redirectTo: jasmine.Spy;

  async function render(): Promise<ComponentFixture<AcademyPaymentsComponent>> {
    const fixture = TestBed.createComponent(AcademyPaymentsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const root = (f: ComponentFixture<AcademyPaymentsComponent>) => f.nativeElement as HTMLElement;
  const text = (f: ComponentFixture<AcademyPaymentsComponent>) => root(f).textContent ?? '';
  const payButton = (f: ComponentFixture<AcademyPaymentsComponent>) =>
    root(f).querySelector('.academy-payments__pay') as HTMLButtonElement | null;
  const acceptTerms = (f: ComponentFixture<AcademyPaymentsComponent>): void => {
    (root(f).querySelector('app-club-terms-consent input[type="checkbox"]') as HTMLInputElement).click();
    f.detectChanges();
  };

  beforeEach(() => {
    selectedId.set('sf-1');
    getMyPayments = jasmine.createSpy('getMyPayments').and.returnValue(of(payments()));
    payGuardianCharge = jasmine.createSpy('payGuardianCharge');
    redirectTo = jasmine.createSpy('redirectTo');
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: AcademyApiService, useValue: { getMyPayments, payGuardianCharge } },
        { provide: ClubDiscoveryService, useValue: { getProfile: () => of(null), getClubDocuments: () => of([]) } },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: selectedId.asReadonly() } },
        // pay() redirects through this service so a real redirect never navigates Karma's browser.
        { provide: AcademyPaymentRedirectService, useValue: { redirectTo } }
      ]
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loads the guardian payments for the selected storefront', async () => {
    await render();

    expect(getMyPayments).toHaveBeenCalledOnceWith('sf-1');
  });

  it('shows the charge with its per-child lines, what is left and the due date', async () => {
    const fixture = await render();

    expect(text(fixture)).toContain('academy.month.9 2026');
    expect(text(fixture)).toContain('academy.payments.line');
    expect(text(fixture)).toContain('academy.payments.remaining');
    expect(text(fixture)).toContain('academy.payments.dueBy');
    expect(text(fixture)).toContain('academy.payments.due');
    expect(text(fixture)).toContain('academy.payments.amounts');
  });

  it('shows the gateway surcharge and the online total on the pay button for an unpaid charge', async () => {
    const fixture = await render();

    expect(text(fixture)).toContain('academy.payments.onlineFee');
    expect(payButton(fixture)).not.toBeNull();
    expect(payButton(fixture)!.textContent).toContain('academy.payments.payOnline');
  });

  it('hides the surcharge line when the club charges no gateway fee', async () => {
    getMyPayments.and.returnValue(
      of(payments({ onlineFeePercent: 0, charges: [charge({ onlineFeeGrosze: 0, onlineTotalGrosze: 15000 })] }))
    );
    const fixture = await render();

    expect(text(fixture)).not.toContain('academy.payments.onlineFee');
    expect(payButton(fixture)).not.toBeNull();
  });

  it('offers no card payment when the owner switched online payment off, only the pay-the-club hint', async () => {
    getMyPayments.and.returnValue(of(payments({ onlinePaymentEnabled: false })));
    const fixture = await render();

    expect(text(fixture)).toContain('academy.payments.due');
    expect(payButton(fixture)).toBeNull();
    expect(text(fixture)).not.toContain('academy.payments.onlineFee');
    expect(text(fixture)).toContain('academy.payments.offlineHint');
  });

  it('shows no pay button and no surcharge for an already-paid charge', async () => {
    getMyPayments.and.returnValue(
      of(
        payments({
          charges: [charge({ status: 'Paid', paidAmountGrosze: 15000, onlineFeeGrosze: 0, onlineTotalGrosze: 0 })]
        })
      )
    );
    const fixture = await render();

    expect(text(fixture)).toContain('academy.payments.paid');
    expect(payButton(fixture)).toBeNull();
    expect(text(fixture)).not.toContain('academy.payments.onlineFee');
  });

  it('exposes currentPeriodPaid for AcademyHomeComponent based on the newest charge', async () => {
    const fixture = await render();
    expect(fixture.componentInstance.currentPeriodPaid()).toBeFalse();

    getMyPayments.and.returnValue(of(payments({ charges: [charge({ status: 'Paid' })] })));
    const paidFixture = await render();
    expect(paidFixture.componentInstance.currentPeriodPaid()).toBeTrue();
  });

  it('marks an unpaid month past its due date as overdue', async () => {
    getMyPayments.and.returnValue(of(payments({ charges: [charge({ status: 'Overdue' })] })));
    const fixture = await render();

    expect(text(fixture)).toContain('academy.payments.overdue');
  });

  it('explains a waived line and the credit it leaves for the coming months', async () => {
    const waived = charge({
      status: 'Paid',
      paidAmountGrosze: 14000,
      adjustedAmountGrosze: 14000,
      effectiveAmountGrosze: 0,
      remainingGrosze: 0,
      onlineFeeGrosze: 0,
      onlineTotalGrosze: 0
    });
    waived.lines[0] = { ...waived.lines[0], waivedGrosze: 14000, waiverReason: 'ExcusedEmptyMonth' };
    getMyPayments.and.returnValue(of(payments({ creditGrosze: 14000, charges: [waived] })));
    const fixture = await render();

    expect(text(fixture)).toContain('academy.payments.waived.ExcusedEmptyMonth');
    expect(text(fixture)).toContain('academy.payments.credit');
  });

  it('tells the parent the organizer has not issued anything when there is nothing at all', async () => {
    getMyPayments.and.returnValue(of(payments({ charges: [] })));
    const fixture = await render();

    expect(text(fixture)).toContain('academy.payments.noAmount');
    expect(payButton(fixture)).toBeNull();
  });

  it('keeps the pay button disabled until the club terms are accepted', async () => {
    const fixture = await render();

    expect(payButton(fixture)!.disabled).toBeTrue();
    acceptTerms(fixture);
    expect(payButton(fixture)!.disabled).toBeFalse();
  });

  it('starts the payment for the charge period, stores the return context and redirects to P24', async () => {
    payGuardianCharge.and.returnValue(of({ guardianChargeId: 'gc-1', redirectUrl: 'https://p24.example/checkout' }));
    const fixture = await render();

    acceptTerms(fixture);
    payButton(fixture)!.click();

    expect(payGuardianCharge).toHaveBeenCalledOnceWith('sf-1', '2026-09', true);
    expect(redirectTo).toHaveBeenCalledWith('https://p24.example/checkout');
    expect(readAcademyPaymentReturnContext()).toEqual({ guardianChargeId: 'gc-1' });
  });

  it('shows the mapped i18n key, re-enables paying and does not redirect when starting the payment fails', async () => {
    payGuardianCharge.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            error: { errors: [{ code: 'guardian_charge_already_paid' }] },
            status: 400
          })
      )
    );
    const fixture = await render();

    acceptTerms(fixture);
    payButton(fixture)!.click();
    fixture.detectChanges();

    expect(text(fixture)).toContain('academy.paymentErrors.guardianChargeAlreadyPaid');
    expect(redirectTo).not.toHaveBeenCalled();
    expect(readAcademyPaymentReturnContext()).toBeNull();
    expect(payButton(fixture)!.disabled).toBeFalse();
  });

  it('shows the error state and reloads on retry when the payments call fails', async () => {
    getMyPayments.and.returnValues(throwError(() => new Error('network')), of(payments()));
    const fixture = await render();

    expect(text(fixture)).toContain('academy.payments.loadError');

    (root(fixture).querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getMyPayments).toHaveBeenCalledTimes(2);
    expect(text(fixture)).toContain('academy.payments.due');
  });
});
