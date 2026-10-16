import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AcademyApiService } from '@konraddevoak/academy-api';
import { provideTranslateService } from '@ngx-translate/core';
import { MsalExternalAuthService } from '@shared/iam-msal-external';
import { MembersApiService } from '../core/services/members-api';
import { MembershipContextService } from '../core/services/membership-context';
import { StorefrontContextService } from '../core/services/storefront-context';
import { readInviteContext, saveInviteContext } from './invite-context';
import { InviteComponent } from './invite';

function errorWithCode(code: string, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ error: { errors: [{ code }] }, status });
}

describe('InviteComponent', () => {
  let fixture: ComponentFixture<InviteComponent>;
  let component: InviteComponent;
  let isLoggedIn: jasmine.Spy;
  let logoutRedirect: jasmine.Spy;
  let navigate: jasmine.Spy;
  let navigateByUrl: jasmine.Spy;
  let getMe: jasmine.Spy;
  let completeProfile: jasmine.Spy;
  let getPendingConsents: jasmine.Spy;
  let acceptConsent: jasmine.Spy;
  let join: jasmine.Spy;
  let acceptInvitation: jasmine.Spy;
  let reload: jasmine.Spy;
  let select: jasmine.Spy;
  let queryParams: Record<string, string>;

  function create(): void {
    TestBed.configureTestingModule({
      imports: [InviteComponent],
      providers: [
        provideTranslateService(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } }
        },
        // The real router still reports the previous URL ('/' on a cold load from the e-mail link) while
        // the initial navigation is in flight, i.e. while ngOnInit runs — mirror that here.
        { provide: Router, useValue: { navigate, navigateByUrl, url: '/' } },
        { provide: MsalExternalAuthService, useValue: { isLoggedIn, logoutRedirect } },
        {
          provide: MembersApiService,
          useValue: { getMe, completeProfile, getPendingConsents, acceptConsent, join }
        },
        { provide: AcademyApiService, useValue: { acceptInvitation } },
        { provide: MembershipContextService, useValue: { reload } },
        { provide: StorefrontContextService, useValue: { select } }
      ]
    });
    fixture = TestBed.createComponent(InviteComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    localStorage.clear();
    queryParams = { token: 'tok-1', storefrontId: 'sf-1' };
    isLoggedIn = jasmine.createSpy('isLoggedIn').and.returnValue(true);
    logoutRedirect = jasmine.createSpy('logoutRedirect');
    navigate = jasmine.createSpy('navigate');
    navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);
    getMe = jasmine
      .createSpy('getMe')
      .and.returnValue(of({ id: 'm-1', email: 'a@b.pl', displayName: 'Anna', profileCompletedAt: '2026-01-01' }));
    completeProfile = jasmine.createSpy('completeProfile').and.returnValue(of(undefined));
    getPendingConsents = jasmine.createSpy('getPendingConsents').and.returnValue(of([]));
    acceptConsent = jasmine.createSpy('acceptConsent').and.returnValue(of(undefined));
    join = jasmine.createSpy('join').and.returnValue(of(undefined));
    acceptInvitation = jasmine.createSpy('acceptInvitation').and.returnValue(of(undefined));
    reload = jasmine.createSpy('reload').and.resolveTo(undefined);
    select = jasmine.createSpy('select');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shows the invalid-link state when the link has no token/storefrontId and nothing is stored', fakeAsync(() => {
    queryParams = {};
    create();
    fixture.detectChanges();
    tick();

    expect(component['status']()).toBe('invalid-link');
  }));

  it('falls back to the stored context when query params are missing (post-login return)', fakeAsync(() => {
    saveInviteContext({ token: 'stored-tok', storefrontId: 'stored-sf' });
    queryParams = {};
    create();
    fixture.detectChanges();
    tick();

    expect(join).toHaveBeenCalledWith('stored-sf');
  }));

  it('saves the invite context and redirects to login when signed out', fakeAsync(() => {
    isLoggedIn.and.returnValue(false);
    create();
    fixture.detectChanges();
    tick();

    expect(readInviteContext()).toEqual({ token: 'tok-1', storefrontId: 'sf-1' });
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/invite?token=tok-1&storefrontId=sf-1' }
    });
    expect(getMe).not.toHaveBeenCalled();
  }));

  it('joins, accepts and shows the success screen when the profile is complete and there are no pending consents', fakeAsync(() => {
    create();
    fixture.detectChanges();
    tick();

    expect(join).toHaveBeenCalledWith('sf-1');
    expect(acceptInvitation).toHaveBeenCalledWith({ token: 'tok-1', storefrontId: 'sf-1' });
    expect(reload).toHaveBeenCalled();
    expect(select).toHaveBeenCalledWith('sf-1');
    expect(readInviteContext()).toBeNull();
    expect(component['status']()).toBe('success');
    expect(navigateByUrl).not.toHaveBeenCalled();
  }));

  it('goToPanel() navigates to /academy from the success screen', fakeAsync(() => {
    create();
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.btn--primary');
    button.click();

    expect(navigateByUrl).toHaveBeenCalledWith('/academy');
  }));

  it('shows needs-profile and proceeds after a valid submission', fakeAsync(() => {
    getMe.and.returnValue(of({ id: 'm-1', email: 'a@b.pl', displayName: null, profileCompletedAt: null }));
    create();
    fixture.detectChanges();
    tick();

    expect(component['status']()).toBe('needs-profile');
    expect(join).not.toHaveBeenCalled();

    component['profileForm'].controls.displayName.setValue('Anna Kowalska');
    component['submitProfile']();
    tick();

    expect(completeProfile).toHaveBeenCalledWith('Anna Kowalska');
    expect(join).toHaveBeenCalledWith('sf-1');
    expect(component['status']()).toBe('success');
  }));

  it('does not submit the profile form while invalid', fakeAsync(() => {
    getMe.and.returnValue(of({ id: 'm-1', email: 'a@b.pl', displayName: null, profileCompletedAt: null }));
    create();
    fixture.detectChanges();
    tick();

    component['submitProfile']();
    tick();

    expect(completeProfile).not.toHaveBeenCalled();
    expect(component['profileForm'].controls.displayName.touched).toBeTrue();
  }));

  it('shows needs-consents and joins only after all pending consents are accepted', fakeAsync(() => {
    getPendingConsents.and.returnValue(
      of([
        { documentType: 'StudioTerms', documentVersionId: 'v-1', versionLabel: 'Regulamin v1', contentUrl: 'https://x/terms' },
        { documentType: 'StudioRodo', documentVersionId: 'v-2', versionLabel: 'RODO v1', contentUrl: 'https://x/rodo' }
      ])
    );
    create();
    fixture.detectChanges();
    tick();

    expect(component['status']()).toBe('needs-consents');
    expect(component['allConsentsAccepted']()).toBeFalse();

    void component['submitConsents']();
    tick();
    expect(join).not.toHaveBeenCalled();
    expect(acceptConsent).not.toHaveBeenCalled();

    component['toggleConsent']('StudioTerms', true);
    component['toggleConsent']('StudioRodo', true);
    expect(component['allConsentsAccepted']()).toBeTrue();

    void component['submitConsents']();
    tick();

    expect(acceptConsent).toHaveBeenCalledWith('sf-1', 'StudioTerms', 'v-1');
    expect(acceptConsent).toHaveBeenCalledWith('sf-1', 'StudioRodo', 'v-2');
    expect(join).toHaveBeenCalledWith('sf-1');
    expect(component['status']()).toBe('success');
  }));

  it('re-shows the consent screen when join() hits the member_consent_required backstop', fakeAsync(() => {
    join.and.returnValue(throwError(() => errorWithCode('member_consent_required')));
    getPendingConsents.and.returnValue(
      of([{ documentType: 'StudioTerms', documentVersionId: 'v-1', versionLabel: 'Regulamin v1', contentUrl: 'https://x/terms' }])
    );
    create();
    fixture.detectChanges();
    tick();

    expect(component['status']()).toBe('needs-consents');
    expect(acceptInvitation).not.toHaveBeenCalled();
  }));

  it('treats parent_invitation_not_pending from accept as success, not an error', fakeAsync(() => {
    acceptInvitation.and.returnValue(throwError(() => errorWithCode('parent_invitation_not_pending')));
    create();
    fixture.detectChanges();
    tick();

    expect(component['status']()).toBe('success');
  }));

  it('shows a retry-login option on invitation_email_mismatch', fakeAsync(() => {
    acceptInvitation.and.returnValue(throwError(() => errorWithCode('invitation_email_mismatch')));
    create();
    fixture.detectChanges();
    tick();

    expect(component['status']()).toBe('error');
    expect(component['canRetryLogin']()).toBeTrue();

    component['retryLogin']();
    expect(logoutRedirect).toHaveBeenCalledTimes(1);
  }));

  it('shows a generic error without retry-login for parent_invitation_not_found', fakeAsync(() => {
    acceptInvitation.and.returnValue(throwError(() => errorWithCode('parent_invitation_not_found', 404)));
    create();
    fixture.detectChanges();
    tick();

    expect(component['status']()).toBe('error');
    expect(component['canRetryLogin']()).toBeFalse();
    expect(component['errorMessage']()).toBe('academy.invite.errors.parentInvitationNotFound');
  }));

  it('retry() restarts the whole resolution', fakeAsync(() => {
    join.and.returnValue(throwError(() => new HttpErrorResponse({ error: {}, status: 500 })));
    create();
    fixture.detectChanges();
    tick();
    expect(component['status']()).toBe('error');

    join.and.returnValue(of(undefined));
    component['retry']();
    tick();

    expect(component['status']()).toBe('success');
  }));
});
