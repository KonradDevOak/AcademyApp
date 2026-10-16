import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CAPACITOR_BROWSER, clearPendingPaymentReturn } from '../../shared/payments/payment-redirect';
import { CAPACITOR_APP, DeepLinkService } from './deep-link.service';

describe('DeepLinkService', () => {
  let router: Router;
  let navigateSpy: jasmine.Spy;
  let navigateByUrlSpy: jasmine.Spy;
  let appUrlOpenCb: ((event: { url: string }) => void) | undefined;
  let browserFinishedCb: (() => void) | undefined;
  let getLaunchUrl: jasmine.Spy;
  let closeBrowser: jasmine.Spy;

  function createService(): DeepLinkService {
    const appStub = {
      addListener: (name: string, cb: (event: { url: string }) => void) => {
        if (name === 'appUrlOpen') {
          appUrlOpenCb = cb;
        }
        return Promise.resolve({ remove: () => Promise.resolve() });
      },
      getLaunchUrl
    };
    const browserStub = {
      addListener: (name: string, cb: () => void) => {
        if (name === 'browserFinished') {
          browserFinishedCb = cb;
        }
        return Promise.resolve({ remove: () => Promise.resolve() });
      },
      close: closeBrowser
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CAPACITOR_APP, useValue: appStub },
        { provide: CAPACITOR_BROWSER, useValue: browserStub }
      ]
    });

    router = TestBed.inject(Router);
    navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    navigateByUrlSpy = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    return TestBed.inject(DeepLinkService);
  }

  beforeEach(() => {
    appUrlOpenCb = undefined;
    browserFinishedCb = undefined;
    getLaunchUrl = jasmine.createSpy('getLaunchUrl').and.resolveTo({ url: '' });
    closeBrowser = jasmine.createSpy('close').and.resolveTo();
    clearPendingPaymentReturn();
  });

  afterEach(() => clearPendingPaymentReturn());

  describe('invitations', () => {
    const expected = { queryParams: { token: 't', storefrontId: 's' } };

    it('routes the portal invite link from the e-mail to /invite', () => {
      createService();
      appUrlOpenCb!({ url: 'https://academy.localbiz.pl/invite?token=t&storefrontId=s' });
      expect(navigateSpy).toHaveBeenCalledWith(['/invite'], expected);
    });

    it('routes the custom-scheme link from the backend landing page', () => {
      createService();
      appUrlOpenCb!({ url: 'pl.localbiz.academy://invite/academy?token=t&storefrontId=s' });
      expect(navigateSpy).toHaveBeenCalledWith(['/invite'], expected);
    });

    it('routes the landing page URL itself (App Link on the API host)', () => {
      createService();
      appUrlOpenCb!({ url: 'https://localbiz.pl/api/academy/invite?token=t&storefrontId=s' });
      expect(navigateSpy).toHaveBeenCalledWith(['/invite'], expected);
    });

    it('handles a cold-start launch URL via getLaunchUrl()', async () => {
      getLaunchUrl.and.resolveTo({ url: 'pl.localbiz.academy://invite/academy?token=t&storefrontId=s' });
      const service = createService();
      await service.initialize();
      expect(navigateSpy).toHaveBeenCalledWith(['/invite'], expected);
    });

    it('ignores an invite link missing token or storefrontId', () => {
      createService();
      appUrlOpenCb!({ url: 'pl.localbiz.academy://invite/academy?token=only' });
      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  describe('payment return', () => {
    it('closes the checkout tab and resumes on the section the checkout started in', () => {
      localStorage.setItem('academy.pending-payment-return', '/classes/payment-callback');
      createService();

      appUrlOpenCb!({ url: 'pl.localbiz.academy://payment-callback?paymentId=pay-1' });

      expect(closeBrowser).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/classes/payment-callback'], {
        queryParams: { paymentId: 'pay-1' }
      });
      expect(localStorage.getItem('academy.pending-payment-return')).toBeNull();
    });

    it('falls back to the academy callback when the started section is unknown', () => {
      createService();

      appUrlOpenCb!({ url: 'pl.localbiz.academy://payment-callback?paymentId=pay-1' });

      expect(navigateSpy).toHaveBeenCalledWith(['/academy/payment-callback'], {
        queryParams: { paymentId: 'pay-1' }
      });
    });

    it('lands on the callback screen when the member closes the checkout tab', () => {
      localStorage.setItem('academy.pending-payment-return', '/academy/payment-callback');
      createService();

      browserFinishedCb!();

      expect(navigateSpy).toHaveBeenCalledWith(['/academy/payment-callback'], { queryParams: {} });
    });

    it('does nothing when a browser tab closes with no checkout pending (e.g. login)', () => {
      createService();

      browserFinishedCb!();

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  it('routes the carnet renewal link to the classes section', () => {
    createService();
    appUrlOpenCb!({ url: 'pl.localbiz.academy://carnet' });
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/classes');
  });

  it('ignores the CIAM auth callback (handled by the MSAL fork)', () => {
    createService();
    appUrlOpenCb!({ url: 'pl.localbiz.academy://auth-callback#code=xxx' });
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(navigateByUrlSpy).not.toHaveBeenCalled();
  });
});
