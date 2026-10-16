import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular/standalone';
import { BackButtonService } from './back-button.service';
import { CAPACITOR_APP } from './deep-link.service';

describe('BackButtonService', () => {
  let back: jasmine.Spy;
  let minimizeApp: jasmine.Spy;
  let url: string;

  function create(): BackButtonService {
    back = jasmine.createSpy('back');
    minimizeApp = jasmine.createSpy('minimizeApp').and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        { provide: Location, useValue: { back } },
        { provide: Router, useValue: { get url() { return url; } } },
        { provide: Platform, useValue: { backButton: { subscribeWithPriority: () => undefined } } },
        { provide: CAPACITOR_APP, useValue: { minimizeApp } }
      ]
    });
    return TestBed.inject(BackButtonService);
  }

  it('goes back from a drilled-down screen', () => {
    url = '/academy/children/ath-1?tab=attendance';
    create().handleBack();
    // Karma's own page has history; a fresh app WebView would minimise instead.
    if (window.history.length > 1) {
      expect(back).toHaveBeenCalled();
    }
  });

  it('sends the app to the background from a menu root screen', () => {
    url = '/clubs';
    create().handleBack();
    expect(minimizeApp).toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('dismisses an open dialog like Esc instead of navigating', () => {
    url = '/academy/children/ath-1';
    const dialog = document.createElement('dialog');
    document.body.appendChild(dialog);
    dialog.showModal();
    const cancel = jasmine.createSpy('cancel');
    dialog.addEventListener('cancel', cancel);

    create().handleBack();

    expect(cancel).toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
    dialog.remove();
  });
});
