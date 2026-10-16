import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IonApp } from '@ionic/angular/standalone';
import { DeepLinkService } from './core/native/deep-link.service';
import { ExternalLinkService } from './core/native/external-link.service';
import { BackButtonService } from './core/native/back-button.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, RouterOutlet],
})
export class AppComponent {
  private readonly deepLink = inject(DeepLinkService);
  private readonly externalLinks = inject(ExternalLinkService);
  private readonly backButton = inject(BackButtonService);

  constructor() {
    // Registers the appUrlOpen listener and drains a cold-start launch URL (invite / payment return).
    void this.deepLink.initialize();
    this.externalLinks.initialize();
    this.backButton.initialize();
  }
}
