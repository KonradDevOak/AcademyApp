import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

// Scroll container for the screens outside the authenticated shell (login, invitation, legal pages) —
// Ionic locks the document's own scrolling, so every screen needs an ion-content around it.
@Component({
  selector: 'app-public-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, RouterOutlet],
  template: `<ion-content><router-outlet /></ion-content>`,
  styles: `
    ion-content::part(scroll) {
      padding-top: var(--ion-safe-area-top, 0px);
      padding-bottom: var(--ion-safe-area-bottom, 0px);
    }
  `
})
export class PublicLayoutComponent {}
