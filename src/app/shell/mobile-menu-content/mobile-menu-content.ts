import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuController } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { MsalExternalAuthService } from '@shared/iam-msal-external';
import { ActiveSectionsService } from '../../core/services/active-sections';
import { MembershipContextService } from '../../core/services/membership-context';
import { ThemePreference, ThemeService } from '../../shared/services/theme.service';
import { ClubSwitcherComponent } from '../club-switcher/club-switcher';

interface ThemeOption {
  value: ThemePreference;
  icon: string;
  label: string;
}

// Content of the shell's right-hand drawer (ion-menu): section links, the club list, the theme choice
// (dark / light / follow the system) and logout — AcademyWeb's mobile drawer, plus the 'system' theme.
@Component({
  selector: 'app-mobile-menu-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, ClubSwitcherComponent],
  templateUrl: './mobile-menu-content.html',
  styleUrl: './mobile-menu-content.scss'
})
export class MobileMenuContentComponent {
  private readonly activeSections = inject(ActiveSectionsService);
  private readonly membershipContext = inject(MembershipContextService);
  private readonly authService = inject(MsalExternalAuthService);
  private readonly themeService = inject(ThemeService);
  private readonly menu = inject(MenuController);

  protected readonly navItems = this.activeSections.navItems;
  protected readonly hasClubs = computed(() => this.membershipContext.memberships().length > 0);
  protected readonly preference = this.themeService.preference;

  protected readonly themeOptions: readonly ThemeOption[] = [
    { value: 'dark', icon: '🌙', label: 'shell.theme.dark' },
    { value: 'light', icon: '☀', label: 'shell.theme.light' },
    { value: 'system', icon: '◐', label: 'shell.theme.system' }
  ];

  protected navigate(): void {
    void this.menu.close();
  }

  protected setTheme(preference: ThemePreference): void {
    this.themeService.setPreference(preference);
  }

  protected logout(): void {
    void this.menu.close();
    void this.authService.logoutRedirect();
  }
}
