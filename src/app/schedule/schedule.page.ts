import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
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

  sessions: MemberSessionDto[] = [];
  enrollments: MyEnrollmentDto[] = [];
  makeupCredits: MakeupCreditDto[] = [];

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

    this.classesApi.getSessions(storefrontId, from, to).subscribe({
      next: (sessions) => (this.sessions = sessions),
      error: (error: unknown) => console.error('Failed to load sessions:', error)
    });

    this.classesApi.getMyEnrollments(storefrontId).subscribe({
      next: (enrollments) => (this.enrollments = enrollments),
      error: (error: unknown) => console.error('Failed to load enrollments:', error)
    });

    this.classesApi.getMyMakeupCredits(storefrontId).subscribe({
      next: (credits) => {
        this.makeupCredits = credits;
        this.isLoading = false;
        refresherEvent?.target.complete();
      },
      error: (error: unknown) => {
        console.error('Failed to load makeup credits:', error);
        this.isLoading = false;
        refresherEvent?.target.complete();
      }
    });
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
      error: async () => this.showToast('Nie udało się zapisać. Spróbuj ponownie.', 'danger')
    });
  }

  joinWaitlist(session: MemberSessionDto) {
    this.classesApi.joinWaitlist(session.id).subscribe({
      next: () => this.loadScheduleData(this.storefrontId!),
      error: async () => this.showToast('Nie udało się dołączyć do listy rezerwowej.', 'danger')
    });
  }

  unenroll(enrollment: MyEnrollmentDto) {
    const action = this.isWaitlisted(enrollment)
      ? this.classesApi.leaveWaitlist(enrollment.sessionId)
      : this.classesApi.unenroll(enrollment.sessionId);

    action.subscribe({
      next: () => this.loadScheduleData(this.storefrontId!),
      error: async () => this.showToast('Nie udało się wypisać. Spróbuj ponownie.', 'danger')
    });
  }

  reportAbsence(enrollment: MyEnrollmentDto) {
    this.classesApi.reportAbsence(enrollment.sessionId).subscribe({
      next: async () => {
        await this.showToast('Zgłoszono nieobecność.', 'success');
        this.loadScheduleData(this.storefrontId!);
      },
      error: async () => this.showToast('Nie udało się zgłosić nieobecności.', 'danger')
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
              error: () => this.showToast('Nie udało się wykorzystać odrobienia.', 'danger')
            });
          }
        })),
        { text: 'Anuluj', role: 'cancel' }
      ]
    });
    await actionSheet.present();
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
