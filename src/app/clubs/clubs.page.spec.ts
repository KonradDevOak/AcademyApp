import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ClubsPage } from './clubs.page';
import { MembersApiService } from '../core/services/members-api.service';
import { StorefrontContextService } from '../core/services/storefront-context.service';
import { MembershipDto } from '../core/models/member.model';

describe('ClubsPage', () => {
  let fixture: ComponentFixture<ClubsPage>;
  let component: ClubsPage;
  let membersApi: jasmine.SpyObj<MembersApiService>;
  let storefrontContext: jasmine.SpyObj<StorefrontContextService>;
  let router: Router;

  beforeEach(async () => {
    membersApi = jasmine.createSpyObj('MembersApiService', ['getMyMemberships', 'join', 'leave', 'getPendingConsents']);
    membersApi.getMyMemberships.and.returnValue(of([]));
    membersApi.getPendingConsents.and.returnValue(of([]));

    storefrontContext = jasmine.createSpyObj('StorefrontContextService', ['select', 'getPersistedIfValid']);
    storefrontContext.select.and.resolveTo();
    storefrontContext.getPersistedIfValid.and.resolveTo(null);

    await TestBed.configureTestingModule({
      imports: [ClubsPage],
      providers: [
        provideRouter([]),
        { provide: MembersApiService, useValue: membersApi },
        { provide: StorefrontContextService, useValue: storefrontContext }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl');
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(ClubsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads an empty membership list and exposes a CTA to find-club', () => {
    expect(component.memberships).toEqual([]);
    expect(component.isLoading).toBeFalse();

    component.goToFindClub();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/find-club');
  });

  it('reloads memberships after the shared manual-join component reports a successful join', () => {
    const membership: MembershipDto = {
      storefrontId: 'club-1',
      storefrontName: 'Fit Club',
      joinedAt: new Date().toISOString()
    };
    membersApi.getMyMemberships.and.returnValue(of([membership]));

    component.loadMemberships();

    expect(component.memberships.length).toBe(1);
  });

  it('warns when a joined club is no longer classified as Fitness', () => {
    const membership: MembershipDto = {
      storefrontId: 'club-1',
      storefrontName: 'Duosera',
      joinedAt: new Date().toISOString(),
      businessType: 'Retail'
    };
    membersApi.getMyMemberships.and.returnValue(of([membership]));

    component.loadMemberships();
    fixture.detectChanges();

    const warning: HTMLElement = fixture.nativeElement.querySelector('ion-text[color="warning"]');
    expect(warning.textContent).toContain('zmienił profil działalności');
  });

  it('does not warn when a joined club is still classified as Fitness', () => {
    const membership: MembershipDto = {
      storefrontId: 'club-1',
      storefrontName: 'Fit Club',
      joinedAt: new Date().toISOString(),
      businessType: 'Fitness'
    };
    membersApi.getMyMemberships.and.returnValue(of([membership]));

    component.loadMemberships();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ion-text[color="warning"]')).toBeNull();
  });

  it('navigates straight to Grafik when the selected club has no pending consents', async () => {
    const membership: MembershipDto = {
      storefrontId: 'club-1',
      storefrontName: 'Fit Club',
      joinedAt: new Date().toISOString()
    };
    membersApi.getPendingConsents.and.returnValue(of([]));

    await component.selectClub(membership);

    expect(storefrontContext.select).toHaveBeenCalledWith('club-1');
    expect(component.activeStorefrontId).toBe('club-1');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/schedule');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('navigates to the club hub when the selected club still has pending consents', async () => {
    const membership: MembershipDto = {
      storefrontId: 'club-1',
      storefrontName: 'Fit Club',
      joinedAt: new Date().toISOString()
    };
    membersApi.getPendingConsents.and.returnValue(of([
      { documentType: 'Terms', documentVersionId: 'v1', versionLabel: 'Regulamin', contentUrl: 'https://example.com' }
    ]));

    await component.selectClub(membership);

    expect(router.navigate).toHaveBeenCalledWith(['/tabs/clubs', 'club-1']);
    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/tabs/schedule');
  });

  it('marks the persisted active club as selected on load', async () => {
    const membership: MembershipDto = {
      storefrontId: 'club-1',
      storefrontName: 'Fit Club',
      joinedAt: new Date().toISOString()
    };
    membersApi.getMyMemberships.and.returnValue(of([membership]));
    storefrontContext.getPersistedIfValid.and.resolveTo('club-1');

    component.loadMemberships();
    await fixture.whenStable();

    expect(component.activeStorefrontId).toBe('club-1');
  });
});
