import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MenuController, provideIonicAngular } from '@ionic/angular/standalone';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { MsalExternalAuthService } from '@shared/iam-msal-external';
import { MembershipDto } from '../core/models/member';
import { ActiveSectionsService } from '../core/services/active-sections';
import { MemberNotificationsApiService } from '../core/services/member-notifications-api.service';
import { MembershipContextService } from '../core/services/membership-context';
import { PushNotificationsService } from '../core/services/push-notifications.service';
import { StorefrontContextService } from '../core/services/storefront-context';
import { ThemeService } from '../shared/services/theme.service';
import { AppShellComponent } from './app-shell';

function membership(storefrontId: string, services: string[]): MembershipDto {
  return {
    storefrontId,
    joinedAt: '2026-01-01T00:00:00Z',
    storefrontName: 'Akademia Drobin',
    businessType: 'Academy',
    services,
    clubBackgroundDarkImage: null,
    clubBackgroundLightImage: null
  };
}

describe('AppShellComponent', () => {
  let ensureLoaded: jasmine.Spy;
  let status: jasmine.Spy;
  let memberships: MembershipDto[];
  let selectedStorefrontId: string | null;
  let clearSelection: jasmine.Spy;
  let openMenu: jasmine.Spy;
  let initPush: jasmine.Spy;
  let fixture: ComponentFixture<AppShellComponent>;

  function create(beforeRender?: () => void): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideIonicAngular(),
        provideTranslateService(),
        { provide: MembershipContextService, useValue: { status, ensureLoaded, memberships: () => memberships } },
        {
          provide: StorefrontContextService,
          useValue: { selectedStorefrontId: () => selectedStorefrontId, clear: clearSelection, select: () => undefined }
        },
        { provide: MsalExternalAuthService, useValue: { logoutRedirect: () => Promise.resolve() } },
        { provide: ThemeService, useValue: { preference: () => 'dark', setPreference: () => undefined } },
        { provide: MenuController, useValue: { open: openMenu, close: () => Promise.resolve(true) } },
        { provide: PushNotificationsService, useValue: { init: initPush } },
        {
          provide: MemberNotificationsApiService,
          useValue: { browse: () => of({ unreadCount: 0, page: { items: [] } }) }
        }
      ]
    });
    beforeRender?.();
    fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    ensureLoaded = jasmine.createSpy('ensureLoaded').and.resolveTo(undefined);
    status = jasmine.createSpy('status').and.returnValue('loaded');
    memberships = [];
    selectedStorefrontId = null;
    clearSelection = jasmine.createSpy('clear');
    openMenu = jasmine.createSpy('open').and.resolveTo(true);
    initPush = jasmine.createSpy('init').and.resolveTo(undefined);
  });

  it('triggers a membership load and the push registration on construction', () => {
    create();
    expect(ensureLoaded).toHaveBeenCalledTimes(1);
    expect(initPush).toHaveBeenCalledTimes(1);
  });

  it('renders the router outlet, the notification bell and the legal footer', () => {
    create();
    expect(host().querySelector('router-outlet')).not.toBeNull();
    expect(host().querySelector('app-notification-bell')).not.toBeNull();
    expect(host().querySelector('.app-shell__footer')?.textContent).toContain('legal.footer.terms');
  });

  it('renders a drawer link per section of an academy offering both, then the profile', () => {
    selectedStorefrontId = 'sf-1';
    memberships = [membership('sf-1', ['academy', 'classes_schedule', 'carnets_billing', 'club_members'])];
    create();
    const hrefs = Array.from(host().querySelectorAll('.mobile-menu__link')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/academy', '/classes', '/profile']);
    expect(host().querySelector('.brand')?.getAttribute('href')).toBe('/academy');
  });

  it('hides the club list until the member belongs to a club', () => {
    create();
    expect(host().querySelector('app-club-switcher')).toBeNull();
  });

  it('shows the club list once the member belongs to a club', () => {
    memberships = [membership('sf-1', ['classes_schedule', 'carnets_billing', 'club_members'])];
    create();
    expect(host().querySelector('app-club-switcher')).not.toBeNull();
  });

  it('shows the load-error banner when the membership fetch failed', () => {
    status = jasmine.createSpy('status').and.returnValue('error');
    create();
    expect(host().textContent).toContain('shell.loadError');
  });

  it('opens the drawer via the hamburger button', () => {
    create();
    host().querySelector<HTMLButtonElement>('.hamburger')!.click();
    expect(openMenu).toHaveBeenCalledTimes(1);
  });

  describe('when the active club is no longer among the memberships', () => {
    function renderOn(url: string): jasmine.Spy {
      let navigate!: jasmine.Spy;
      create(() => {
        const router = TestBed.inject(Router);
        spyOnProperty(router, 'url').and.returnValue(url);
        navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
      });
      return navigate;
    }

    beforeEach(() => {
      selectedStorefrontId = 'sf-gone';
      memberships = [membership('sf-1', ['classes_schedule', 'carnets_billing', 'club_members'])];
    });

    it("forgets it and leaves that academy's screens for the entry route", () => {
      const navigate = renderOn('/classes/payment-callback?status=ok');
      expect(clearSelection).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledOnceWith('/');
    });

    it('forgets it without navigating away from a screen that is not tied to one club', () => {
      const navigate = renderOn('/clubs');
      expect(clearSelection).toHaveBeenCalledTimes(1);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('waits until the membership list is loaded', () => {
      status = jasmine.createSpy('status').and.returnValue('loading');
      const navigate = renderOn('/academy');
      expect(clearSelection).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  it('keeps the active club while it is still among the memberships', () => {
    selectedStorefrontId = 'sf-1';
    memberships = [membership('sf-1', ['classes_schedule', 'carnets_billing', 'club_members'])];
    create();
    expect(clearSelection).not.toHaveBeenCalled();
  });
});
