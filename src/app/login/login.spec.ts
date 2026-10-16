import { BehaviorSubject } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, RouterLink, convertToParamMap } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { MsalExternalAuthService } from '@shared/iam-msal-external';
import { CAPACITOR_BROWSER } from '../shared/payments/payment-redirect';
import { LoginComponent } from './login';

describe('LoginComponent', () => {
  const isLoggedIn$ = new BehaviorSubject<boolean>(false);
  let isLoggedIn: jasmine.Spy;
  let loginRedirect: jasmine.Spy;
  let navigateByUrl: jasmine.Spy;
  let queryParams: Record<string, string>;
  let fixture: ComponentFixture<LoginComponent>;

  function create(): void {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } }
    });
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    isLoggedIn$.next(false);
    queryParams = {};
    isLoggedIn = jasmine.createSpy('isLoggedIn').and.callFake(() => isLoggedIn$.getValue());
    loginRedirect = jasmine.createSpy('loginRedirect').and.resolveTo();
    navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);

    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideTranslateService(),
        { provide: MsalExternalAuthService, useValue: { isLoggedIn, isLoggedIn$, loginRedirect } },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        {
          provide: CAPACITOR_BROWSER,
          useValue: { addListener: () => Promise.resolve({ remove: () => Promise.resolve() }) }
        }
      ]
    });
    // The legal links' RouterLink needs a real Router; this spec mocks Router to assert navigation.
    TestBed.overrideComponent(LoginComponent, { remove: { imports: [RouterLink] } });
  });

  it('forwards to the requested returnUrl when already authenticated on init', () => {
    isLoggedIn$.next(true);
    queryParams = { returnUrl: '/profile' };

    create();

    expect(navigateByUrl).toHaveBeenCalledWith('/profile');
  });

  it('defaults to the home redirect when no returnUrl is present', () => {
    isLoggedIn$.next(true);

    create();

    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('forwards once the session becomes active after init', () => {
    create();
    expect(navigateByUrl).not.toHaveBeenCalled();

    isLoggedIn$.next(true);

    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('stays on the login screen and starts the redirect flow when signed out', () => {
    create();

    expect(navigateByUrl).not.toHaveBeenCalled();

    fixture.componentInstance.login();
    expect(loginRedirect).toHaveBeenCalledTimes(1);
  });

  it('shows the signing-in status instead of the button when returning authenticated', () => {
    isLoggedIn$.next(true);

    create();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role="status"]')).not.toBeNull();
    expect(el.querySelector('button')).toBeNull();
  });

  it('shows the loader after clicking login and restores the button if the redirect fails', async () => {
    create();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('button')).not.toBeNull();

    fixture.componentInstance.login();
    fixture.detectChanges();
    expect(el.querySelector('[role="status"]')).not.toBeNull();
    expect(el.querySelector('button')).toBeNull();

    loginRedirect.and.rejectWith(new Error('boom'));
    fixture.componentInstance.login();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('button')).not.toBeNull();
  });

  it('restores the button when the member closes the sign-in tab without signing in', () => {
    let browserFinished: (() => void) | undefined;
    TestBed.overrideProvider(CAPACITOR_BROWSER, {
      useValue: {
        addListener: (_: string, cb: () => void) => {
          browserFinished = cb;
          return Promise.resolve({ remove: () => Promise.resolve() });
        }
      }
    });
    create();
    const el: HTMLElement = fixture.nativeElement;

    fixture.componentInstance.login();
    browserFinished!();
    fixture.detectChanges();

    expect(el.querySelector('button')).not.toBeNull();
  });
});
