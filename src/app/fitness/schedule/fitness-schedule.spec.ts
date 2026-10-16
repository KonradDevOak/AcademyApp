import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { ClassesApiService, MemberSessionDto } from '@konraddevoak/fitness-api';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { FitnessScheduleComponent } from './fitness-schedule';

function session(id: string, overrides: Partial<MemberSessionDto> = {}): MemberSessionDto {
  return {
    id,
    classTypeId: 'ct',
    classTypeName: `Zajęcia ${id}`,
    roomId: 'r',
    roomName: 'Sala',
    trainerId: 't',
    trainerName: 'Trener',
    startsAt: `2026-10-1${id}T16:00:00Z`,
    endsAt: `2026-10-1${id}T17:00:00Z`,
    capacity: 10,
    seatsRemaining: 5,
    canEnrollManually: true,
    manualEnrollmentOpensAt: '2026-10-10T00:00:00Z',
    ...overrides
  };
}

describe('FitnessScheduleComponent', () => {
  let fixture: ComponentFixture<FitnessScheduleComponent>;
  let api: jasmine.SpyObj<ClassesApiService>;

  async function create(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ClassesApiService, useValue: api },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: () => 'sf-1' } }
      ]
    });
    fixture = TestBed.createComponent(FitnessScheduleComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<ClassesApiService>([
      'getSessions', 'getMyEnrollments', 'getMyMakeupCredits', 'enroll', 'unenroll', 'joinWaitlist',
      'leaveWaitlist', 'reportAbsence', 'redeemMakeupCredit'
    ]);
    api.getSessions.and.returnValue(of([session('2'), session('1', { seatsRemaining: 0 })]));
    api.getMyEnrollments.and.returnValue(of([
      { id: 'e', sessionId: '2', status: 'Confirmed', source: 'Manual', enrolledAt: '2026-10-01T00:00:00Z' }
    ]));
    api.getMyMakeupCredits.and.returnValue(of([]));
  });

  it('lists sessions soonest first with enroll state and the waitlist for a full one', async () => {
    await create();

    const titles = Array.from(root().querySelectorAll('.fitness-schedule__title')).map((e) => e.textContent?.trim());
    expect(titles).toEqual(['Zajęcia 1', 'Zajęcia 2']);
    expect(root().textContent).toContain('fitness.schedule.joinWaitlist');
    expect(root().textContent).toContain('fitness.schedule.enrolled');
  });

  it('marks a session as waitlisted after joining its waitlist', async () => {
    api.joinWaitlist.and.returnValue(of(undefined));
    await create();
    const component = fixture.componentInstance as unknown as {
      joinWaitlist(s: MemberSessionDto): Promise<void>;
      isWaitlisted(s: MemberSessionDto): boolean;
    };

    await component.joinWaitlist(session('1', { seatsRemaining: 0 }));

    expect(component.isWaitlisted(session('1'))).toBeTrue();
  });

  it('shows the mapped error when enrolling fails', async () => {
    api.enroll.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { errors: [{ code: 'member_booking_blocked', message: 'x' }] }
    })));
    await create();
    const component = fixture.componentInstance as unknown as {
      enroll(s: MemberSessionDto): void;
      actionError(): string | null;
    };

    component.enroll(session('3'));
    await fixture.whenStable();

    expect(component.actionError()).toBe('fitness.errors.bookingBlocked');
  });
});
