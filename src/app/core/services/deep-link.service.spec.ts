import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CAPACITOR_APP, DeepLinkService } from './deep-link.service';

describe('DeepLinkService', () => {
  let router: Router;
  let navigateSpy: jasmine.Spy;
  let appUrlOpenCb: ((event: { url: string }) => void) | undefined;
  let getLaunchUrl: jasmine.Spy;

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

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: CAPACITOR_APP, useValue: appStub }]
    });

    router = TestBed.inject(Router);
    navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    return TestBed.inject(DeepLinkService);
  }

  beforeEach(() => {
    appUrlOpenCb = undefined;
    getLaunchUrl = jasmine.createSpy('getLaunchUrl').and.resolveTo({ url: '' });
  });

  it('routes a custom-scheme invite link to /academy-invite with token + storefrontId', () => {
    createService();

    appUrlOpenCb!({ url: 'pl.localbiz.sportclub://invite/academy?token=abc&storefrontId=sf-1' });

    expect(navigateSpy).toHaveBeenCalledWith(['/academy-invite'], {
      queryParams: { token: 'abc', storefrontId: 'sf-1' }
    });
  });

  it('routes an https App Link invite URL', () => {
    createService();

    appUrlOpenCb!({ url: 'https://api.localbiz.pl/api/academy/invite?token=t&storefrontId=s' });

    expect(navigateSpy).toHaveBeenCalledWith(['/academy-invite'], {
      queryParams: { token: 't', storefrontId: 's' }
    });
  });

  it('handles a cold-start launch URL via getLaunchUrl()', async () => {
    getLaunchUrl.and.resolveTo({
      url: 'pl.localbiz.sportclub://invite/academy?token=cs&storefrontId=cs-sf'
    });
    const service = createService();

    await service.initialize();

    expect(navigateSpy).toHaveBeenCalledWith(['/academy-invite'], {
      queryParams: { token: 'cs', storefrontId: 'cs-sf' }
    });
  });

  it('ignores unrelated deep links (e.g. the CIAM auth callback)', () => {
    createService();

    appUrlOpenCb!({ url: 'pl.localbiz.sportclub://auth-callback#code=xxx' });

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('ignores an invite link missing token or storefrontId', () => {
    createService();

    appUrlOpenCb!({ url: 'pl.localbiz.sportclub://invite/academy?token=only' });

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
