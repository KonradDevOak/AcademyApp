import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  CAPACITOR_BROWSER,
  PaymentRedirectService,
  clearPendingPaymentReturn,
  readPendingPaymentReturn
} from './payment-redirect';

describe('PaymentRedirectService', () => {
  let open: jasmine.Spy;

  function create(currentUrl: string): PaymentRedirectService {
    open = jasmine.createSpy('open').and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        { provide: CAPACITOR_BROWSER, useValue: { open } },
        { provide: Router, useValue: { url: currentUrl } }
      ]
    });
    return TestBed.inject(PaymentRedirectService);
  }

  afterEach(() => clearPendingPaymentReturn());

  it('opens the checkout in the system browser', () => {
    create('/academy').redirectTo('https://p24.example/checkout?sessionId=abc');

    expect(open).toHaveBeenCalledWith({ url: 'https://p24.example/checkout?sessionId=abc' });
  });

  it('remembers the academy callback route for a checkout started in /academy', () => {
    create('/academy?tab=payments').redirectTo('https://p24.example/checkout');

    expect(readPendingPaymentReturn()).toBe('/academy/payment-callback');
  });

  it('remembers the classes callback route for a checkout started in /classes', () => {
    create('/classes').redirectTo('https://p24.example/checkout');

    expect(readPendingPaymentReturn()).toBe('/classes/payment-callback');
  });

  it('remembers nothing for a checkout started outside a section', () => {
    create('/clubs').redirectTo('https://p24.example/checkout');

    expect(readPendingPaymentReturn()).toBeNull();
  });
});
