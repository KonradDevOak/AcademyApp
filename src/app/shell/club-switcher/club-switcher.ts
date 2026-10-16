import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MembershipDto } from '../../core/models/member';
import { membershipHome } from '../../core/services/active-sections';
import { MembershipContextService } from '../../core/services/membership-context';
import { StorefrontContextService } from '../../core/services/storefront-context';

// Academy list in the shell's drawer (AcademyWeb's compact switcher): picking an academy makes it active
// and opens its first section — one tap from any screen, no re-login. "All academies" opens the dashboard,
// "Join an academy" the finder; `navigated` lets the drawer close itself.
@Component({
  selector: 'app-club-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './club-switcher.html',
  styleUrl: './club-switcher.scss'
})
export class ClubSwitcherComponent {
  private readonly membershipContext = inject(MembershipContextService);
  private readonly storefrontContext = inject(StorefrontContextService);
  private readonly router = inject(Router);

  readonly navigated = output<void>();

  protected readonly activeId = this.storefrontContext.selectedStorefrontId;
  protected readonly memberships = this.membershipContext.memberships;

  protected choose(membership: MembershipDto): void {
    this.storefrontContext.select(membership.storefrontId);
    this.navigated.emit();
    void this.router.navigateByUrl(membershipHome(membership));
  }

  protected followLink(): void {
    this.navigated.emit();
  }
}
