import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { ClubPrivacyComponent, ClubTermsComponent } from '@konraddevoak/club-legal';
import { ClubDocumentType } from '../core/models/storefront';
import { ClubDiscoveryService } from '../core/services/club-discovery';
import { environment } from '../../environments/environment';

// Public page with a club's terms or privacy policy — the default document LocalBiz renders from the club's
// public profile, used until the club publishes its own (then this page just points to the club's document).
// This URL is what a club's default consent version links to, so it must stay stable.
@Component({
  selector: 'app-club-legal-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ClubTermsComponent, ClubPrivacyComponent],
  templateUrl: './club-legal-page.html',
  styleUrl: './legal-page.scss'
})
export class ClubLegalPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly discovery = inject(ClubDiscoveryService);
  private readonly location = inject(Location);

  protected readonly storefrontId = this.route.snapshot.paramMap.get('storefrontId') ?? '';
  protected readonly documentType: ClubDocumentType = this.route.snapshot.data['documentType'] ?? 'StudioTerms';
  protected readonly privacyPolicyUrl = `/klub/${this.storefrontId}/polityka-prywatnosci`;
  // The terms quote the member panel's address — the AcademyWeb portal, not the app's own WebView origin.
  protected readonly memberPanelUrl = environment.webAppBaseUrl;

  protected readonly club = rxResource({
    params: () => this.storefrontId,
    stream: ({ params: storefrontId }) =>
      forkJoin({
        profile: this.discovery.getProfile(storefrontId),
        documents: this.discovery.getClubDocuments(storefrontId)
      })
  });

  // Set when the club runs on its own published document instead of the default.
  protected readonly ownDocumentUrl = computed(() => {
    const document = this.club.value()?.documents.find((d) => d.documentType === this.documentType);
    return document && !document.isDefault ? document.contentUrl : null;
  });

  protected back(): void {
    this.location.back();
  }
}
