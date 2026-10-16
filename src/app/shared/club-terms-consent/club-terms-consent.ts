import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { clubSellerName } from '@konraddevoak/club-legal';
import { ClubDiscoveryService } from '../../core/services/club-discovery';

// The "I accept the club's terms" checkbox shown right before an online payment / carnet sign-up, with the
// seller's identity next to it (payment operators require both on the payment screen). The link points at
// whatever terms the club currently runs on — its own document or the default one.
@Component({
  selector: 'app-club-terms-consent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './club-terms-consent.html',
  styleUrl: './club-terms-consent.scss'
})
export class ClubTermsConsentComponent {
  private readonly discovery = inject(ClubDiscoveryService);

  readonly storefrontId = input.required<string>();
  readonly accepted = model(false);

  // Fail-open on a load error: the checkbox still renders (linking to the default terms page), so a
  // transient API hiccup never blocks paying.
  private readonly club = rxResource({
    params: () => this.storefrontId(),
    stream: ({ params: storefrontId }) =>
      forkJoin({
        profile: this.discovery.getProfile(storefrontId).pipe(catchError(() => of(null))),
        documents: this.discovery.getClubDocuments(storefrontId).pipe(catchError(() => of([])))
      })
  });

  protected readonly sellerName = computed(() => {
    const profile = this.club.value()?.profile;
    return profile ? clubSellerName(profile) : null;
  });
  protected readonly nip = computed(() => this.club.value()?.profile?.nip ?? null);
  protected readonly termsUrl = computed(
    () =>
      this.club.value()?.documents.find((d) => d.documentType === 'StudioTerms')?.contentUrl ??
      `/klub/${this.storefrontId()}/regulamin`
  );

  protected toggle(checked: boolean): void {
    this.accepted.set(checked);
  }
}
