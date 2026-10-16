import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';

interface LegalSection {
  title: string;
  items: string[];
}

export type PlatformLegalDocument = 'platformTerms' | 'platformPrivacy';

// LocalBiz's own terms/privacy policy of the AcademyApp service (the provider of the portal, not a club).
// Public — reachable before login. The binding text is Polish; other languages show it under a notice.
@Component({
  selector: 'app-platform-legal-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './platform-legal-page.html',
  styleUrl: './legal-page.scss'
})
export class PlatformLegalPageComponent {
  private readonly translate = inject(TranslateService);

  protected readonly document: PlatformLegalDocument =
    inject(ActivatedRoute).snapshot.data['document'] ?? 'platformTerms';

  // The sections are an array value in the dictionary, not a single string; stream() re-emits once the
  // dictionary loads and on every language change.
  protected readonly sections = toSignal(
    this.translate
      .stream(`legal.${this.document}.sections`)
      .pipe(map((value: unknown) => (Array.isArray(value) ? (value as LegalSection[]) : []))),
    { initialValue: [] as LegalSection[] }
  );
}
