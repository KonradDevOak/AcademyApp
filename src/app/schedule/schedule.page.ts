import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, forkJoin, of } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonSegmentView,
  IonSegmentContent,
  IonLabel,
  IonList,
  IonItem,
  IonIcon,
  IonButton,
  IonBadge,
  IonText,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  ActionSheetController,
  ToastController,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, peopleOutline, timeOutline, alertCircleOutline } from 'ionicons/icons';
import { ClassesApiService } from '../core/services/classes-api.service';
import { MembersApiService } from '../core/services/members-api.service';
import { StorefrontContextService } from '../core/services/storefront-context.service';
import { MakeupCreditDto, MemberSessionDto, MyEnrollmentDto } from '../core/models/classes.model';
import { getErrorCode } from '../core/utils/consent-error.util';

type ScheduleSegment = 'sessions' | 'enrollments' | 'makeupCredits';

@Component({
  selector: 'app-schedule',
  templateUrl: 'schedule.page.html',
  styleUrls: ['schedule.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonSegmentView,
    IonSegmentContent,
    IonLabel,
    IonList,
    IonItem,
    IonIcon,
    IonButton,
    IonBadge,
    IonText,
    IonSpinner,
    IonRefresher,
    IonRefresherContent
  ]
})
export class SchedulePage implements OnInit {
  private classesApi = inject(ClassesApiService);
  private membersApi = inject(MembersApiService);
  private storefrontContext = inject(StorefrontContextService);
  private actionSheetController = inject(ActionSheetController);
  private toastController = inject(ToastController);

  storefrontId: string | null = null;
  activeStorefrontName: string | null = null;
  hasNoClubs = false;
  isLoading = true;
  segment: ScheduleSegment = 'sessions';
  private hasSetInitialSegment = false;

  sessions: MemberSessionDto[] = [];
  enrollments: MyEnrollmentDto[] = [];
  makeupCredits: MakeupCreditDto[] = [];

  // Backend error codes from Modules.Classes.Core/Classes/Exceptions/, all mapped to the same generic
  // shape by ExceptionToResponseMapper — kept here rather than in the shared consent-error util since
  // they're specific to this page's enroll/waitlist/makeup-credit endpoints, not reused elsewhere.
  private readonly enrollErrorMessages: Record<string, string> = {
    auto_enrollment_window_still_open: 'Zapisy na te zajęcia jeszcze się nie otworzyły.',
    member_booking_blocked: 'Twoje konto ma zablokowane zapisy — sprawdź płatność za karnet.',
    session_full: 'Brak wolnych miejsc — spróbuj zapisać się na listę rezerwową.',
    already_enrolled: 'Jesteś już zapisany/a na te zajęcia.'
  };

  constructor() {
    addIcons({ calendarOutline, peopleOutline, timeOutline, alertCircleOutline });
  }

  ngOnInit() {
    this.load();
  }

  private load(refresherEvent?: RefresherCustomEvent) {
    this.isLoading = !refresherEvent;
    this.membersApi.getMyMemberships().subscribe({
      next: async (memberships) => {
        const storefrontId = await this.storefrontContext.resolve(memberships);
        this.storefrontId = storefrontId;
        this.activeStorefrontName = memberships.find((m) => m.storefrontId === storefrontId)?.storefrontName ?? null;
        this.hasNoClubs = memberships.length === 0;

        if (!storefrontId) {
          this.isLoading = false;
          refresherEvent?.target.complete();
          return;
        }

        this.loadScheduleData(storefrontId, refresherEvent);
      },
      error: (error: unknown) => {
        console.error('Failed to load memberships:', error);
        this.isLoading = false;
        refresherEvent?.target.complete();
      }
    });
  }

  private loadScheduleData(storefrontId: string, refresherEvent?: RefresherCustomEvent) {
    const from = this.formatDate(new Date());
    const to = this.formatDate(this.addDays(new Date(), 14));

    forkJoin({
      sessions: this.classesApi.getSessions(storefrontId, from, to).pipe(
        catchError((error: unknown) => {
          console.error('Failed to load sessions:', error);
          return of([] as MemberSessionDto[]);
        })
      ),
      enrollments: this.classesApi.getMyEnrollments(storefrontId).pipe(
        catchError((error: unknown) => {
          console.error('Failed to load enrollments:', error);
          return of([] as MyEnrollmentDto[]);
        })
      ),
      makeupCredits: this.classesApi.getMyMakeupCredits(storefrontId).pipe(
        catchError((error: unknown) => {
          console.error('Failed to load makeup credits:', error);
          return of([] as MakeupCreditDto[]);
        })
      )
    }).subscribe(({ sessions, enrollments, makeupCredits }) => {
      this.sessions = sessions;
      this.enrollments = enrollments;
      this.makeupCredits = makeupCredits;

      if (!this.hasSetInitialSegment) {
        this.segment = this.computeDefaultSegment();
        this.hasSetInitialSegment = true;
      }

      this.isLoading = false;
      refresherEvent?.target.complete();
    });
  }

  private computeDefaultSegment(): ScheduleSegment {
    const confirmedEnrollments = this.enrollments.filter((e) => e.status === 'Confirmed');
    const availableCredits = this.makeupCredits.filter((c) => c.status === 'Available');

    if (confirmedEnrollments.length === 0 && availableCredits.length === 0) {
      return 'sessions';
    }

    if (confirmedEnrollments.length > 0 && availableCredits.length === 0) {
      return 'enrollments';
    }

    if (confirmedEnrollments.length === 0 && availableCredits.length > 0) {
      return 'makeupCredits';
    }

    const nearestEnrollmentDate = this.nearestDate(
      confirmedEnrollments.map((e) => this.sessionDateTime(e.sessionId)).filter((d): d is Date => d !== null)
    );
    const nearestCreditExpiry = this.nearestDate(availableCredits.map((c) => new Date(c.expiresAt)));

    if (nearestEnrollmentDate && nearestCreditExpiry) {
      return nearestEnrollmentDate.getTime() <= nearestCreditExpiry.getTime() ? 'enrollments' : 'makeupCredits';
    }
    return nearestEnrollmentDate ? 'enrollments' : nearestCreditExpiry ? 'makeupCredits' : 'enrollments';
  }

  private sessionDateTime(sessionId: string): Date | null {
    const session = this.sessions.find((s) => s.id === sessionId);
    return session ? new Date(`${session.date}T${session.startTime}`) : null;
  }

  private nearestDate(dates: Date[]): Date | null {
    return dates.length === 0 ? null : new Date(Math.min(...dates.map((d) => d.getTime())));
  }

  refresh(event: RefresherCustomEvent) {
    this.load(event);
  }

  enrollmentFor(sessionId: string): MyEnrollmentDto | undefined {
    return this.enrollments.find((e) => e.sessionId === sessionId);
  }

  isWaitlisted(enrollment: MyEnrollmentDto): boolean {
    return enrollment.status.toLowerCase().includes('wait');
  }

  enroll(session: MemberSessionDto) {
    this.classesApi.enroll(session.id).subscribe({
      next: () => this.loadScheduleData(this.storefrontId!),
      error: (error: HttpErrorResponse) => {
        console.error('Failed to enroll:', error);
        this.showToast(this.enrollErrorMessage(error, 'Nie udało się zapisać. Spróbuj ponownie.'), 'danger');
      }
    });
  }

  joinWaitlist(session: MemberSessionDto) {
    this.classesApi.joinWaitlist(session.id).subscribe({
      next: () => this.loadScheduleData(this.storefrontId!),
      error: (error: HttpErrorResponse) => {
        console.error('Failed to join waitlist:', error);
        this.showToast(this.enrollErrorMessage(error, 'Nie udało się dołączyć do listy rezerwowej.'), 'danger');
      }
    });
  }

  unenroll(enrollment: MyEnrollmentDto) {
    const action = this.isWaitlisted(enrollment)
      ? this.classesApi.leaveWaitlist(enrollment.sessionId)
      : this.classesApi.unenroll(enrollment.sessionId);

    action.subscribe({
      next: () => this.loadScheduleData(this.storefrontId!),
      error: (error: HttpErrorResponse) => {
        console.error('Failed to unenroll:', error);
        this.showToast(this.enrollErrorMessage(error, 'Nie udało się wypisać. Spróbuj ponownie.'), 'danger');
      }
    });
  }

  reportAbsence(enrollment: MyEnrollmentDto) {
    this.classesApi.reportAbsence(enrollment.sessionId).subscribe({
      next: async () => {
        await this.showToast('Zgłoszono nieobecność.', 'success');
        this.loadScheduleData(this.storefrontId!);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to report absence:', error);
        this.showToast(this.enrollErrorMessage(error, 'Nie udało się zgłosić nieobecności.'), 'danger');
      }
    });
  }

  async redeemMakeupCredit(credit: MakeupCreditDto) {
    const upcoming = this.sessions.filter((s) => s.seatsRemaining > 0);
    if (upcoming.length === 0) {
      await this.showToast('Brak dostępnych zajęć do wykorzystania odrobienia.', 'danger');
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      header: 'Wybierz zajęcia do odrobienia',
      buttons: [
        ...upcoming.map((session) => ({
          text: `${session.classTypeName} — ${session.date} ${session.startTime.substring(0, 5)}`,
          handler: () => {
            this.classesApi.redeemMakeupCredit(credit.id, session.id).subscribe({
              next: () => {
                this.showToast('Odrobienie wykorzystane.', 'success');
                this.loadScheduleData(this.storefrontId!);
              },
              error: (error: HttpErrorResponse) => {
                console.error('Failed to redeem makeup credit:', error);
                this.showToast(this.enrollErrorMessage(error, 'Nie udało się wykorzystać odrobienia.'), 'danger');
              }
            });
          }
        })),
        { text: 'Anuluj', role: 'cancel' }
      ]
    });
    await actionSheet.present();
  }

  private enrollErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const code = getErrorCode(error);
    return (code && this.enrollErrorMessages[code]) ?? fallback;
  }

  private async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({ message, duration: 3000, color, position: 'top' });
    await toast.present();
  }

  private formatDate(date: Date): string {
    return date.toISOString().substring(0, 10);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
