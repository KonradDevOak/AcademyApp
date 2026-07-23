import { Component, OnInit, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { people, person, calendarOutline, cardOutline } from 'ionicons/icons';
import { PushNotificationsService } from '../core/services/push-notifications.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class TabsPage implements OnInit {
  private pushNotifications = inject(PushNotificationsService);

  constructor() {
    addIcons({ people, person, calendarOutline, cardOutline });
  }

  ngOnInit() {
    // Fires only after CustomerGuard (on the parent 'tabs' route) has already confirmed login — the
    // permission prompt should only ever appear for an authenticated member.
    this.pushNotifications.init().catch((error: unknown) => console.error('Push init failed:', error));
  }
}
