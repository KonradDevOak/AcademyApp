import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { CarnetDto, CarnetsApiService, ClassesApiService, MembershipTypeDto } from '@konraddevoak/fitness-api';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { PaymentRedirectService } from '../../shared/payments/payment-redirect';
import { readFitnessPaymentReturnContext, clearFitnessPaymentReturnContext } from '../fitness-payment-return-context';
import { FitnessCarnetComponent } from './fitness-carnet';
import { ClubDiscoveryService } from '../../core/services/club-discovery';

function carnet(overrides: Partial<CarnetDto> = {}): CarnetDto {
  return {
    id: 'c-1',
    memberId: 'm-1',
    storefrontId: 'sf-1',
    membershipTypeId: 't-1',
    membershipTypeName: 'Open',
    priceGroszeSnapshot: 15000,
    status: 'Active',
    paymentMethod: 'OneTime',
    manualPaymentMethod: null,
    currentPeriodStart: '2026-10-01T00:00:00Z',
    currentPeriodEnd: '2026-10-31T23:59:59Z',
    autoRenewalEnabled: false,
    noticePeriodRequired: false,
    cancellationRequestedAt: null,
    cancellationEffectiveAt: null,
    reservationDeadlineAt: null,
    nextRetryAt: null,
    pendingPriceGrosze: null,
    pendingPriceProposedAt: null,
    pendingPriceAcceptedAt: null,
    ...overrides
  };
}

const TYPES: MembershipTypeDto[] = [
  { id: 't-1', storefrontId: 'sf-1', name: 'Open', description: null, priceGrosze: 15000, sessionsPerMonth: 8, isActive: true, classTypeIds: ['ct-1'] },
  { id: 't-2', storefrontId: 'sf-1', name: 'Multi', description: null, priceGrosze: 20000, sessionsPerMonth: 12, isActive: true, classTypeIds: ['ct-1', 'ct-2'] }
];

describe('FitnessCarnetComponent', () => {
  let fixture: ComponentFixture<FitnessCarnetComponent>;
  let carnetsApi: jasmine.SpyObj<CarnetsApiService>;
  let redirectTo: jasmine.Spy;

  function create(current: CarnetDto | null): void {
    carnetsApi = jasmine.createSpyObj<CarnetsApiService>([
      'getMyCarnet', 'getMembershipTypes', 'getPaymentOptions', 'signUp', 'retryPayment',
      'requestCancellation', 'withdrawCancellation', 'acceptPriceChange', 'setAutoRenewal'
    ]);
    carnetsApi.getMyCarnet.and.returnValue(of(current));
    carnetsApi.getMembershipTypes.and.returnValue(of(TYPES));
    carnetsApi.getPaymentOptions.and.returnValue(of({ gateway: 'PayNow', methods: ['OneTime'] }));
    const classesApi = jasmine.createSpyObj<ClassesApiService>(['getClassTypes']);
    classesApi.getClassTypes.and.returnValue(of([]));
    redirectTo = jasmine.createSpy('redirectTo');

    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: CarnetsApiService, useValue: carnetsApi },
        { provide: ClassesApiService, useValue: classesApi },
        { provide: ClubDiscoveryService, useValue: { getProfile: () => of(null), getClubDocuments: () => of([]) } },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: () => 'sf-1' } },
        { provide: PaymentRedirectService, useValue: { redirectTo } }
      ]
    });
    fixture = TestBed.createComponent(FitnessCarnetComponent);
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => clearFitnessPaymentReturnContext());

  it('shows the sign-up form with the club payment methods plus the front desk when there is no carnet', async () => {
    create(null);
    await settle();

    const options = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('select[formcontrolname="paymentMethod"] option'))
      .map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(['OneTime', 'Manual']);
    expect(fixture.componentInstance.isActive()).toBeFalse();
  });

  it('requires a starting class for a type that covers several classes', async () => {
    create(null);
    await settle();
    const component = fixture.componentInstance as unknown as {
      signUpForm: { patchValue(v: object): void };
      signUp(): Promise<void>;
      actionError(): string | null;
    };

    component.signUpForm.patchValue({ membershipTypeId: 't-2', paymentMethod: 'OneTime', termsAccepted: true });
    await component.signUp();

    expect(carnetsApi.signUp).not.toHaveBeenCalled();
    expect(component.actionError()).toBe('fitness.carnet.startingClassRequired');
  });

  it('does not sign up until the club terms are accepted', async () => {
    create(null);
    await settle();
    const component = fixture.componentInstance as unknown as {
      signUpForm: { patchValue(v: object): void };
      signUp(): Promise<void>;
    };

    component.signUpForm.patchValue({ membershipTypeId: 't-1', paymentMethod: 'OneTime' });
    await component.signUp();

    expect(carnetsApi.signUp).not.toHaveBeenCalled();
  });

  it('remembers the pre-checkout carnet and redirects to the gateway', async () => {
    create(null);
    await settle();
    carnetsApi.signUp.and.returnValue(of({ carnetId: 'c-1', redirectUrl: 'https://paynow.test/pay' }));
    const component = fixture.componentInstance as unknown as {
      signUpForm: { patchValue(v: object): void };
      signUp(): Promise<void>;
    };

    component.signUpForm.patchValue({ membershipTypeId: 't-1', paymentMethod: 'OneTime', discountCode: ' ABC ', termsAccepted: true });
    await component.signUp();

    expect(carnetsApi.signUp).toHaveBeenCalledWith(jasmine.objectContaining({
      storefrontId: 'sf-1', membershipTypeId: 't-1', paymentMethod: 'OneTime', discountCode: 'ABC',
      termsAccepted: true
    }));
    expect(redirectTo).toHaveBeenCalledWith('https://paynow.test/pay');
    expect(readFitnessPaymentReturnContext()).toEqual({ storefrontId: 'sf-1', previousStatus: null, previousPeriodEnd: null });
  });

  it('maps a backend error code to its message', async () => {
    create(null);
    await settle();
    carnetsApi.signUp.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { errors: [{ code: 'invalid_discount_code', message: 'x' }] }
    })));
    const component = fixture.componentInstance as unknown as {
      signUpForm: { patchValue(v: object): void };
      signUp(): Promise<void>;
      actionError(): string | null;
    };

    component.signUpForm.patchValue({ membershipTypeId: 't-1', paymentMethod: 'OneTime', discountCode: 'BAD', termsAccepted: true });
    await component.signUp();

    expect(component.actionError()).toBe('fitness.errors.invalidDiscountCode');
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('reports an active carnet to the home accordion', async () => {
    create(carnet());
    await settle();

    expect(fixture.componentInstance.resolved()).toBeTrue();
    expect(fixture.componentInstance.isActive()).toBeTrue();
    expect(carnetsApi.getMembershipTypes).not.toHaveBeenCalled();
  });

  it('lets an active OneTime carnet pay the next period ahead', async () => {
    create(carnet());
    await settle();
    carnetsApi.retryPayment.and.returnValue(of({ carnetId: 'c-1', redirectUrl: 'https://p24.test' }));

    await (fixture.componentInstance as unknown as { repay(): Promise<void> }).repay();

    expect(readFitnessPaymentReturnContext()).toEqual({
      storefrontId: 'sf-1', previousStatus: 'Active', previousPeriodEnd: '2026-10-31T23:59:59Z'
    });
    expect(redirectTo).toHaveBeenCalledWith('https://p24.test');
  });
});
