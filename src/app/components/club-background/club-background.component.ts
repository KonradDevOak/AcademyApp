import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { StorefrontContextService } from '../../core/services/storefront-context.service';
import { ThemeService } from '../../core/services/theme.service';
import { pickBackgroundImage } from '../../core/utils/club-background.util';

// Rendered once in app.component.html, behind ion-router-outlet. Fixed, full-viewport — the 4 tab-root
// pages set their own ion-content to --background: transparent so this shows through. Null when no
// club is active or the active club has no matching background image; the div then has no
// background-image style at all (empty string), so the app looks exactly as it did before this
// feature — see club-background.component.scss for the scrim/gradient overlay.
@Component({
  selector: 'app-club-background',
  templateUrl: 'club-background.component.html',
  styleUrls: ['club-background.component.scss'],
  imports: [CommonModule],
})
export class ClubBackgroundComponent {
  private storefrontContext = inject(StorefrontContextService);
  private themeService = inject(ThemeService);

  readonly backgroundUrl$ = combineLatest([
    this.storefrontContext.activeClubBackground$,
    this.themeService.preference$
  ]).pipe(
    map(([background, preference]) => {
      if (!background) return null;
      return pickBackgroundImage(background.dark, background.light, this.themeService.isDarkFor(preference));
    })
  );
}
