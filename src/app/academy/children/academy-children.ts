import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AcademyApiService, AthleteDto } from '@konraddevoak/academy-api';
import { TranslatePipe } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';

type ListStatus = 'loading' | 'loaded' | 'error';

// Parent's roster for the active club. Component-local state (no shared store) — a fresh instance
// on every navigation re-fetches, which is enough here and consistent with the decision to
// skip a membership cache.
@Component({
  selector: 'app-academy-children',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './academy-children.html',
  styleUrl: './academy-children.scss'
})
export class AcademyChildrenComponent implements OnInit {
  private readonly api = inject(AcademyApiService);
  private readonly storefrontContext = inject(StorefrontContextService);
  private readonly router = inject(Router);

  private readonly _athletes = signal<AthleteDto[]>([]);
  private readonly _status = signal<ListStatus>('loading');

  // Athletes whose photo link failed to load (expired/deleted) — they fall back to initials.
  private readonly failedPhotos = signal<ReadonlySet<string>>(new Set());

  protected readonly athletes = this._athletes.asReadonly();
  protected readonly status = this._status.asReadonly();

  ngOnInit(): void {
    void this.load();
  }

  protected refresh(): void {
    void this.load();
  }

  protected async goToAdd(): Promise<void> {
    await this.router.navigateByUrl('/academy/add');
  }

  // An athlete can span more than one group (AthleteEnrollmentResolver) — join distinct names rather
  // than assuming a single group like the old currentGroupName/currentGroupDisciplineName pair did.
  protected groupNames(athlete: AthleteDto): string {
    return athlete.groups.map((g) => g.name).join(', ');
  }

  // `photoUrl` is on AthleteDto from @konraddevoak/academy-api 4.3.0 on; the widened type keeps this compiling
  // against an older pinned build (same approach as AcademyChildDetailComponent).
  protected photoUrl(athlete: AthleteDto): string | null {
    const url = (athlete as AthleteDto & { photoUrl?: string | null }).photoUrl;
    return url && !this.failedPhotos().has(athlete.id) ? url : null;
  }

  protected onPhotoError(athleteId: string): void {
    this.failedPhotos.update((ids) => new Set(ids).add(athleteId));
  }

  protected disciplineNames(athlete: AthleteDto): string {
    return [...new Set(athlete.groups.map((g) => g.disciplineName))].join(', ');
  }

  private async load(): Promise<void> {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId) {
      // Unreachable in practice — activeStorefrontChildGuard redirects before this component loads.
      this._status.set('error');
      return;
    }

    this._status.set('loading');
    this.failedPhotos.set(new Set());
    try {
      const athletes = await firstValueFrom(this.api.getMyAthletes(storefrontId));
      this._athletes.set(athletes ?? []);
      this._status.set('loaded');
    } catch {
      this._athletes.set([]);
      this._status.set('error');
    }
  }
}
