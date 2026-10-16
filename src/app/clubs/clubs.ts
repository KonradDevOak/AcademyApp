import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MembershipDto } from '../core/models/member';
import { membershipHome } from '../core/services/active-sections';
import { MembershipContextService } from '../core/services/membership-context';
import { StorefrontContextService } from '../core/services/storefront-context';
import { ThemeService } from '../shared/services/theme.service';
import { ClubTileSummaryComponent } from './club-tile-summary';

// "Moje akademie" — every academy the member belongs to, each tile with a short live summary
// (ClubTileSummaryComponent). Picking a tile makes it the active academy and opens its first section; the
// "Szczegóły" link opens the academy card (consents, health questionnaire, leaving). Also the landing page
// for members of more than one academy and the target of the header's "all academies".
@Component({
  selector: 'app-clubs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, ClubTileSummaryComponent],
  templateUrl: './clubs.html',
  styleUrl: './clubs.scss'
})
export class ClubsComponent {
  private readonly membershipContext = inject(MembershipContextService);
  private readonly storefrontContext = inject(StorefrontContextService);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly status = this.membershipContext.status;
  protected readonly activeId = this.storefrontContext.selectedStorefrontId;

  protected readonly memberships = this.membershipContext.memberships;
  protected readonly hasClubs = computed(() => this.membershipContext.memberships().length > 0);

  constructor() {
    void this.membershipContext.ensureLoaded();
  }

  protected background(membership: MembershipDto): string | null {
    const image = this.themeService.theme() === 'light'
      ? membership.clubBackgroundLightImage ?? membership.clubBackgroundDarkImage
      : membership.clubBackgroundDarkImage ?? membership.clubBackgroundLightImage;
    return image ? `url(${image.url})` : null;
  }

  protected open(membership: MembershipDto): void {
    this.storefrontContext.select(membership.storefrontId);
    void this.router.navigateByUrl(membershipHome(membership));
  }

  protected reload(): void {
    void this.membershipContext.reload();
  }
}
