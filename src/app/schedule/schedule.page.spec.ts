import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActionSheetController, ToastController } from '@ionic/angular/standalone';
import { of, throwError } from 'rxjs';
import { SchedulePage } from './schedule.page';
import { ClassesApiService } from '../core/services/classes-api.service';
import { MembersApiService } from '../core/services/members-api.service';
import { StorefrontContextService } from '../core/services/storefront-context.service';
import { MemberSessionDto } from '../core/models/classes.model';
import { MembershipDto } from '../core/models/member.model';

describe('SchedulePage', () => {
  let fixture: ComponentFixture<SchedulePage>;
  let component: SchedulePage;
  let classesApi: jasmine.SpyObj<ClassesApiService>;
  let membersApi: jasmine.SpyObj<MembersApiService>;
  let storefrontContext: jasmine.SpyObj<StorefrontContextService>;
  let toastController: jasmine.SpyObj<ToastController>;

  const membership: MembershipDto = {
    storefrontId: 'club-1',
    storefrontName: 'Fit Club',
    joinedAt: new Date().toISOString()
  };

  function createSession(overrides: Partial<MemberSessionDto> = {}): MemberSessionDto {
    return {
      id: 'session-1',
      classTypeId: 'type-1',
      classTypeName: 'Yoga',
      roomId: 'room-1',
      roomName: 'Sala 1',
      trainerId: 'trainer-1',
      trainerName: 'Ala',
      date: '2026-08-30',
      startTime: '18:00:00',
      endTime: '19:00:00',
      capacity: 10,
      seatsRemaining: 5,
      canEnrollManually: true,
      manualEnrollmentOpensAt: '2026-08-29T18:00:00Z',
      ...overrides
    };
  }

  beforeEach(async () => {
    classesApi = jasmine.createSpyObj('ClassesApiService', [
      'getSessions',
      'getMyEnrollments',
      'getMyMakeupCredits',
      'enroll',
      'joinWaitlist',
      'unenroll',
      'leaveWaitlist',
      'reportAbsence',
      'redeemMakeupCredit'
    ]);
    classesApi.getSessions.and.returnValue(of([]));
    classesApi.getMyEnrollments.and.returnValue(of([]));
    classesApi.getMyMakeupCredits.and.returnValue(of([]));

    membersApi = jasmine.createSpyObj('MembersApiService', ['getMyMemberships']);
    membersApi.getMyMemberships.and.returnValue(of([membership]));

    storefrontContext = jasmine.createSpyObj('StorefrontContextService', ['resolve']);
    storefrontContext.resolve.and.resolveTo('club-1');

    const toast = jasmine.createSpyObj('HTMLIonToastElement', ['present']);
    toast.present.and.resolveTo();
    toastController = jasmine.createSpyObj('ToastController', ['create']);
    toastController.create.and.resolveTo(toast);

    const actionSheetController = jasmine.createSpyObj('ActionSheetController', ['create']);

    await TestBed.configureTestingModule({
      imports: [SchedulePage],
      providers: [
        { provide: ClassesApiService, useValue: classesApi },
        { provide: MembersApiService, useValue: membersApi },
        { provide: StorefrontContextService, useValue: storefrontContext },
        { provide: ActionSheetController, useValue: actionSheetController },
        { provide: ToastController, useValue: toastController }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SchedulePage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('renders an informational label instead of a button when manual enrollment is not open yet', async () => {
    classesApi.getSessions.and.returnValue(of([createSession({ canEnrollManually: false })]));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('.enrollment-not-open')).toBeTruthy();
    expect(Array.from(compiled.querySelectorAll('ion-button')).some((b) => b.textContent?.includes('Zapisz się'))).toBeFalse();
  });

  it('renders the Zapisz się button when manual enrollment is open', async () => {
    classesApi.getSessions.and.returnValue(of([createSession({ canEnrollManually: true })]));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(Array.from(compiled.querySelectorAll('ion-button')).some((b) => b.textContent?.includes('Zapisz się'))).toBeTrue();
    expect(compiled.querySelector('.enrollment-not-open')).toBeFalsy();
  });

  it('enroll() maps auto_enrollment_window_still_open to a specific Polish message', () => {
    fixture.detectChanges();
    const error = new HttpErrorResponse({
      status: 400,
      error: { errors: [{ code: 'auto_enrollment_window_still_open' }] }
    });
    classesApi.enroll.and.returnValue(throwError(() => error));

    component.enroll(createSession());

    expect(toastController.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ message: 'Zapisy na te zajęcia jeszcze się nie otworzyły.', color: 'danger' })
    );
  });

  it('enroll() falls back to the generic message for an unrecognized error code', () => {
    fixture.detectChanges();
    const error = new HttpErrorResponse({ status: 500 });
    classesApi.enroll.and.returnValue(throwError(() => error));

    component.enroll(createSession());

    expect(toastController.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ message: 'Nie udało się zapisać. Spróbuj ponownie.', color: 'danger' })
    );
  });

  it('unenroll() maps a known error code to a specific message', () => {
    fixture.detectChanges();
    const error = new HttpErrorResponse({
      status: 400,
      error: { errors: [{ code: 'already_enrolled' }] }
    });
    classesApi.unenroll.and.returnValue(throwError(() => error));

    component.unenroll({ id: 'e1', sessionId: 'session-1', status: 'Confirmed', source: 'Member', enrolledAt: new Date().toISOString() });

    expect(toastController.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ message: 'Jesteś już zapisany/a na te zajęcia.', color: 'danger' })
    );
  });
});
