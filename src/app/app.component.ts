import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ClubBackgroundComponent } from './components/club-background/club-background.component';
import { DeepLinkService } from './core/services/deep-link.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, ClubBackgroundComponent],
})
export class AppComponent {
  // Injecting DeepLinkService registers its appUrlOpen listener; initialize() also drains a
  // cold-start launch URL (app opened by tapping the parent-invitation link).
  private deepLink = inject(DeepLinkService);

  constructor() {
    void this.deepLink.initialize();
  }
}
