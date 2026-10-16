import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { MemberDto } from '../core/models/member';
import { MembersApiService } from '../core/services/members-api';
import { StorefrontContextService } from '../core/services/storefront-context';

type ProfileStatus = 'loading' | 'loaded' | 'error';

// Read-only view of the member's contact data (FirstName/LastName/Phone) in the active club. The club's CRM card
// is the source of truth (Modules.Clients) and only the club edits it, so a member cannot change it here; the
// backend overlays the card onto /me for the selected storefront and falls back to the member's own values.
//
// Payments deliberately do NOT live here: what the parent owes and pays is shown in one place, on
// /academy (academy-payments.ts).
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class ProfileComponent implements OnInit {
  private readonly membersApi = inject(MembersApiService);
  private readonly storefrontContext = inject(StorefrontContextService);

  private readonly _profileStatus = signal<ProfileStatus>('loading');
  private readonly _member = signal<MemberDto | null>(null);

  protected readonly profileStatus = this._profileStatus.asReadonly();
  protected readonly member = this._member.asReadonly();

  // Header identity: full name when the club filled it in, otherwise the account's display name / e-mail.
  protected readonly fullName = computed(() => {
    const m = this._member();
    const name = [m?.firstName, m?.lastName].filter(Boolean).join(' ');
    return name || m?.displayName || m?.email || '';
  });

  protected readonly initials = computed(() => {
    const m = this._member();
    const letters = m?.firstName || m?.lastName
      ? [m?.firstName, m?.lastName].map(part => part?.trim().charAt(0) ?? '')
      : this.fullName().split(/\s+/).slice(0, 2).map(part => part.charAt(0));
    return letters.join('').toUpperCase();
  });

  ngOnInit(): void {
    void this.loadProfile();
  }

  protected retryLoadProfile(): void {
    void this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    this._profileStatus.set('loading');
    try {
      const storefrontId = this.storefrontContext.selectedStorefrontId() ?? undefined;
      this._member.set(await firstValueFrom(this.membersApi.getMe(storefrontId)));
      this._profileStatus.set('loaded');
    } catch {
      this._profileStatus.set('error');
    }
  }
}
