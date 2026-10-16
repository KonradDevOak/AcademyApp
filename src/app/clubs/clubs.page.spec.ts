import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastController } from '@ionic/angular/standalone';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { ClubsPage } from './clubs.page';
import { MembersApiService } from '../core/services/members-api.service';
import { StorefrontContextService } from '../core/services/storefront-context.service';
import { StorefrontProfileService } from '../core/services/storefront-profile.service';
import { MembershipsCacheService } from '../core/services/memberships-cache.service';
import { MemberNotificationsApiService } from '../core/services/member-notifications-api.service';
import { MembershipDto } from '../core/models/member.model';
import { StorefrontImageDto } from '../core/models/storefront.model';

// Every root-tab page now renders <app-notification-bell> in its header (see
// components/notification-bell/notification-bell.component.ts) — stub its API service here rather than
// wiring real HttpClient, so this page's own tests stay isolated from the bell's polling and don't need
// to flush/verify its unrelated HTTP calls.
const notificationsApiStub = {
  browse: () => of({ page: { items: [], currentPage: 1, resultsPerPage: 20, totalPages: 1, totalResults: 0 }, unreadCount: 0 }),
  markRead: () => of(undefined),
  markAllRead: () => of(undefined)
};

describe('ClubsPage', () => {
  let fixture: ComponentFixture<ClubsPage>;
  let component: ClubsPage;
  let membersApi: jasmine.SpyObj<MembersApiService>;
  let storefrontContext: jasmine.SpyObj<StorefrontContextService>;
  let membershipsCache: jasmine.SpyObj<MembershipsCacheService>;
  let toastController: jasmine.SpyObj<ToastController>;
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

    const toast = jasmine.createSpyObj('HTMLIonToastElement', ['present']);
    toast.present.and.resolveTo();
    toastController = jasmine.createSpyObj('ToastController', ['create']);
    toastController.create.and.resolveTo(toast);

    // Not exercised by any test here — just needs to satisfy the embedded <app-manual-join>'s DI
    // (ManualJoinComponent injects it to resolve a scanned QR code's domain to a storefrontId).
    const storefrontProfile = jasmine.createSpyObj('StorefrontProfileService', ['resolveByDomain']);

    await TestBed.configureTestingModule({
      imports: [ClubsPage],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: MembersApiService, useValue: membersApi },
        { provide: StorefrontContextService, useValue: storefrontContext },
        { provide: StorefrontProfileService, useValue: storefrontProfile },
        { provide: MembershipsCacheService, useValue: membershipsCache },
        { provide: ToastController, useValue: toastController },
        { provide: MemberNotificationsApiService, useValue: notificationsApiStub }
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

  it('leave() refreshes memberships on success', () => {
    membersApi.leave.and.returnValue(of(void 0));

    component['leave']('club-1');

    expect(membersApi.leave).toHaveBeenCalledWith('club-1');
    expect(membershipsCache.refresh).toHaveBeenCalled();
  });

  it('leave() shows a danger toast and does not refresh memberships when the API call fails', () => {
    membersApi.leave.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    membershipsCache.refresh.calls.reset();

    component['leave']('club-1');

    expect(toastController.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ color: 'danger' })
    );
    expect(membershipsCache.refresh).not.toHaveBeenCalled();
  });
});
