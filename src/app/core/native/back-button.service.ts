import { DOCUMENT, Location } from '@angular/common';
import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular/standalone';
import { CAPACITOR_APP } from './deep-link.service';

// Screens a member reaches from the menu rather than by drilling down — the hardware back button sends
// the app to the background there, like any Android app's home screen, instead of walking back through
// the menu history.
const ROOT_ROUTES = ['/', '/login', '/clubs', '/find-club', '/profile', '/academy', '/classes'];

// Android hardware back button. Ionic already closes an open ion-menu/overlay at a higher priority;
// this dismisses an open native <dialog> (the ported confirm dialogs) the way Esc does — a `cancel` event
// the dialog component turns into its own `dismissed` output — then walks the history.
@Injectable({ providedIn: 'root' })
export class BackButtonService {
  private readonly platform = inject(Platform);
  private readonly document = inject(DOCUMENT);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly app = inject(CAPACITOR_APP);
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.platform.backButton.subscribeWithPriority(10, () => this.zone.run(() => this.handleBack()));
  }

  handleBack(): void {
    const openDialog = this.document.querySelector<HTMLDialogElement>('dialog[open]');
    if (openDialog) {
      openDialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      return;
    }

    const path = this.router.url.split(/[?#]/)[0];
    if (ROOT_ROUTES.includes(path) || window.history.length <= 1) {
      void this.app.minimizeApp();
      return;
    }
    this.location.back();
  }
}
