import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MenuController } from '@ionic/angular/standalone';
import { provideTranslateService } from '@ngx-translate/core';
import { MsalExternalAuthService } from '@shared/iam-msal-external';
import { ActiveSectionsService } from '../../core/services/active-sections';
import { MembershipContextService } from '../../core/services/membership-context';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { ThemeService } from '../../shared/services/theme.service';
import { MobileMenuContentComponent } from './mobile-menu-content';

describe('MobileMenuContentComponent', () => {
  let fixture: ComponentFixture<MobileMenuContentComponent>;
  let logoutRedirect: jasmine.Spy;
  let setPreference: jasmine.Spy;
  let close: jasmine.Spy;

  function create(): void {
    logoutRedirect = jasmine.createSpy('logoutRedirect').and.resolveTo();
    setPreference = jasmine.createSpy('setPreference');
    close = jasmine.createSpy('close').and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslateService(),
        {
          provide: ActiveSectionsService,
          useValue: { navItems: () => [{ path: '/profile', label: 'shell.nav.profile' }] }
        },
        { provide: MembershipContextService, useValue: { memberships: () => [] } },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: () => null } },
        { provide: MsalExternalAuthService, useValue: { logoutRedirect } },
        { provide: ThemeService, useValue: { preference: () => 'dark', setPreference } },
        { provide: MenuController, useValue: { close } }
      ]
    });
    fixture = TestBed.createComponent(MobileMenuContentComponent);
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders one nav link per nav item', () => {
    create();
    expect(host().querySelectorAll('.mobile-menu__link').length).toBe(1);
  });

  it('closes the drawer when a nav link is clicked', () => {
    create();
    host().querySelector<HTMLAnchorElement>('.mobile-menu__link')!.click();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('offers dark, light and system themes and marks the current one', () => {
    create();
    const options = host().querySelectorAll<HTMLButtonElement>('.mobile-menu__theme-option');
    expect(options.length).toBe(3);
    expect(options[0].classList).toContain('is-active');

    options[2].click();
    expect(setPreference).toHaveBeenCalledWith('system');
  });

  it('logs out via the auth service', () => {
    create();
    fixture.componentInstance['logout']();
    expect(logoutRedirect).toHaveBeenCalledTimes(1);
  });
});
