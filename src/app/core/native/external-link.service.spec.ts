import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CAPACITOR_BROWSER } from '../../shared/payments/payment-redirect';
import { environment } from '../../../environments/environment';
import { ExternalLinkService, toInAppPath } from './external-link.service';

describe('toInAppPath', () => {
  it('keeps a relative link as the in-app route', () => {
    expect(toInAppPath('/klub/sf-1/regulamin')).toBe('/klub/sf-1/regulamin');
  });

  it('maps a portal URL to the matching in-app route', () => {
    expect(toInAppPath(`${environment.webAppBaseUrl}/klub/sf-1/regulamin?x=1`)).toBe('/klub/sf-1/regulamin?x=1');
    expect(toInAppPath(environment.webAppBaseUrl)).toBe('/');
  });

  it('leaves other links alone', () => {
    expect(toInAppPath('https://club.example/terms.pdf')).toBeNull();
    expect(toInAppPath('tel:+48123456789')).toBeNull();
    expect(toInAppPath('//cdn.example/x')).toBeNull();
  });
});

describe('ExternalLinkService', () => {
  let open: jasmine.Spy;
  let navigateByUrl: jasmine.Spy;
  let anchor: HTMLAnchorElement;

  beforeEach(() => {
    open = jasmine.createSpy('open').and.resolveTo();
    navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: CAPACITOR_BROWSER, useValue: { open } },
        { provide: Router, useValue: { navigateByUrl } }
      ]
    });
    TestBed.inject(ExternalLinkService).initialize();
    anchor = document.createElement('a');
    anchor.target = '_blank';
    document.body.appendChild(anchor);
  });

  afterEach(() => anchor.remove());

  function click(): MouseEvent {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(event);
    return event;
  }

  it('opens an external document in the system browser', () => {
    anchor.href = 'https://club.example/terms.pdf';
    expect(click().defaultPrevented).toBeTrue();
    expect(open).toHaveBeenCalledWith({ url: 'https://club.example/terms.pdf' });
  });

  it('opens a relative link in the app instead of a new window', () => {
    anchor.setAttribute('href', '/klub/sf-1/regulamin');
    expect(click().defaultPrevented).toBeTrue();
    expect(navigateByUrl).toHaveBeenCalledWith('/klub/sf-1/regulamin');
    expect(open).not.toHaveBeenCalled();
  });

  it('leaves tel: links to the system', () => {
    anchor.setAttribute('href', 'tel:+48123456789');
    anchor.addEventListener('click', (e) => e.preventDefault(), { once: true }); // no real dialer in a test
    click();
    expect(open).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('ignores a click another handler already took over (RouterLink)', () => {
    anchor.setAttribute('href', '/clubs');
    anchor.addEventListener('click', (e) => e.preventDefault(), { once: true });
    click();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
