import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import {
  ClassesApiService,
  MakeupCreditDto,
  MemberSessionDto,
  MyEnrollmentDto,
  makeupCreditStatusKey
} from '@konraddevoak/fitness-api';
import { TranslatePipe } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { fitnessErrorKey, isConsentRequiredError } from '../fitness-errors';
import { formatDate, formatDayTime, formatTime } from '../fitness-format';

type ScheduleStatus = 'loading' | 'loaded' | 'error';
export type ScheduleTab = 'sessions' | 'enrollments' | 'credits';

const HORIZON_DAYS = 14;

// The active fitness club's class schedule for the next 14 days: enroll (once the session's
// auto-enrollment window has closed), waitlist when full, cancel, report an absence (earns a makeup credit
// within the same month) and redeem a makeup credit on a session with free seats.
//
// The API exposes no "am I on the waitlist" read, so waitlist membership is tracked only for the sessions
// joined/left on this screen during the current visit.
@Component({
  selector: 'app-fitness-schedule',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './fitness-schedule.html',
  styleUrl: './fitness-schedule.scss'
})
export class FitnessScheduleComponent implements OnInit {
  private readonly classesApi = inject(ClassesApiService);
  private readonly storefrontContext = inject(StorefrontContextService);

  private readonly _status = signal<ScheduleStatus>('loading');
  private readonly _sessions = signal<MemberSessionDto[]>([]);
  private readonly _enrollments = signal<MyEnrollmentDto[]>([]);
  private readonly _credits = signal<MakeupCreditDto[]>([]);
  private readonly _waitlisted = signal<ReadonlySet<string>>(new Set());
  private readonly _tab = signal<ScheduleTab>('sessions');
  private readonly _busySessionId = signal<string | null>(null);
  private readonly _actionError = signal<string | null>(null);
  private readonly _actionInfo = signal<string | null>(null);
  private readonly _consentRequired = signal(false);
  private readonly _redeemingCreditId = signal<string | null>(null);

  protected readonly status = this._status.asReadonly();
  protected readonly sessions = this._sessions.asReadonly();
  protected readonly tab = this._tab.asReadonly();
  protected readonly busySessionId = this._busySessionId.asReadonly();
  protected readonly actionError = this._actionError.asReadonly();
  protected readonly actionInfo = this._actionInfo.asReadonly();
  protected readonly consentRequired = this._consentRequired.asReadonly();
  protected readonly redeemingCreditId = this._redeemingCreditId.asReadonly();

  protected readonly storefrontId = this.storefrontContext.selectedStorefrontId;

  private readonly confirmedBySession = computed(() => {
    const map = new Map<string, MyEnrollmentDto>();
    for (const enrollment of this._enrollments()) {
      if (enrollment.status === 'Confirmed') {
        map.set(enrollment.sessionId, enrollment);
      }
    }
    return map;
  });

  // Upcoming confirmed enrollments, soonest first (only those inside the loaded 14-day window can be dated).
  protected readonly upcomingEnrollments = computed(() =>
    this._sessions().filter((s) => this.confirmedBySession().has(s.id))
  );

  protected readonly availableCredits = computed(() => this._credits().filter((c) => c.status === 'Available'));
  protected readonly otherCredits = computed(() => this._credits().filter((c) => c.status !== 'Available'));

  protected readonly redeemableSessions = computed(() =>
    this._sessions().filter((s) => s.seatsRemaining > 0 && !this.confirmedBySession().has(s.id))
  );

  protected readonly formatDate = formatDate;
  protected readonly formatDayTime = formatDayTime;
  protected readonly formatTime = formatTime;
  protected readonly makeupCreditStatusKey = makeupCreditStatusKey;

  ngOnInit(): void {
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected selectTab(tab: ScheduleTab): void {
    this._tab.set(tab);
    this._redeemingCreditId.set(null);
  }

  protected isEnrolled(session: MemberSessionDto): boolean {
    return this.confirmedBySession().has(session.id);
  }

  protected isWaitlisted(session: MemberSessionDto): boolean {
    return this._waitlisted().has(session.id);
  }

  protected enroll(session: MemberSessionDto): void {
    void this.runSessionAction(session.id, this.classesApi.enroll(session.id));
  }

  protected unenroll(session: MemberSessionDto): void {
    void this.runSessionAction(session.id, this.classesApi.unenroll(session.id));
  }

  protected reportAbsence(session: MemberSessionDto): void {
    void this.runSessionAction(session.id, this.classesApi.reportAbsence(session.id), 'fitness.schedule.absenceReported');
  }

  protected async joinWaitlist(session: MemberSessionDto): Promise<void> {
    if (await this.runSessionAction(session.id, this.classesApi.joinWaitlist(session.id), 'fitness.schedule.waitlistJoined')) {
      this.setWaitlisted(session.id, true);
    }
  }

  protected async leaveWaitlist(session: MemberSessionDto): Promise<void> {
    if (await this.runSessionAction(session.id, this.classesApi.leaveWaitlist(session.id))) {
      this.setWaitlisted(session.id, false);
    }
  }

  protected startRedeem(credit: MakeupCreditDto): void {
    this._actionError.set(null);
    this._redeemingCreditId.set(this._redeemingCreditId() === credit.id ? null : credit.id);
  }

  protected async redeem(credit: MakeupCreditDto, session: MemberSessionDto): Promise<void> {
    if (await this.runSessionAction(session.id, this.classesApi.redeemMakeupCredit(credit.id, session.id), 'fitness.schedule.creditRedeemed')) {
      this._redeemingCreditId.set(null);
    }
  }

  private setWaitlisted(sessionId: string, on: boolean): void {
    const next = new Set(this._waitlisted());
    if (on) {
      next.add(sessionId);
    } else {
      next.delete(sessionId);
    }
    this._waitlisted.set(next);
  }

  // Returns whether the call succeeded; reloads the schedule after every attempt that changed something.
  private async runSessionAction(sessionId: string, call: Observable<void>, successInfo?: string): Promise<boolean> {
    if (this._busySessionId()) {
      return false;
    }
    this._busySessionId.set(sessionId);
    this._actionError.set(null);
    this._actionInfo.set(null);
    this._consentRequired.set(false);
    try {
      await firstValueFrom(call);
      this._actionInfo.set(successInfo ?? null);
      await this.load(false);
      return true;
    } catch (error) {
      console.error('Schedule action failed:', error);
      this._actionError.set(fitnessErrorKey(error));
      this._consentRequired.set(isConsentRequiredError(error));
      return false;
    } finally {
      this._busySessionId.set(null);
    }
  }

  private async load(showSpinner = true): Promise<void> {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId) {
      this._status.set('error');
      return;
    }

    if (showSpinner) {
      this._status.set('loading');
    }
    const from = new Date();
    const to = new Date(from.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);
    try {
      const [sessions, enrollments, credits] = await Promise.all([
        firstValueFrom(this.classesApi.getSessions(storefrontId, from.toISOString(), to.toISOString())),
        firstValueFrom(this.classesApi.getMyEnrollments(storefrontId)),
        firstValueFrom(this.classesApi.getMyMakeupCredits(storefrontId))
      ]);
      this._sessions.set([...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      this._enrollments.set(enrollments);
      this._credits.set(credits);
      this._status.set('loaded');
    } catch (error) {
      console.error('Failed to load the schedule:', error);
      this._status.set('error');
    }
  }
}
