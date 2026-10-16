import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AcademyApiService, AthleteDetailsDto, dayKey, formatZloty } from '@konraddevoak/academy-api';
import { CarnetsApiService, ClassesApiService, carnetStatusKey } from '@konraddevoak/fitness-api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MembershipDto } from '../core/models/member';
import { sectionsOf } from '../core/services/active-sections';
import { nextOccurrence } from '../academy/next-session';
import { formatDate, formatDayTime } from '../fitness/fitness-format';

// One line of a tile's status summary: an i18n key plus its params; `tone` picks the badge-like colour.
export interface SummaryLine {
  key: string;
  params?: Record<string, unknown>;
  // Params that are themselves i18n keys (e.g. a day of the week) — translated at render time.
  keyParams?: Record<string, string>;
  tone?: 'ok' | 'due' | 'muted';
}

const DAY_MS = 24 * 60 * 60 * 1000;

// At-a-glance state of one academy on the "Moje akademie" dashboard, loaded lazily per tile from the same
// per-academy endpoints the section screens use (there is no cross-academy summary endpoint — a member
// belongs to a handful at most). One block per section the academy offers, groups first: the nearest
// training of any child and an unpaid current period; then carnet status/validity and the nearest enrolled
// class. A failing section is just left out — the summary is decoration, never a reason to break the
// dashboard.
@Component({
  selector: 'app-club-tile-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    @for (line of lines(); track line.key) {
      <span class="club-summary__line" [class]="'club-summary__line--' + (line.tone ?? 'muted')">
        {{ line.key | translate: paramsOf(line) }}
      </span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      font-size: 0.8rem;
    }
    .club-summary__line--muted {
      color: var(--text-muted);
    }
    .club-summary__line--ok {
      color: var(--ok);
    }
    .club-summary__line--due {
      color: var(--due);
      font-weight: 600;
    }
  `
})
export class ClubTileSummaryComponent implements OnInit {
  readonly membership = input.required<MembershipDto>();

  private readonly academyApi = inject(AcademyApiService);
  private readonly carnetsApi = inject(CarnetsApiService);
  private readonly classesApi = inject(ClassesApiService);
  private readonly translate = inject(TranslateService);

  private readonly _lines = signal<SummaryLine[]>([]);
  protected readonly lines = this._lines.asReadonly();

  protected paramsOf(line: SummaryLine): Record<string, unknown> | undefined {
    if (!line.keyParams) {
      return line.params;
    }
    const translated: Record<string, unknown> = { ...line.params };
    for (const [name, key] of Object.entries(line.keyParams)) {
      translated[name] = this.translate.instant(key);
    }
    return translated;
  }

  ngOnInit(): void {
    const membership = this.membership();
    const loads = sectionsOf(membership.services).map((section) =>
      (section === 'academy' ? this.loadAcademy(membership.storefrontId) : this.loadFitness(membership.storefrontId))
        .catch((error) => {
          console.error(`Failed to load the ${section} summary:`, error);
          return [] as SummaryLine[];
        })
    );
    void Promise.all(loads).then((blocks) => this._lines.set(blocks.flat()));
  }

  private async loadAcademy(storefrontId: string): Promise<SummaryLine[]> {
    const [athletes, payments] = await Promise.all([
      firstValueFrom(this.academyApi.getMyAthletes(storefrontId)),
      firstValueFrom(this.academyApi.getMyPayments(storefrontId)).catch(() => null)
    ]);
    const lines: SummaryLine[] = [];

    const details = await Promise.all(
      athletes.map((athlete) =>
        firstValueFrom(this.academyApi.getAthlete(storefrontId, athlete.id)).catch(() => null)
      )
    );
    const next = nearestTraining(details.filter((d): d is AthleteDetailsDto => d !== null));
    if (next) {
      lines.push({
        key: 'clubs.summary.nextTraining',
        params: { name: next.firstName, time: next.time },
        keyParams: { day: next.dayKey }
      });
    } else if (athletes.length === 0) {
      lines.push({ key: 'clubs.summary.noChildren' });
    }

    const current = payments?.charges[0];
    if (current && current.status !== 'Paid') {
      lines.push({
        key: 'clubs.summary.due',
        params: { amount: formatZloty(current.remainingGrosze) },
        tone: 'due'
      });
    }
    return lines;
  }

  private async loadFitness(storefrontId: string): Promise<SummaryLine[]> {
    const now = new Date();
    const [carnet, enrollments, sessions] = await Promise.all([
      firstValueFrom(this.carnetsApi.getMyCarnet(storefrontId)),
      firstValueFrom(this.classesApi.getMyEnrollments(storefrontId)).catch(() => []),
      firstValueFrom(
        this.classesApi.getSessions(storefrontId, now.toISOString(), new Date(now.getTime() + 14 * DAY_MS).toISOString())
      ).catch(() => [])
    ]);
    const lines: SummaryLine[] = [];

    if (!carnet) {
      lines.push({ key: 'clubs.summary.noCarnet', tone: 'due' });
    } else if (carnet.status === 'Active') {
      lines.push({ key: 'clubs.summary.carnetUntil', params: { date: formatDate(carnet.currentPeriodEnd) }, tone: 'ok' });
    } else {
      lines.push({
        key: carnetStatusKey(carnet.status),
        tone: carnet.status === 'PaymentFailed' || carnet.status === 'Expired' ? 'due' : 'muted'
      });
    }

    const enrolled = new Set(enrollments.filter((e) => e.status === 'Confirmed').map((e) => e.sessionId));
    const nextClass = sessions
      .filter((s) => enrolled.has(s.id))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    if (nextClass) {
      lines.push({
        key: 'clubs.summary.nextClass',
        params: { name: nextClass.classTypeName, when: formatDayTime(nextClass.startsAt) }
      });
    }
    return lines;
  }
}

function nearestTraining(
  athletes: AthleteDetailsDto[]
): { firstName: string; dayKey: string; time: string } | null {
  let best: { at: Date; firstName: string; dayKey: string; time: string } | null = null;
  for (const athlete of athletes) {
    for (const slot of athlete.enrolledSlots ?? []) {
      const at = nextOccurrence(slot.dayOfWeek, slot.startTime);
      if (!best || at < best.at) {
        best = { at, firstName: athlete.firstName, dayKey: dayKey(slot.dayOfWeek), time: slot.startTime.substring(0, 5) };
      }
    }
  }
  return best;
}
