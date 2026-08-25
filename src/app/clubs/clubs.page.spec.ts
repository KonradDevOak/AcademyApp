import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ClubsPage } from './clubs.page';
import { MembersApiService } from '../core/services/members-api.service';
import { StorefrontContextService } from '../core/services/storefront-context.service';
import { MembershipsCacheService } from '../core/services/memberships-cache.service';
import { MembershipDto } from '../core/models/member.model';
import { StorefrontImageDto } from '../core/models/storefront.model';

describe('ClubsPage', () => {
  let fixture: ComponentFixture<ClubsPage>;
  let component: ClubsPage;
  let membersApi: jasmine.SpyObj<MembersApiService>;
  let storefrontContext: jasmine.SpyObj<StorefrontContextService>;
  let membershipsCache: jasmine.SpyObj<MembershipsCacheService>;
  let router: Router;

  beforeEach(async () => {
    membersApi = jasmine.createSpyObj('MembersApiService', ['join', 'leave', 'getPendingConsents']);
    membersApi.getPendingConsents.and.returnValue(of([]));

    storefrontContext = jasmine.createSpyObj('StorefrontContextService', ['select', 'getPersistedIfValid']);
    storefrontContext.select.and.resolveTo();
    storefrontContext.getPersistedIfValid.and.resolveTo(null);

    membershipsCache = jasmine.createSpyObj('MembershipsCacheService', ['getOrRefresh', 'refresh']);
    membershipsCache.getOrRefresh.and.resolveTo([]);
    membershipsCache.refresh.and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [ClubsPage],
      providers: [
        provideRouter([]),
        { provide: MembersApiService, useValue: membersApi },
        { provide: StorefrontContextService, useValue: storefrontContext },
        { provide: MembershipsCacheService, useValue: membershipsCache }
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

  it('loads an empty membership list and exposes a CTA to find-club', async () => {
    await fixture.whenStable();
    expect(component.memberships).toEqual([]);
    expect(component.isLoading).toBeFalse();

    component.goToFindClub();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/find-club');
  });

  it('loads memberships from the cache (cache-first)', async () => {
    const membership: MembershipDto = {
      storefrontId: 'club-1',
      storefrontName: 'Fit Club',
      joinedAt: new Date().toISOString()
    };
    membershipsCache.getOrRefresh.and.resolveTo([membership]);

    await component.loadMemberships();

    expect(component.memberships.length).toBe(1);
  });

  it('refreshMemberships() bypasses the cache via MembershipsCacheService.refresh()', async () => {
    const membership: MembershipDto = {
      storefrontId: 'club-1',
      storefrontName: 'Fit Club',
      joinedAt: new Date().toISOString()
    };
    membershipsCache.refresh.and.resolveTo([membership]);

    await component.refreshMemberships();

    expect(membershipsCache.refresh).toHaveBeenCalled();
    expect(component.memberships.length).toBe(1);
  });

  it('warns when a joined club is no longer classified as Fitness', async () => {
    const membership: MembershipDto = {
      storefrontId: 'club-1',
      storefrontName: 'Duosera',
      joinedAt: new Date().toISOString(),
      businessType: 'Retail'
    };
    membershipsCache.getOrRefresh.and.resolveTo([membership]);

    await component.loadMemberships();
    fixture.detectChanges();

    const warning: HTMLElement = fixture.nativeElement.querySelector('ion-text[color="warning"]');
    expect(warning.textContent).toContain('zmienił profil działalności');
  });

  it('does not warn when a joined club is still classified as Fitness', async () => {
    const membership: MembershipDto = {
      storefrontId: 'club-1',
      storefrontName: 'Fit Club',
      joinedAt: new Date().toISOString(),
      businessType: 'Fitness'
    };
    membershipsCache.getOrRefresh.and.resolveTo([membership]);

    await component.loadMemberships();
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
    membershipsCache.getOrRefresh.and.resolveTo([membership]);
    storefrontContext.getPersistedIfValid.and.resolveTo('club-1');

    await component.loadMemberships();

    expect(component.activeStorefrontId).toBe('club-1');
  });

  it('backgroundFor() resolves the tile image for the current theme via pickBackgroundImage', () => {
    const dark: StorefrontImageDto = { id: 'd1', url: 'https://example.com/dark.png', fileName: 'bg-dark.png' };
    const light: StorefrontImageDto = { id: 'l1', url: 'https://example.com/light.png', fileName: 'bg-light.png' };
    const membership: MembershipDto = {
      storefrontId: 'club-1',
      storefrontName: 'Fit Club',
      joinedAt: new Date().toISOString(),
      clubBackgroundDarkImage: dark,
      clubBackgroundLightImage: light
    };

    component.isDarkTheme = true;
    expect(component.backgroundFor(membership)).toBe(dark.url);

    component.isDarkTheme = false;
    expect(component.backgroundFor(membership)).toBe(light.url);
  });

  it('backgroundFor() returns null when the club has no background images', () => {
    const membership: MembershipDto = {
      storefrontId: 'club-1',
      storefrontName: 'Fit Club',
      joinedAt: new Date().toISOString()
    };

    expect(component.backgroundFor(membership)).toBeNull();
  });
});
