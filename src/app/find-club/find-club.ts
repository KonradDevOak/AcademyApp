import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of, tap } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { ClubDiscoveryResultDto } from '../core/models/storefront';
import { sectionLabelKey, sectionsOf } from '../core/services/active-sections';
import { ClubDiscoveryService, ClubSearch } from '../core/services/club-discovery';
import { MembershipContextService } from '../core/services/membership-context';
import { GEOLOCATION_PLUGIN } from '../core/native/geolocation';
import { QrJoinComponent } from './qr-join/qr-join';

type FinderStatus = 'loading' | 'loaded' | 'error';
type LocationState = 'off' | 'locating' | 'on' | 'denied';

const SEARCH_DEBOUNCE_MS = 300;

// Academy finder — join another academy without visiting its website. A name/address search and, when the
// member shares their location, the nearest academies (within 30 km, sorted by distance). Lists only academies
// with at least one section fully switched on (requireReadiness); each result shows the sections it offers.
// A result opens the academy card, where joining happens. Also the landing page for a member of no academy yet.
// Native extra: scanning the academy's QR code (QrJoinComponent) opens its card directly.
@Component({
  selector: 'app-find-club',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, QrJoinComponent],
  templateUrl: './find-club.html',
  styleUrl: './find-club.scss'
})
export class FindClubComponent implements OnInit {
  private readonly discovery = inject(ClubDiscoveryService);
  private readonly membershipContext = inject(MembershipContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly geolocation = inject(GEOLOCATION_PLUGIN);

  private readonly queries = new Subject<ClubSearch>();
  private readonly _status = signal<FinderStatus>('loading');
  private readonly _results = signal<ClubDiscoveryResultDto[]>([]);
  private readonly _search = signal('');
  private readonly _location = signal<LocationState>('off');
  private coords: { latitude: number; longitude: number } | null = null;

  protected readonly status = this._status.asReadonly();
  protected readonly results = this._results.asReadonly();
  protected readonly search = this._search.asReadonly();
  protected readonly location = this._location.asReadonly();
  protected readonly hasClubs = computed(() => this.membershipContext.memberships().length > 0);

  private readonly memberIds = computed(
    () => new Set(this.membershipContext.memberships().map((m) => m.storefrontId))
  );

  protected readonly sectionsOf = sectionsOf;
  protected readonly sectionLabelKey = sectionLabelKey;

  constructor() {
    void this.membershipContext.ensureLoaded();
    this.queries
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        tap(() => this._status.set('loading')),
        switchMap((query) =>
          this.discovery.search(query).pipe(
            catchError((error) => {
              console.error('Club search failed:', error);
              return of(null);
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((results) => {
        if (results === null) {
          this._status.set('error');
          return;
        }
        this._results.set(results);
        this._status.set('loaded');
      });
  }

  ngOnInit(): void {
    this.emit();
  }

  protected isMember(club: ClubDiscoveryResultDto): boolean {
    return this.memberIds().has(club.id);
  }

  protected onSearch(value: string): void {
    this._search.set(value);
    this.emit();
  }

  protected retry(): void {
    this._status.set('loading');
    this.discovery.search(this.query()).subscribe({
      next: (results) => {
        this._results.set(results);
        this._status.set('loaded');
      },
      error: () => this._status.set('error')
    });
  }

  protected toggleLocation(): void {
    if (this._location() === 'on') {
      this.coords = null;
      this._location.set('off');
      this.emit();
      return;
    }
    this._location.set('locating');
    void this.locate();
  }

  private async locate(): Promise<void> {
    try {
      const permission = await this.geolocation.checkPermissions();
      if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
        const requested = await this.geolocation.requestPermissions({ permissions: ['coarseLocation'] });
        if (requested.location !== 'granted' && requested.coarseLocation !== 'granted') {
          this._location.set('denied');
          return;
        }
      }
      const position = await this.geolocation.getCurrentPosition({ maximumAge: 5 * 60 * 1000, timeout: 10000 });
      this.coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      this._location.set('on');
      this.emit();
    } catch {
      this._location.set('denied');
    }
  }

  private query(): ClubSearch {
    return {
      search: this._search(),
      latitude: this.coords?.latitude,
      longitude: this.coords?.longitude
    };
  }

  private emit(): void {
    this.queries.next(this.query());
  }
}
