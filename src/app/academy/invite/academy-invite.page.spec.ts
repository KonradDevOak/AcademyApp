import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Preferences } from '@capacitor/preferences';
import { of, throwError } from 'rxjs';
import { MsalExternalAuthService } from '@shared/iam-msal-external';
import { AcademyInvitePage } from './academy-invite.page';
import { AcademyApiService } from '@konraddevoak/academy-api';
import { MembersApiService } from '../../core/services/members-api.service';
import { StorefrontContextService } from '../../core/services/storefront-context.service';
import { MembershipsCacheService } from '../../core/services/memberships-cache.service';
import { MemberDto, PendingConsentDto } from '../../core/models/member.model';

describe('AcademyInvitePage', () => {
  let fixture: ComponentFixture<AcademyInvitePage>;
  let component: AcademyInvitePage;
  let auth: jasmine.SpyObj<MsalExternalAuthService>;
  let academyApi: jasmine.SpyObj<AcademyApiService>;
  let membersApi: jasmine.SpyObj<MembersApiService>;
  let storefrontContext: jasmine.SpyObj<StorefrontContextService>;
  let membershipsCache: jasmine.SpyObj<MembershipsCacheService>;
  let router: Router;

  const completeMember: MemberDto = {
    id: 'm-1',
    email: 'parent@example.com',
    displayName: 'Parent',
    profileCompletedAt: new Date().toISOString()
  };

  // ngOnInit parks at the login step (isLoggedIn defaults to false) so each test drives the flow
  // explicitly from a known point instead of racing the constructor.
  async function setup(queryParams: Record<string, string> = { token: 'tok', storefrontId: 'sf-1' }) {
    auth = jasmine.createSpyObj('MsalExternalAuthService', ['isLoggedIn', 'login', 'logout']);
    auth.isLoggedIn.and.returnValue(false);
    auth.login.and.returnValue(of(true));
    auth.logout.and.returnValue(of(true));

    academyApi = jasmine.createSpyObj('AcademyApiService', ['acceptInvitation']);
    academyApi.acceptInvitation.and.returnValue(of(undefined));

    membersApi = jasmine.createSpyObj('MembersApiService', [
      'getMe',
      'completeProfile',
      'join',
      'getPendingConsents',
      'acceptConsent'
    ]);
    membersApi.getMe.and.returnValue(of(completeMember));
    membersApi.completeProfile.and.returnValue(of(undefined));
    membersApi.join.and.returnValue(of(undefined));
    membersApi.getPendingConsents.and.returnValue(of([]));
    membersApi.acceptConsent.and.returnValue(of(undefined));

    storefrontContext = jasmine.createSpyObj('StorefrontContextService', ['select']);
    storefrontContext.select.and.resolveTo();
    membershipsCache = jasmine.createSpyObj('MembershipsCacheService', ['invalidate']);
    membershipsCache.invalidate.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [AcademyInvitePage],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: MsalExternalAuthService, useValue: auth },
        { provide: AcademyApiService, useValue: academyApi },
        { provide: MembersApiService, useValue: membersApi },
        { provide: StorefrontContextService, useValue: storefrontContext },
        { provide: MembershipsCacheService, useValue: membershipsCache },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    fixture = TestBed.createComponent(AcademyInvitePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await Preferences.clear();
  });

  it('parks at the login step until the parent signs in, then runs the flow', async () => {
    await setup();
    expect(component.step).toBe('login');

    component.login();
    await fixture.whenStable();

    expect(membersApi.join).toHaveBeenCalledWith('sf-1');
    expect(academyApi.acceptInvitation).toHaveBeenCalledWith({ token: 'tok', storefrontId: 'sf-1' });
    expect(storefrontContext.select).toHaveBeenCalledWith('sf-1');
    expect(membershipsCache.invalidate).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/academy-children/onboarding');
  });

  it('skips login when the parent is already signed in', async () => {
    await setup();
    auth.isLoggedIn.and.returnValue(true);

    component.start();
    await fixture.whenStable();

    expect(academyApi.acceptInvitation).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/academy-children/onboarding');
  });

  it('asks for a display name when the profile is not completed', async () => {
    await setup();
    auth.isLoggedIn.and.returnValue(true);
    membersApi.getMe.and.returnValue(of({ ...completeMember, profileCompletedAt: null }));

    component.start();
    await fixture.whenStable();
    expect(component.step).toBe('profile');

    component.profileForm.setValue({ displayName: 'Anna Nowak' });
    component.saveProfile();
    await fixture.whenStable();

    expect(membersApi.completeProfile).toHaveBeenCalledWith('Anna Nowak');
    expect(academyApi.acceptInvitation).toHaveBeenCalled();
  });

  it('shows pending consents inline, then retries the join after they are accepted', async () => {
    await setup();
    auth.isLoggedIn.and.returnValue(true);
    const consent: PendingConsentDto = {
      documentType: 'StudioTerms',
      documentVersionId: 'v1',
      versionLabel: 'Regulamin v1',
      contentUrl: 'https://x/terms.pdf'
    };
    membersApi.join.and.returnValues(
      throwError(() => new HttpErrorResponse({ status: 400, error: { errors: [{ code: 'member_consent_required' }] } })),
      of(undefined)
    );
    membersApi.getPendingConsents.and.returnValue(of([consent]));

    component.start();
    await fixture.whenStable();
    expect(component.step).toBe('consents');
    expect(component.pendingConsents.length).toBe(1);

    component.acceptConsent(consent);
    expect(component.allConsentsAccepted).toBeTrue();

    component.continueAfterConsents();
    await fixture.whenStable();
    expect(academyApi.acceptInvitation).toHaveBeenCalled();
  });

  it('maps an expired-token error and clears the pending invite', async () => {
    await setup();
    auth.isLoggedIn.and.returnValue(true);
    academyApi.acceptInvitation.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { errors: [{ code: 'parent_invitation_expired' }] } }))
    );

    component.start();
    await fixture.whenStable();

    expect(component.step).toBe('error');
    expect(component.errorKey).toBe('academy.invite.errors.expired');
    expect(component.errorAction).toBeNull();
    const { value } = await Preferences.get({ key: 'pending-academy-invite' });
    expect(value).toBeNull();
  });

  it('offers a re-login action on an e-mail mismatch', async () => {
    await setup();
    auth.isLoggedIn.and.returnValue(true);
    academyApi.acceptInvitation.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { errors: [{ code: 'invitation_email_mismatch' }] } }))
    );

    component.start();
    await fixture.whenStable();

    expect(component.step).toBe('error');
    expect(component.errorAction).toBe('relogin');

    component.retry();
    expect(auth.logout).toHaveBeenCalled();
    expect(component.step).toBe('login');
  });

  it('treats an already-accepted invitation as success', async () => {
    await setup();
    auth.isLoggedIn.and.returnValue(true);
    academyApi.acceptInvitation.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { errors: [{ code: 'parent_invitation_not_pending' }] } }))
    );

    component.start();
    await fixture.whenStable();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/academy-children');
  });

  it('falls back to the persisted invite on a cold start with no query params', async () => {
    await Preferences.set({
      key: 'pending-academy-invite',
      value: JSON.stringify({ token: 'cold', storefrontId: 'cold-sf' })
    });

    await setup({});
    auth.isLoggedIn.and.returnValue(true);

    component.start();
    await fixture.whenStable();

    expect(academyApi.acceptInvitation).toHaveBeenCalledWith({ token: 'cold', storefrontId: 'cold-sf' });
  });
});
