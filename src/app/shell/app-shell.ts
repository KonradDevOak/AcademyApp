import { ChangeDetectionStrategy, Component, effect, inject, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { IonContent, IonHeader, IonMenu, MenuController } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { NotificationBellComponent } from '../components/notification-bell/notification-bell.component';
import { PushNotificationsService } from '../core/services/push-notifications.service';
import { ActiveSectionsService } from '../core/services/active-sections';
import { MembershipContextService } from '../core/services/membership-context';
import { StorefrontContextService } from '../core/services/storefront-context';
import { MobileMenuContentComponent } from './mobile-menu-content/mobile-menu-content';

// Authenticated layout, the phone layout of AcademyWeb's app shell: a header with the brand and a
// hamburger opening a right-hand drawer (ion-menu) with the section links, the club list, theme and
// logout — plus the native notification bell. Routed content scrolls inside one ion-content with the
// legal footer under it, like a web page; /login and the other public screens stay outside the shell.
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    TranslatePipe,
    IonMenu,
    IonHeader,
    IonContent,
    MobileMenuContentComponent,
    NotificationBellComponent
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss'
})
export class AppShellComponent {
  private readonly membershipContext = inject(MembershipContextService);
  private readonly activeSections = inject(ActiveSectionsService);
  private readonly storefrontContext = inject(StorefrontContextService);
  private readonly menu = inject(MenuController);
  private readonly router = inject(Router);
  private readonly content = viewChild<IonContent>('content');

  protected readonly status = this.membershipContext.status;
  protected readonly homePath = this.activeSections.homePath;

  constructor() {
    // Idempotent — the guard usually triggers the fetch first, but a deep-link to a route without
    // the guard (or the guard's fail-open path) still needs the header populated.
    void this.membershipContext.ensureLoaded();

    // Prompts for push permission only once the member is signed in (the shell sits behind CustomerGuard).
    void inject(PushNotificationsService).init();

    // One scroll container for every screen — start each newly opened screen at its top, as a page load would.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => void this.content()?.scrollToTop(0));

    // The active club can drop out of the list on a background refresh (the member left on another
    // device, the owner removed them, the club closed). Forget it and, if one of its screens is open,
    // go back to the entry route so the guards pick the next club, instead of leaving a screen whose
    // API calls the backend will now refuse.
    effect(() => {
      if (this.membershipContext.status() !== 'loaded') {
        return;
      }
      const selectedId = this.storefrontContext.selectedStorefrontId();
      const memberships = this.membershipContext.memberships();
      if (!selectedId || memberships.some((m) => m.storefrontId === selectedId)) {
        return;
      }
      untracked(() => {
        this.storefrontContext.clear();
        if (isClubScopedUrl(this.router.url)) {
          void this.router.navigateByUrl('/');
        }
      });
    });
  }

  protected openMobileMenu(): void {
    void this.menu.open();
  }
}

function isClubScopedUrl(url: string): boolean {
  return /^\/(academy|classes)(\/|\?|#|$)/.test(url);
}
