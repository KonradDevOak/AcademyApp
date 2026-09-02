import { Component, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { people, person, calendarOutline, cardOutline, bodyOutline } from 'ionicons/icons';
import { PushNotificationsService } from '../core/services/push-notifications.service';
import { MembershipsCacheService } from '../core/services/memberships-cache.service';
import { ActiveVerticalService } from '../core/services/active-vertical.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, TranslatePipe],
})
export class TabsPage implements OnInit {
  private pushNotifications = inject(PushNotificationsService);
  private membershipsCache = inject(MembershipsCacheService);
  private activeVertical = inject(ActiveVerticalService);

  // Drives which tab-button set the bar renders — 'fitness' (schedule/karnet) or 'academy'
  // (moje dzieci). Defaults to 'fitness' until memberships load.
  readonly vertical = toSignal(this.activeVertical.activeVertical$, { initialValue: 'fitness' as const });

  constructor() {
    addIcons({ people, person, calendarOutline, cardOutline, bodyOutline });
  }

  ngOnInit() {
    // Fires only after CustomerGuard (on the parent 'tabs' route) has already confirmed login — the
    // permission prompt should only ever appear for an authenticated member.
    this.pushNotifications.init().catch((error: unknown) => console.error('Push init failed:', error));

    // Cache-first (see MembershipsCacheService) — populates StorefrontContextService's
    // activeClubBackground$ for every tab up front, instead of only once the Kluby tab happens to be
    // visited (clubs.page does its own load too, but that page may never mount this session). Also
    // feeds ActiveVerticalService so the tab bar can pick the right button set.
    this.membershipsCache.getOrRefresh().catch((error: unknown) => console.error('Memberships load failed:', error));
  }
}
