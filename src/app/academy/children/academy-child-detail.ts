import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import {
  AcademyApiService,
  AthleteDetailsDto,
  AthleteGradeDto,
  AttendanceSessionStatusDto,
  EnrolledSlotDto,
  EnrollmentRequestDto,
  EnrollmentRequestSlotDto,
  MonthlyAttendanceDto,
  SlotWaitlistEntryDto,
  dayKey,
  shortTime
} from '@konraddevoak/academy-api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog';
import { enrollAthleteErrorKey } from '../enroll-athlete-errors';
import { getErrorCode } from '../register-athlete-errors';
import { gradeResultKey, monthKey, sessionStatusKey } from '../academy-labels.pl';
import { nextOccurrence } from '../next-session';
import { AcademyChildPhotoComponent } from './academy-child-photo';
import { AcademyScheduleTileComponent, ScheduleTile } from './academy-schedule-tile';

type DetailStatus = 'loading' | 'loaded' | 'error';
type ChildDetailTab = 'athlete' | 'schedule' | 'attendance' | 'grades';

interface TabDefinition {
  id: ChildDetailTab;
  label: string;
}

// Ports 4 of the native academy-child-detail.page's sections (Zawodnik / Harmonogram / Frekwencja /
// Stopnie) — Opiekun moved to the global "Profil" screen in the header (Member
// is now the single, platform-wide owner of guardian contact data, not a per-storefront entity scoped to
// one child). Płatności is deliberately NOT a tab here: the parent pays one monthly amount for all their
// children, shown in one place on /academy (academy-payments.ts). The native app keeps the segment-view
// permanently mounted with [hidden] because ion-segment binds to it once on connect and a swipe gesture
// would desync otherwise — there is no swipe here, so a plain @switch on an active-tab signal is enough.

// The API sends session instants (startsAt/endsAt, UTC); the pinned @konraddevoak/academy-api release still types
// them as date/startTime/endTime. Local shape until the library is repinned.
type SessionRow = Omit<AttendanceSessionStatusDto, 'date' | 'startTime' | 'endTime'> & { startsAt: string; endsAt: string };

type RequestStatus = EnrollmentRequestDto['status'];

// Pending and Waitlisted are both still open: they lock their slots and the guardian may cancel them.
function isOpenRequest(request: EnrollmentRequestDto): boolean {
  return request.status === 'Pending' || request.status === 'Waitlisted';
}

const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function compareTiles(a: ScheduleTile, b: ScheduleTile): number {
  const day = (t: ScheduleTile) => (t.dayOfWeek ? WEEKDAY_ORDER.indexOf(t.dayOfWeek) : WEEKDAY_ORDER.length);
  return day(a) - day(b) || a.startTime.localeCompare(b.startTime);
}

// UTC instant -> "12.09" on the viewer's calendar (mirrors shortDateOf in the newer academy-api).
function shortDateOf(instant: string): string {
  const d = new Date(instant);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}
@Component({
  selector: 'app-academy-child-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, ConfirmDialogComponent, AcademyChildPhotoComponent, AcademyScheduleTileComponent],
  templateUrl: './academy-child-detail.html',
  styleUrl: './academy-child-detail.scss'
})
export class AcademyChildDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AcademyApiService);
  private readonly storefrontContext = inject(StorefrontContextService);
  private readonly translate = inject(TranslateService);

  protected readonly athleteId = this.route.snapshot.paramMap.get('athleteId') ?? '';

  private readonly _status = signal<DetailStatus>('loading');
  private readonly _athlete = signal<AthleteDetailsDto | null>(null);
  private readonly _attendance = signal<MonthlyAttendanceDto[]>([]);
  private readonly _grades = signal<AthleteGradeDto[]>([]);
  private readonly _waitlistEntries = signal<SlotWaitlistEntryDto[]>([]);
  private readonly _leavingWaitlistEntryId = signal<string | null>(null);
  private readonly _tab = signal<ChildDetailTab>('athlete');
  private readonly _deleteError = signal<string | null>(null);
  private readonly _isDeleting = signal(false);
  private readonly _deleteDialogOpen = signal(false);
  private readonly _enrollmentRequests = signal<EnrollmentRequestDto[]>([]);
  private readonly _cancellingRequestId = signal<string | null>(null);
  private readonly _cancelRequestError = signal<string | null>(null);
  private readonly _withdrawSlot = signal<EnrolledSlotDto | null>(null);
  private readonly _isWithdrawing = signal(false);
  private readonly _withdrawError = signal<string | null>(null);
  private readonly _expandedPeriod = signal<string | null>(null);
  private readonly _periodSessions = signal<SessionRow[]>([]);
  private readonly _sessionsLoading = signal(false);
  private readonly _sessionsError = signal<string | null>(null);
  // In-flight drill-down request — cancelled whenever another month is toggled, so a slow response for
  // a previously expanded month can never overwrite the one now on screen.
  private sessionsRequest: Subscription | null = null;
  private readonly destroyRef = inject(DestroyRef);

  protected readonly status = this._status.asReadonly();
  protected readonly athlete = this._athlete.asReadonly();
  // `photoUrl` has been part of AthleteDetailsDto since @konraddevoak/academy-api 4.3.0; the pinned version may
  // predate it, so it is read through this widened type until the pin catches up.
  protected readonly photoUrl = computed(
    () => (this._athlete() as (AthleteDetailsDto & { photoUrl?: string | null }) | null)?.photoUrl ?? null
  );
  protected readonly attendance = this._attendance.asReadonly();
  protected readonly grades = this._grades.asReadonly();
  protected readonly waitlistEntries = this._waitlistEntries.asReadonly();
  protected readonly leavingWaitlistEntryId = this._leavingWaitlistEntryId.asReadonly();
  protected readonly tab = this._tab.asReadonly();
  protected readonly deleteError = this._deleteError.asReadonly();
  protected readonly isDeleting = this._isDeleting.asReadonly();
  protected readonly deleteDialogOpen = this._deleteDialogOpen.asReadonly();
  protected readonly withdrawSlot = this._withdrawSlot.asReadonly();
  protected readonly isWithdrawing = this._isWithdrawing.asReadonly();
  protected readonly withdrawError = this._withdrawError.asReadonly();
  protected readonly expandedPeriod = this._expandedPeriod.asReadonly();
  // Absence reports from the session drill-down: the session being reported/withdrawn and the last error.
  private readonly _excuseBusySessionId = signal<string | null>(null);
  private readonly _excuseError = signal<string | null>(null);
  protected readonly excuseBusySessionId = this._excuseBusySessionId.asReadonly();
  protected readonly excuseError = this._excuseError.asReadonly();
  protected readonly periodSessions = this._periodSessions.asReadonly();
  protected readonly sessionsLoading = this._sessionsLoading.asReadonly();
  protected readonly sessionsError = this._sessionsError.asReadonly();
  // Newest first, as returned by the API — every status, so the guardian also sees decided requests
  // (with the rejection reason) and ones the club parked on its waitlist (with the club's note).
  protected readonly enrollmentRequests = this._enrollmentRequests.asReadonly();
  protected readonly cancellingRequestId = this._cancellingRequestId.asReadonly();
  protected readonly cancelRequestError = this._cancelRequestError.asReadonly();
  // Decided requests (Approved/Rejected/Cancelled) — open ones live on the schedule tiles instead.
  protected readonly requestHistory = computed(() => this._enrollmentRequests().filter((r) => !isOpenRequest(r)));

  protected readonly scheduleTiles = computed<ScheduleTile[]>(() => {
    const openRequests = this._enrollmentRequests().filter(isOpenRequest);
    const tiles: ScheduleTile[] = [];

    // An enrolled slot stays in enrolledSlots until the operator approves its removal, so an open request
    // removing it turns the tile into "withdrawal pending" with a cancel action instead of a second row.
    for (const slot of this._athlete()?.enrolledSlots ?? []) {
      const request = openRequests.find((r) => r.removeSlotIds.includes(slot.slotId));
      tiles.push({
        key: `slot-${slot.slotId}`,
        state: request ? 'withdrawPending' : 'enrolled',
        groupName: slot.groupName,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slot,
        request,
        otherRequestSlots: request ? this.otherRequestSlots(request, slot.slotId) : undefined
      });
    }

    for (const request of openRequests) {
      for (const slot of request.addSlots) {
        tiles.push({
          key: `request-${request.id}-${slot.slotId}`,
          state: request.status as 'Pending' | 'Waitlisted',
          groupName: slot.groupName,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          request,
          otherRequestSlots: this.otherRequestSlots(request, slot.slotId)
        });
      }
    }

    for (const entry of this._waitlistEntries()) {
      tiles.push({
        key: `waitlist-${entry.id}`,
        state: 'slotWaitlist',
        groupName: entry.groupName,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        waitlistEntry: entry
      });
    }

    return tiles.sort(compareTiles);
  });

  // `day` is translated here rather than in the template because the dialog message interpolates it
  // into a single translation string.
  protected readonly withdrawMessageParams = computed(() => {
    const slot = this._withdrawSlot();
    return slot
      ? {
          group: slot.groupName,
          day: this.translate.instant(dayKey(slot.dayOfWeek)),
          time: `${shortTime(slot.startTime)}–${shortTime(slot.endTime)}`
        }
      : {};
  });

  // `label` is an i18n key (academy.childDetail.tabs.*), rendered through TranslatePipe in the
  // template — not translated text itself.
  protected readonly tabs: readonly TabDefinition[] = [
    { id: 'athlete', label: 'academy.childDetail.tabs.athlete' },
    { id: 'schedule', label: 'academy.childDetail.tabs.schedule' },
    { id: 'attendance', label: 'academy.childDetail.tabs.attendance' },
    { id: 'grades', label: 'academy.childDetail.tabs.grades' }
  ];

  protected readonly dayKey = dayKey;
  protected readonly monthKey = monthKey;
  protected readonly gradeResultKey = gradeResultKey;
  protected readonly sessionStatusKey = sessionStatusKey;
  protected readonly shortTime = shortTime;
  protected readonly shortDateOf = shortDateOf;

  // The API sends awardedAt (a UTC instant); the pinned academy-api release still types it as awardedOn.
  protected awardDate(award: object): string {
    const awardedAt = (award as { awardedAt?: string }).awardedAt;
    if (!awardedAt) return '';
    const d = new Date(awardedAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // UTC instant -> "12.09.2026" on the viewer's calendar.
  protected requestDate(instant: string): string {
    const d = new Date(instant);
    return `${shortDateOf(instant)}.${d.getFullYear()}`;
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.sessionsRequest?.unsubscribe());
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  // After a photo was added, replaced or removed: refetch only the athlete (a fresh signed photo URL) without
  // dropping back to the full-screen loading state.
  protected async reloadAthlete(): Promise<void> {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId) return;
    try {
      this._athlete.set(await firstValueFrom(this.api.getAthlete(storefrontId, this.athleteId)));
    } catch {
      // Keep showing the previous data; the parent can pull-to-retry via the normal retry path.
    }
  }

  protected selectTab(tab: ChildDetailTab): void {
    this._tab.set(tab);
  }

  // An athlete can now span more than one group (AthleteEnrollmentResolver) — join distinct names
  // rather than assuming a single group like the old single-Group shape did. `groups` isn't on the
  // detail DTO (list-endpoint-only field) — derive names from enrolledSlots instead.
  protected groupNames(child: AthleteDetailsDto): string {
    return [...new Set(child.enrolledSlots.map((s) => s.groupName))].join(', ');
  }

  // The brief's "Zajęcia" — the disciplines of the groups the child trains in.
  protected disciplineNames(child: AthleteDetailsDto): string {
    return [...new Set(child.enrolledSlots.map((s) => s.disciplineName).filter((n) => !!n))].join(', ');
  }

  // The brief's "Miejscowość" — the towns of those groups. `locality` is read through a local widening
  // because the pinned @konraddevoak/academy-api release predates the field; harmless once repinned.
  protected localities(child: AthleteDetailsDto): string {
    return [...new Set((child.enrolledSlots as (EnrolledSlotDto & { locality?: string | null })[])
      .map((s) => s.locality?.trim()).filter((l): l is string => !!l))].join(', ');
  }

  // Picks the enrolled slot whose next weekly occurrence is soonest (never null unless the athlete
  // has no enrolledSlots at all) — used for the "Nadchodzące zajęcia" row on the athlete tab.
  protected nextEnrolledSlot(child: AthleteDetailsDto): EnrolledSlotDto | null {
    if (child.enrolledSlots.length === 0) {
      return null;
    }

    return child.enrolledSlots
      .map((slot) => ({ slot, at: nextOccurrence(slot.dayOfWeek, slot.startTime) }))
      .reduce((earliest, candidate) => (candidate.at < earliest.at ? candidate : earliest)).slot;
  }

  // Reuses grades() (already fetched by load(), no extra API call) to summarize only the current
  // grade per discipline — history/awardedAt stay in the dedicated `grades` tab. No `child` parameter
  // needed: grades() is already scoped to this athlete by load().
  protected currentGradeChips(): { disciplineId: string; name: string; colorHex: string }[] {
    return this._grades()
      .filter((g) => g.current)
      .map((g) => ({ disciplineId: g.disciplineId, name: g.current!.name, colorHex: g.current!.colorHex }));
  }

  // The Delete pill is always clickable — with active enrollments the dialog is informational
  // (template picks the mode from sessionsPerWeek), otherwise it asks for confirmation.
  protected openDeleteDialog(): void {
    this._deleteError.set(null);
    this._deleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    if (!this._isDeleting()) {
      this._deleteDialogOpen.set(false);
    }
  }

  // Only reachable from the confirm-mode dialog (sessionsPerWeek is 0), so the
  // AthleteHasActiveEnrollmentsException path from the backend is a defensive fallback, not the
  // expected flow.
  protected confirmDelete(): void {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId || this._isDeleting()) {
      return;
    }

    this._isDeleting.set(true);
    this._deleteError.set(null);
    this.api.deactivateAthlete(storefrontId, this.athleteId).subscribe({
      next: () => void this.router.navigateByUrl('/academy'),
      error: (error: HttpErrorResponse) => {
        console.error('Failed to delete athlete:', error);
        this._isDeleting.set(false);
        this._deleteError.set('academy.childDetail.deleteError');
      }
    });
  }

  protected openWithdrawDialog(slot: EnrolledSlotDto): void {
    this._withdrawError.set(null);
    this._withdrawSlot.set(slot);
  }

  protected closeWithdrawDialog(): void {
    if (!this._isWithdrawing()) {
      this._withdrawSlot.set(null);
    }
  }

  // A parent cannot withdraw a child directly — the backend only lets them file an enrollment request
  // with removeSlotIds, which the operator approves (see ParentAcademyController). The slot therefore
  // stays enrolled until then; load() picks up the new Pending request to show the badge.
  protected confirmWithdraw(): void {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    const slot = this._withdrawSlot();
    if (!storefrontId || !slot || this._isWithdrawing()) {
      return;
    }

    this._isWithdrawing.set(true);
    this._withdrawError.set(null);
    this.api
      .createEnrollmentRequest(this.athleteId, {
        storefrontId,
        addSlotIds: [],
        removeSlotIds: [slot.slotId],
        note: null
      })
      .subscribe({
        next: () => {
          this._isWithdrawing.set(false);
          this._withdrawSlot.set(null);
          void this.load();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Failed to request withdrawal from slot:', error);
          this._isWithdrawing.set(false);
          if (getErrorCode(error) === 'slot_already_pending_request') {
            // A request for this slot already exists (e.g. filed from another tab) — nothing to
            // report, just reload so the row flips to the "pending" badge.
            this._withdrawSlot.set(null);
            void this.load();
            return;
          }
          this._withdrawError.set(enrollAthleteErrorKey(error));
        }
      });
  }

  // Only computed months (Modules.Attendance session data) can ever have sessions to drill into —
  // a frozen, operator-entered month always comes back empty, so the template hides the toggle for
  // those (see academy-child-detail.html).
  protected toggleAttendancePeriod(month: MonthlyAttendanceDto): void {
    this.sessionsRequest?.unsubscribe();
    this.sessionsRequest = null;

    if (this._expandedPeriod() === month.period) {
      this._expandedPeriod.set(null);
      this._sessionsLoading.set(false);
      return;
    }

    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId) {
      return;
    }

    this._expandedPeriod.set(month.period);
    this._periodSessions.set([]);
    this._sessionsLoading.set(true);
    this._sessionsError.set(null);
    this.sessionsRequest = this.api.getAthleteAttendanceSessions(storefrontId, this.athleteId, month.period).subscribe({
      next: (sessions) => {
        this._periodSessions.set(sessions as unknown as SessionRow[]);
        this._sessionsLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to load attendance sessions:', error);
        this._sessionsLoading.set(false);
        this._sessionsError.set('academy.childDetail.attendance.sessionsError');
      }
    });
  }

  // A session can be reported as long as it was neither attended nor already excused and no report awaits a
  // decision; the backend also refuses once the session's month is settled (absence_excuse_not_allowed).
  protected canReportAbsence(session: SessionRow): boolean {
    return (session.status === 'NotRecorded' || session.status === 'Absent')
      && session.absenceExcuseStatus !== 'Pending';
  }

  protected reportAbsence(session: SessionRow): void {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId || this._excuseBusySessionId()) {
      return;
    }

    this._excuseBusySessionId.set(session.sessionId);
    this._excuseError.set(null);
    this.api
      .requestAbsenceExcuse(this.athleteId, { storefrontId, sessionId: session.sessionId, note: null })
      .subscribe({
        next: () => this.reloadPeriodSessions(storefrontId),
        error: (error: HttpErrorResponse) => this.excuseFailed(error)
      });
  }

  protected withdrawAbsence(session: SessionRow): void {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId || !session.absenceExcuseId || this._excuseBusySessionId()) {
      return;
    }

    this._excuseBusySessionId.set(session.sessionId);
    this._excuseError.set(null);
    this.api.cancelAbsenceExcuse(storefrontId, this.athleteId, session.absenceExcuseId).subscribe({
      next: () => this.reloadPeriodSessions(storefrontId),
      error: (error: HttpErrorResponse) => this.excuseFailed(error)
    });
  }

  private excuseFailed(error: HttpErrorResponse): void {
    console.error('Failed to update the absence report:', error);
    this._excuseBusySessionId.set(null);
    this._excuseError.set(getErrorCode(error) === 'absence_excuse_not_allowed'
      ? 'academy.childDetail.attendance.excuseNotAllowed'
      : 'academy.childDetail.attendance.excuseError');
  }

  private reloadPeriodSessions(storefrontId: string): void {
    const period = this._expandedPeriod();
    if (!period) {
      this._excuseBusySessionId.set(null);
      return;
    }

    this.api.getAthleteAttendanceSessions(storefrontId, this.athleteId, period).subscribe({
      next: (sessions) => {
        this._periodSessions.set(sessions as unknown as SessionRow[]);
        this._excuseBusySessionId.set(null);
      },
      error: (error: HttpErrorResponse) => this.excuseFailed(error)
    });
  }

  protected sessionBadgeClass(status: string): string {
    switch (status) {
      case 'Present':
        return 'ok';
      case 'Absent':
        return 'due';
      case 'Excused':
        return 'warn';
      default:
        return 'muted';
    }
  }

  // Same API call as AcademyEnrollAthleteComponent's leaveWaitlist(), reused here for the small
  // "my waitlist entries" view on the schedule tab. Reloads the whole detail (not just the waitlist
  // list) on success so enrolledSlots/waitlistEntries stay consistent if a promotion happened to
  // free up the slot at the same time.
  protected leaveWaitlist(entry: SlotWaitlistEntryDto): void {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId || this._leavingWaitlistEntryId()) {
      return;
    }

    this._leavingWaitlistEntryId.set(entry.id);
    this.api.leaveWaitlist(storefrontId, this.athleteId, entry.trainingSlotId).subscribe({
      next: () => {
        this._leavingWaitlistEntryId.set(null);
        void this.load();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to leave waitlist:', error);
        this._leavingWaitlistEntryId.set(null);
      }
    });
  }

  protected requestBadgeClass(status: RequestStatus): string {
    switch (status) {
      case 'Approved':
        return 'ok';
      case 'Rejected':
        return 'due';
      case 'Waitlisted':
        return 'warn';
      default:
        return 'muted';
    }
  }

  private otherRequestSlots(request: EnrollmentRequestDto, slotId: string): string[] {
    return [...request.addSlots, ...(request.removeSlots ?? [])]
      .filter((s) => s.slotId !== slotId)
      .map((s) => this.requestSlotLabel(s));
  }

  // A slot whose group was deleted since the request was filed comes back without a name.
  protected requestSlotLabel(slot: EnrollmentRequestSlotDto): string {
    const day = slot.dayOfWeek ? this.translate.instant(dayKey(slot.dayOfWeek)) : '';
    return [slot.groupName ?? '—', day, `${shortTime(slot.startTime)}–${shortTime(slot.endTime)}`]
      .filter(Boolean)
      .join(' · ');
  }

  // Cancelling frees the request's slots for a new request — the only way out of a long club waitlist.
  protected cancelRequest(request: EnrollmentRequestDto): void {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId || this._cancellingRequestId()) {
      return;
    }

    this._cancellingRequestId.set(request.id);
    this._cancelRequestError.set(null);
    this.api.cancelEnrollmentRequest(storefrontId, this.athleteId, request.id).subscribe({
      next: () => {
        this._cancellingRequestId.set(null);
        void this.load();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to cancel enrollment request:', error);
        this._cancellingRequestId.set(null);
        this._cancelRequestError.set('academy.childDetail.requests.cancelError');
      }
    });
  }

  private async load(): Promise<void> {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId || !this.athleteId) {
      // Unreachable in practice — activeStorefrontChildGuard redirects before this component loads.
      this._status.set('error');
      return;
    }

    this._status.set('loading');
    try {
      // Only getAthlete is critical; a failing attendance/grades/waitlist call
      // degrades that one tab instead of blanking the whole screen. (A failing enrollment-requests call
      // just hides the "withdrawal pending" badges and the requests list.)
      const result = await firstValueFrom(
        forkJoin({
          athlete: this.api.getAthlete(storefrontId, this.athleteId),
          attendance: this.api
            .getAthleteAttendance(storefrontId, this.athleteId)
            .pipe(catchError(() => of<MonthlyAttendanceDto[]>([]))),
          grades: this.api
            .getAthleteGrades(storefrontId, this.athleteId)
            .pipe(catchError(() => of<AthleteGradeDto[]>([]))),
          waitlistEntries: this.api
            .getMyWaitlistEntries(storefrontId, this.athleteId)
            .pipe(catchError(() => of<SlotWaitlistEntryDto[]>([]))),
          enrollmentRequests: this.api
            .getMyEnrollmentRequests(storefrontId, this.athleteId)
            .pipe(catchError(() => of<EnrollmentRequestDto[]>([])))
        })
      );

      this._athlete.set(result.athlete);
      this._attendance.set(result.attendance);
      this._grades.set(result.grades);
      this._waitlistEntries.set(result.waitlistEntries);
      this._enrollmentRequests.set(result.enrollmentRequests);
      this._status.set('loaded');
    } catch {
      this._status.set('error');
    }
  }
}
