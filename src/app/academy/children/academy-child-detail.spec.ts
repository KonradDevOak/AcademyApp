import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import {
  AcademyApiService,
  AthleteDetailsDto,
  AthleteGradeDto,
  AttendanceSessionStatusDto,
  EnrolledSlotDto,
  EnrollmentRequestDto,
  MonthlyAttendanceDto,
  SlotWaitlistEntryDto
} from '@konraddevoak/academy-api';
import { provideTranslateService } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { AcademyAthletePhotoApiService } from './academy-athlete-photo-api';
import { AcademyChildDetailComponent } from './academy-child-detail';

function athleteDetails(overrides: Partial<AthleteDetailsDto> = {}): AthleteDetailsDto {
  return {
    id: 'ath-1',
    guardianMemberId: 'member-1',
    firstName: 'Jaś',
    lastName: 'Kowalski',
    dateOfBirth: '2016-05-01',
    sessionsPerWeek: 0,
    monthlyFeeGrosze: null,
    status: 'Active',
    createdAt: '2026-01-01T00:00:00Z',
    guardianName: 'Anna Kowalska',
    guardianPhone: '500600700',
    enrolledSlots: [],
    ...overrides
  };
}

function attendance(
  period: string,
  year: number,
  month: number,
  isComputed = true
): MonthlyAttendanceDto {
  return { period, year, month, maxSessions: 8, attendedSessions: 6, isComputed };
}

// The API sends UTC instants (startsAt/endsAt); built from a local wall clock so "12.09" holds in any test zone.
// Cast because the pinned @konraddevoak/academy-api release still types the old date/startTime/endTime shape.
function attendanceSession(overrides: Partial<AttendanceSessionStatusDto> = {}): AttendanceSessionStatusDto {
  return {
    sessionId: 'sess-1',
    startsAt: new Date(2026, 8, 12, 17, 0).toISOString(),
    endsAt: new Date(2026, 8, 12, 18, 0).toISOString(),
    status: 'Present',
    ...overrides
  } as unknown as AttendanceSessionStatusDto;
}

function waitlistEntry(overrides: Partial<SlotWaitlistEntryDto> = {}): SlotWaitlistEntryDto {
  return {
    id: 'wl-1',
    trainingSlotId: 'slot-1',
    trainingGroupId: 'gr-1',
    groupName: 'Grupa I',
    disciplineName: 'Akrobatyka',
    dayOfWeek: 'Monday',
    startTime: '17:00:00',
    endTime: '18:00:00',
    joinedAt: '2026-09-01T00:00:00Z',
    status: 'Waiting',
    ...overrides
  };
}

function enrolledSlot(overrides: Partial<EnrolledSlotDto> = {}): EnrolledSlotDto {
  return {
    slotId: 'slot-1',
    groupId: 'gr-1',
    groupName: 'Grupa I',
    disciplineName: 'Akrobatyka',
    dayOfWeek: 'Monday',
    startTime: '17:00:00',
    endTime: '18:30:00',
    ...overrides
  };
}

function enrollmentRequest(overrides: Partial<EnrollmentRequestDto> = {}): EnrollmentRequestDto {
  return {
    id: 'req-1',
    athleteId: 'ath-1',
    addSlotIds: [],
    removeSlotIds: ['slot-1'],
    addSlots: [],
    removeSlots: [],
    guardianNote: null,
    status: 'Pending',
    createdAt: '2026-09-20T00:00:00Z',
    decidedAt: null,
    rejectionReason: null,
    waitlistedAt: null,
    waitlistNote: null,
    ...overrides
  };
}

// Fields the API sends that the pinned academy-api release doesn't type yet (club waitlist, slot labels).
function requestRow(overrides: Record<string, unknown>): EnrollmentRequestDto {
  return { ...enrollmentRequest(), addSlots: [], removeSlots: [], ...overrides } as unknown as EnrollmentRequestDto;
}

describe('AcademyChildDetailComponent', () => {
  const selectedId = signal<string | null>('sf-1');
  let getAthlete: jasmine.Spy;
  let getAthleteAttendance: jasmine.Spy;
  let getAthleteAttendanceSessions: jasmine.Spy;
  let requestAbsenceExcuse: jasmine.Spy;
  let cancelAbsenceExcuse: jasmine.Spy;
  let getAthleteGrades: jasmine.Spy;
  let getMyWaitlistEntries: jasmine.Spy;
  let leaveWaitlist: jasmine.Spy;
  let getMyEnrollmentRequests: jasmine.Spy;
  let createEnrollmentRequest: jasmine.Spy;
  let cancelEnrollmentRequest: jasmine.Spy;
  let deactivateAthlete: jasmine.Spy;
  let navigateByUrl: jasmine.Spy;

  async function render(): Promise<ComponentFixture<AcademyChildDetailComponent>> {
    const fixture = TestBed.createComponent(AcademyChildDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<AcademyChildDetailComponent>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function root(fixture: ComponentFixture<AcademyChildDetailComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function deleteButton(fixture: ComponentFixture<AcademyChildDetailComponent>): HTMLButtonElement {
    return root(fixture).querySelector('.child-detail__foot-actions .btn--danger') as HTMLButtonElement;
  }

  function openDialog(fixture: ComponentFixture<AcademyChildDetailComponent>): HTMLDialogElement | null {
    return root(fixture).querySelector('dialog[open]');
  }

  // Buttons inside an open dialog, by their (untranslated, since specs load no translations) i18n key.
  function dialogButton(
    fixture: ComponentFixture<AcademyChildDetailComponent>,
    key: string
  ): HTMLButtonElement {
    return Array.from(openDialog(fixture)?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes(key)
    ) as HTMLButtonElement;
  }

  async function settle(fixture: ComponentFixture<AcademyChildDetailComponent>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    selectedId.set('sf-1');
    getAthlete = jasmine.createSpy('getAthlete').and.returnValue(of(athleteDetails()));
    getAthleteAttendance = jasmine.createSpy('getAthleteAttendance').and.returnValue(of([]));
    getAthleteAttendanceSessions = jasmine
      .createSpy('getAthleteAttendanceSessions')
      .and.returnValue(of([]));
    requestAbsenceExcuse = jasmine.createSpy('requestAbsenceExcuse').and.returnValue(of('exc-1'));
    cancelAbsenceExcuse = jasmine.createSpy('cancelAbsenceExcuse').and.returnValue(of(undefined));
    getAthleteGrades = jasmine.createSpy('getAthleteGrades').and.returnValue(of([]));
    getMyWaitlistEntries = jasmine.createSpy('getMyWaitlistEntries').and.returnValue(of([]));
    leaveWaitlist = jasmine.createSpy('leaveWaitlist').and.returnValue(of(undefined));
    getMyEnrollmentRequests = jasmine.createSpy('getMyEnrollmentRequests').and.returnValue(of([]));
    createEnrollmentRequest = jasmine.createSpy('createEnrollmentRequest').and.returnValue(of('req-new'));
    cancelEnrollmentRequest = jasmine.createSpy('cancelEnrollmentRequest').and.returnValue(of(undefined));
    deactivateAthlete = jasmine.createSpy('deactivateAthlete').and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        // The embedded photo component talks to its own HTTP service — irrelevant to this screen's tests.
        { provide: AcademyAthletePhotoApiService, useValue: { upload: () => of(undefined), remove: () => of(undefined) } },
        {
          provide: AcademyApiService,
          useValue: {
            getAthlete,
            getAthleteAttendance,
            getAthleteAttendanceSessions,
            requestAbsenceExcuse,
            cancelAbsenceExcuse,
            getAthleteGrades,
            getMyWaitlistEntries,
            leaveWaitlist,
            getMyEnrollmentRequests,
            createEnrollmentRequest,
            cancelEnrollmentRequest,
            deactivateAthlete
          }
        },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: selectedId.asReadonly() } },
        provideRouter([])
      ]
    });

    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { paramMap: convertToParamMap({ athleteId: 'ath-1' }) } }
    });

    navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  it('renders the four tab buttons (no payments tab — that lives on /academy) followed by the enroll action, and loads the athlete', async () => {
    const fixture = await render();

    const barLabels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.child-detail__tabs > *')
    ).map((el) => el.textContent?.trim());
    expect(barLabels).toEqual([
      'academy.childDetail.tabs.athlete',
      'academy.childDetail.tabs.schedule',
      'academy.childDetail.tabs.attendance',
      'academy.childDetail.tabs.grades',
      'academy.childDetail.actions.enroll'
    ]);

    expect(getAthlete).toHaveBeenCalledWith('sf-1', 'ath-1');
    expect(text(fixture)).toContain('Jaś Kowalski');
    expect(text(fixture)).toContain('academy.childDetail.athlete.noGroup');
  });

  it("shows the assigned group's name on the athlete tab", async () => {
    getAthlete.and.returnValue(
      of(
        athleteDetails({
          enrolledSlots: [
            {
              slotId: 'slot-1',
              groupId: 'gr-1',
              groupName: 'Grupa I',
              disciplineName: 'Akrobatyka sportowa',
              dayOfWeek: 'Monday',
              startTime: '17:00:00',
              endTime: '18:30:00'
            }
          ]
        })
      )
    );
    const fixture = await render();

    expect(text(fixture)).toContain('Grupa I');
  });

  it('shows discipline, town, trainings per week and the guardian on the athlete tab', async () => {
    const slot = {
      slotId: 'slot-1',
      groupId: 'gr-1',
      groupName: 'Drobin I',
      locality: 'Drobin',
      disciplineName: 'Akrobatyka',
      dayOfWeek: 'Monday',
      startTime: '17:00:00',
      endTime: '18:30:00'
    };
    getAthlete.and.returnValue(
      of(athleteDetails({ sessionsPerWeek: 2, enrolledSlots: [slot, { ...slot, slotId: 'slot-2', dayOfWeek: 'Thursday' }] }))
    );
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.child-detail__disciplines')?.textContent?.trim()).toBe('Akrobatyka');
    expect(el.querySelector('.child-detail__localities')?.textContent?.trim()).toBe('Drobin');
    expect(el.querySelector('.child-detail__trainings')?.textContent).toContain('academy.childDetail.athlete.trainingsPerWeek');
    expect(el.querySelector('.child-detail__guardian-name')?.textContent?.trim()).toBe('Anna Kowalska');
    expect(el.querySelector('.child-detail__guardian-phone')?.textContent?.trim()).toBe('500600700');
  });

  it('switches to the schedule tab and shows the not-assigned notice when the child has no active enrollment', async () => {
    const fixture = await render();

    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    expect(text(fixture)).toContain('academy.childDetail.schedule.notAssigned');
  });

  it('renders schedule slots with day i18n keys, short times and the group name', async () => {
    getAthlete.and.returnValue(
      of(
        athleteDetails({
          enrolledSlots: [
            {
              slotId: 'slot-1',
              groupId: 'gr-1',
              groupName: 'Grupa I',
              disciplineName: 'Akrobatyka',
              dayOfWeek: 'Monday',
              startTime: '17:00:00',
              endTime: '18:30:00'
            }
          ]
        })
      )
    );
    const fixture = await render();

    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    const scheduleText = text(fixture);
    expect(scheduleText).toContain('Grupa I');
    expect(scheduleText).toContain('academy.day.monday');
    expect(scheduleText).toContain('17:00–18:30');
  });

  it('shows the "Zgłoś zawodnika" action in the tab bar (on every tab), pointing at the enroll route', async () => {
    const fixture = await render();

    for (const tab of ['athlete', 'schedule', 'attendance'] as const) {
      fixture.componentInstance['selectTab'](tab);
      fixture.detectChanges();

      const link = root(fixture).querySelector('.child-detail__tabs a[href="/academy/children/ath-1/enroll"]');
      expect(link).not.toBeNull();
      expect(link?.textContent?.trim()).toBe('academy.childDetail.actions.enroll');
    }

    // Moved out of the schedule panel — no second copy there.
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();
    expect(root(fixture).querySelector('.child-detail__panel a[href="/academy/children/ath-1/enroll"]')).toBeNull();
  });

  it('lays the schedule tiles outside a card, while the other tabs keep their card panel', async () => {
    getAthlete.and.returnValue(of(athleteDetails({ sessionsPerWeek: 1, enrolledSlots: [enrolledSlot()] })));
    const fixture = await render();
    expect(root(fixture).querySelector('.child-detail__panel.card')).not.toBeNull();

    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    expect(root(fixture).querySelector('.child-detail__panel.card')).toBeNull();
    expect(root(fixture).querySelector('.child-detail__tiles')?.closest('.card')).toBeNull();
  });

  it('renders a slot-waitlist entry as a tile with a working leave button', async () => {
    getMyWaitlistEntries.and.returnValue(of([waitlistEntry()]));
    const fixture = await render();

    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    const scheduleText = text(fixture);
    expect(scheduleText).toContain('academy.childDetail.schedule.status.slotWaitlist');
    expect(scheduleText).toContain('Grupa I');
    expect(scheduleText).toContain('academy.day.monday');
    expect(scheduleText).toContain('17:00–18:00');

    getAthlete.calls.reset();
    const leaveButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ).find((b) => b.textContent?.includes('academy.enroll.leaveWaitlist')) as HTMLButtonElement;
    expect(leaveButton).not.toBeUndefined();

    leaveButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(leaveWaitlist).toHaveBeenCalledWith('sf-1', 'ath-1', 'slot-1');
    expect(getAthlete).toHaveBeenCalled(); // reloads the whole detail on success
  });

  it('shows the Edit link pointing at the edit route on the athlete tab', async () => {
    const fixture = await render();

    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'a[href="/academy/children/ath-1/edit"]'
    );
    expect(link).not.toBeNull();
  });

  it('shows the Delete button next to Edit on the athlete tab', async () => {
    const fixture = await render();

    const actions = root(fixture).querySelector('.child-detail__foot-actions') as HTMLElement;
    expect(actions.querySelector('a[href="/academy/children/ath-1/edit"]')).not.toBeNull();
    expect(deleteButton(fixture)).not.toBeNull();
    expect(deleteButton(fixture).textContent?.trim()).toBe('academy.childDetail.delete');
    expect(root(fixture).querySelector('.child-detail__tabs .child-detail__tab--danger')).toBeNull();
  });

  it('hides both the Edit link and the Delete button on tabs other than athlete', async () => {
    const fixture = await render();

    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    expect(root(fixture).querySelector('a[href="/academy/children/ath-1/edit"]')).toBeNull();
    expect(deleteButton(fixture)).toBeNull();
  });

  it('does not render the delete hint or a dialog until Delete is clicked', async () => {
    getAthlete.and.returnValue(of(athleteDetails({ sessionsPerWeek: 1 })));
    const fixture = await render();

    expect(openDialog(fixture)).toBeNull();
    expect(text(fixture)).not.toContain('academy.childDetail.deleteDisabledHint');
  });

  it('keeps Delete clickable with active enrollments and explains why in an informational popup', async () => {
    getAthlete.and.returnValue(of(athleteDetails({ sessionsPerWeek: 1 })));
    const fixture = await render();

    expect(deleteButton(fixture).disabled).toBeFalse();
    deleteButton(fixture).click();
    fixture.detectChanges();

    const dialog = openDialog(fixture);
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('academy.childDetail.deleteBlocked.title');
    expect(dialog?.textContent).toContain('academy.childDetail.deleteDisabledHint');
    expect(dialogButton(fixture, 'academy.childDetail.delete')).toBeUndefined(); // no confirm action

    dialogButton(fixture, 'common.dialog.close').click();
    fixture.detectChanges();
    expect(openDialog(fixture)).toBeNull();
    expect(deactivateAthlete).not.toHaveBeenCalled();
  });

  it('asks for confirmation when the child has no enrollments, then deletes and navigates to the roster', async () => {
    const fixture = await render();

    deleteButton(fixture).click();
    fixture.detectChanges();
    expect(openDialog(fixture)?.textContent).toContain('academy.childDetail.deleteConfirm');
    expect(deactivateAthlete).not.toHaveBeenCalled();

    dialogButton(fixture, 'academy.childDetail.delete').click();

    expect(deactivateAthlete).toHaveBeenCalledWith('sf-1', 'ath-1');
    expect(navigateByUrl).toHaveBeenCalledWith('/academy');
  });

  it('does not delete when the confirmation popup is cancelled', async () => {
    const fixture = await render();

    deleteButton(fixture).click();
    fixture.detectChanges();
    dialogButton(fixture, 'common.dialog.cancel').click();
    fixture.detectChanges();

    expect(deactivateAthlete).not.toHaveBeenCalled();
    expect(openDialog(fixture)).toBeNull();
  });

  it('keeps the popup open and shows an error message when delete fails', async () => {
    deactivateAthlete.and.returnValue(throwError(() => new Error('boom')));
    const fixture = await render();

    deleteButton(fixture).click();
    fixture.detectChanges();
    dialogButton(fixture, 'academy.childDetail.delete').click();
    fixture.detectChanges();

    expect(openDialog(fixture)?.textContent).toContain('academy.childDetail.deleteError');
    expect(navigateByUrl).not.toHaveBeenCalledWith('/academy');
  });

  it('offers a Withdraw button on every enrolled slot', async () => {
    getAthlete.and.returnValue(
      of(
        athleteDetails({
          sessionsPerWeek: 2,
          enrolledSlots: [enrolledSlot(), enrolledSlot({ slotId: 'slot-2', dayOfWeek: 'Thursday' })]
        })
      )
    );
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    const slots = Array.from(root(fixture).querySelectorAll('li.schedule-tile'));
    expect(slots.length).toBe(2);
    for (const slot of slots) {
      expect(slot.querySelector('button')?.textContent?.trim()).toBe('academy.childDetail.schedule.withdraw');
    }
  });

  it('files a removal request for the slot after confirming, then reloads', async () => {
    getAthlete.and.returnValue(of(athleteDetails({ sessionsPerWeek: 1, enrolledSlots: [enrolledSlot()] })));
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    (root(fixture).querySelector('li.schedule-tile button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(openDialog(fixture)?.textContent).toContain('academy.childDetail.withdraw.title');
    expect(createEnrollmentRequest).not.toHaveBeenCalled();

    getAthlete.calls.reset();
    dialogButton(fixture, 'academy.childDetail.withdraw.confirm').click();
    await settle(fixture);

    expect(createEnrollmentRequest).toHaveBeenCalledOnceWith('ath-1', {
      storefrontId: 'sf-1',
      addSlotIds: [],
      removeSlotIds: ['slot-1'],
      note: null
    });
    expect(getAthlete).toHaveBeenCalled();
    expect(openDialog(fixture)).toBeNull();
  });

  it('does not file a request when the withdraw popup is cancelled', async () => {
    getAthlete.and.returnValue(of(athleteDetails({ sessionsPerWeek: 1, enrolledSlots: [enrolledSlot()] })));
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    (root(fixture).querySelector('li.schedule-tile button') as HTMLButtonElement).click();
    fixture.detectChanges();
    dialogButton(fixture, 'common.dialog.cancel').click();
    fixture.detectChanges();

    expect(createEnrollmentRequest).not.toHaveBeenCalled();
    expect(openDialog(fixture)).toBeNull();
  });

  it('turns a slot with a Pending removal request into a "withdrawal pending" tile with a single cancel action', async () => {
    getAthlete.and.returnValue(
      of(
        athleteDetails({
          sessionsPerWeek: 2,
          enrolledSlots: [enrolledSlot(), enrolledSlot({ slotId: 'slot-2', dayOfWeek: 'Thursday' })]
        })
      )
    );
    getMyEnrollmentRequests.and.returnValue(
      of([
        enrollmentRequest({ removeSlotIds: ['slot-1'] }),
        // Decided requests must not count as pending.
        enrollmentRequest({ id: 'req-2', removeSlotIds: ['slot-2'], status: 'Rejected' })
      ])
    );
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    const [first, second] = Array.from(root(fixture).querySelectorAll('li.schedule-tile'));
    expect(first.textContent).toContain('academy.childDetail.schedule.status.withdrawPending');
    expect(Array.from(first.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual([
      'academy.childDetail.schedule.cancelWithdraw'
    ]);
    expect(second.querySelector('button')?.textContent?.trim()).toBe('academy.childDetail.schedule.withdraw');
  });

  it('shows the mapped error inside the popup and stays open when the removal request fails', async () => {
    getAthlete.and.returnValue(of(athleteDetails({ sessionsPerWeek: 1, enrolledSlots: [enrolledSlot()] })));
    createEnrollmentRequest.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { errors: [{ code: 'slot_full' }] } }))
    );
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    (root(fixture).querySelector('li.schedule-tile button') as HTMLButtonElement).click();
    fixture.detectChanges();
    dialogButton(fixture, 'academy.childDetail.withdraw.confirm').click();
    fixture.detectChanges();

    expect(openDialog(fixture)?.textContent).toContain('academy.enroll.errors.full');
  });

  it('closes the popup and reloads when a request for the slot is already pending', async () => {
    getAthlete.and.returnValue(of(athleteDetails({ sessionsPerWeek: 1, enrolledSlots: [enrolledSlot()] })));
    createEnrollmentRequest.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { errors: [{ code: 'slot_already_pending_request' }] } }))
    );
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    (root(fixture).querySelector('li.schedule-tile button') as HTMLButtonElement).click();
    fixture.detectChanges();
    getAthlete.calls.reset();
    dialogButton(fixture, 'academy.childDetail.withdraw.confirm').click();
    await settle(fixture);

    expect(getAthlete).toHaveBeenCalled();
    expect(openDialog(fixture)).toBeNull();
  });

  it('still renders the schedule (without pending badges) when loading enrollment requests fails', async () => {
    getAthlete.and.returnValue(of(athleteDetails({ sessionsPerWeek: 1, enrolledSlots: [enrolledSlot()] })));
    getMyEnrollmentRequests.and.returnValue(throwError(() => new Error('boom')));
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    expect(text(fixture)).toContain('Grupa I');
    expect(root(fixture).querySelector('li.schedule-tile button')).not.toBeNull();
  });

  it('treats a Waitlisted removal request like a Pending one (cancel-withdrawal instead of Withdraw)', async () => {
    getAthlete.and.returnValue(of(athleteDetails({ sessionsPerWeek: 1, enrolledSlots: [enrolledSlot()] })));
    getMyEnrollmentRequests.and.returnValue(of([requestRow({ removeSlotIds: ['slot-1'], status: 'Waitlisted' })]));
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    const tiles = root(fixture).querySelectorAll('li.schedule-tile');
    expect(tiles.length).toBe(1);
    expect(tiles[0].textContent).toContain('academy.childDetail.schedule.status.withdrawPending');
    expect(tiles[0].querySelector('button')?.textContent?.trim()).toBe('academy.childDetail.schedule.cancelWithdraw');
  });

  it('cancels the removal request from a "withdrawal pending" tile', async () => {
    getAthlete.and.returnValue(of(athleteDetails({ sessionsPerWeek: 1, enrolledSlots: [enrolledSlot()] })));
    getMyEnrollmentRequests.and.returnValue(of([requestRow({ id: 'req-x', removeSlotIds: ['slot-1'] })]));
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    (root(fixture).querySelector('.schedule-tile__cancel') as HTMLButtonElement).click();
    await settle(fixture);

    expect(cancelEnrollmentRequest).toHaveBeenCalledWith('sf-1', 'ath-1', 'req-x');
    expect(createEnrollmentRequest).not.toHaveBeenCalled();
  });

  it('hides the request history when the child has no decided requests', async () => {
    getMyEnrollmentRequests.and.returnValue(of([requestRow({ id: 'req-p', status: 'Pending' })]));
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    expect(root(fixture).querySelector('.child-detail__history')).toBeNull();
  });

  it('shows an open add request as one tile per slot with its status, the club note and a single cancel action', async () => {
    getMyEnrollmentRequests.and.returnValue(
      of([
        requestRow({
          id: 'req-w',
          status: 'Waitlisted',
          addSlotIds: ['slot-9'],
          removeSlotIds: [],
          addSlots: [{ slotId: 'slot-9', groupName: 'Grupa II', dayOfWeek: 'Friday', startTime: '17:00:00', endTime: '18:30:00' }],
          waitlistNote: 'Zwolni się miejsce po feriach'
        })
      ])
    );
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    const tiles = Array.from(root(fixture).querySelectorAll('li.schedule-tile'));
    expect(tiles.length).toBe(1);
    expect(tiles[0].textContent).toContain('academy.childDetail.requests.status.Waitlisted');
    expect(tiles[0].textContent).toContain('Grupa II');
    expect(tiles[0].textContent).toContain('17:00–18:30');
    expect(tiles[0].textContent).toContain('Zwolni się miejsce po feriach');
    expect(tiles[0].querySelector('.badge--warn')).not.toBeNull();
    expect(Array.from(tiles[0].querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual([
      'academy.childDetail.requests.cancel'
    ]);
    // Open requests live on the tiles only — not repeated in the history.
    expect(root(fixture).querySelector('.child-detail__history')).toBeNull();
  });

  it('warns on each tile of a multi-slot request that cancelling covers the other slots too', async () => {
    getMyEnrollmentRequests.and.returnValue(
      of([
        requestRow({
          id: 'req-p',
          status: 'Pending',
          addSlotIds: ['slot-8', 'slot-9'],
          removeSlotIds: [],
          addSlots: [
            { slotId: 'slot-8', groupName: 'Grupa II', dayOfWeek: 'Tuesday', startTime: '17:00:00', endTime: '18:00:00' },
            { slotId: 'slot-9', groupName: 'Grupa II', dayOfWeek: 'Friday', startTime: '17:00:00', endTime: '18:30:00' }
          ]
        })
      ])
    );
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    const tiles = Array.from(root(fixture).querySelectorAll('li.schedule-tile'));
    expect(tiles.length).toBe(2);
    for (const tile of tiles) {
      expect(tile.textContent).toContain('academy.childDetail.schedule.cancelAlsoAffects');
    }
  });

  it('lists only decided requests in the history, with status, slot labels and the rejection reason', async () => {
    getMyEnrollmentRequests.and.returnValue(
      of([
        requestRow({ id: 'req-p', status: 'Pending' }),
        requestRow({ id: 'req-r', status: 'Rejected', addSlots: [{ slotId: 'slot-9', groupName: 'Grupa II', dayOfWeek: 'Friday', startTime: '17:00:00', endTime: '18:30:00' }], rejectionReason: 'Brak miejsc w tym sezonie' }),
        requestRow({ id: 'req-a', status: 'Approved' }),
        requestRow({ id: 'req-c', status: 'Cancelled' })
      ])
    );
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    const items = Array.from(root(fixture).querySelectorAll('.child-detail__history li.child-detail__request'));
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain('Grupa II');
    expect(items[0].textContent).toContain('Brak miejsc w tym sezonie');
    expect(items[0].querySelector('.badge--due')).not.toBeNull();
    expect(items[1].querySelector('.badge--ok')).not.toBeNull();
    expect(root(fixture).querySelector('.child-detail__history button')).toBeNull();
  });

  it('cancels a request and reloads the detail', async () => {
    getMyEnrollmentRequests.and.returnValue(
      of([requestRow({ id: 'req-w', status: 'Waitlisted', addSlotIds: ['slot-9'], removeSlotIds: [], addSlots: [{ slotId: 'slot-9', groupName: 'Grupa II', dayOfWeek: 'Friday', startTime: '17:00:00', endTime: '18:30:00' }] })])
    );
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();
    getAthlete.calls.reset();

    (root(fixture).querySelector('.schedule-tile__cancel') as HTMLButtonElement).click();
    await settle(fixture);

    expect(cancelEnrollmentRequest).toHaveBeenCalledWith('sf-1', 'ath-1', 'req-w');
    expect(getAthlete).toHaveBeenCalled();
  });

  it('shows an error when cancelling a request fails', async () => {
    getMyEnrollmentRequests.and.returnValue(
      of([requestRow({ id: 'req-p', status: 'Pending', addSlotIds: ['slot-9'], removeSlotIds: [], addSlots: [{ slotId: 'slot-9', groupName: 'Grupa II', dayOfWeek: 'Friday', startTime: '17:00:00', endTime: '18:30:00' }] })])
    );
    cancelEnrollmentRequest.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    const fixture = await render();
    fixture.componentInstance['selectTab']('schedule');
    fixture.detectChanges();

    (root(fixture).querySelector('.schedule-tile__cancel') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(text(fixture)).toContain('academy.childDetail.requests.cancelError');
  });

  it('builds month i18n keys client-side, including across the year boundary', async () => {
    getAthleteAttendance.and.returnValue(
      of([attendance('2027-01', 2027, 1), attendance('2026-12', 2026, 12)])
    );
    const fixture = await render();

    fixture.componentInstance['selectTab']('attendance');
    fixture.detectChanges();

    const attendanceText = text(fixture);
    expect(attendanceText).toContain('academy.month.12 2026');
    expect(attendanceText).toContain('academy.month.1 2027');
    expect(attendanceText).toContain('6/8');
  });

  it('shows the empty-attendance notice when there are no entries', async () => {
    const fixture = await render();

    fixture.componentInstance['selectTab']('attendance');
    fixture.detectChanges();

    expect(text(fixture)).toContain('academy.childDetail.attendance.empty');
  });

  it('only shows the expand toggle for computed months, not frozen ones', async () => {
    getAthleteAttendance.and.returnValue(
      of([attendance('2027-01', 2027, 1, true), attendance('2026-12', 2026, 12, false)])
    );
    const fixture = await render();
    fixture.componentInstance['selectTab']('attendance');
    fixture.detectChanges();

    const toggles = root(fixture).querySelectorAll(
      '.child-detail__attendance-toggle:not(.child-detail__attendance-toggle--spacer)'
    );
    expect(toggles.length).toBe(1);
  });

  it('expands a computed month and loads its per-session breakdown', async () => {
    getAthleteAttendance.and.returnValue(of([attendance('2026-09', 2026, 9, true)]));
    getAthleteAttendanceSessions.and.returnValue(
      of([attendanceSession({ status: 'Present' })])
    );
    const fixture = await render();
    fixture.componentInstance['selectTab']('attendance');
    fixture.detectChanges();

    const toggle = root(fixture).querySelector(
      '.child-detail__attendance-toggle:not(.child-detail__attendance-toggle--spacer)'
    ) as HTMLButtonElement;
    toggle.click();
    await settle(fixture);

    expect(getAthleteAttendanceSessions).toHaveBeenCalledWith('sf-1', 'ath-1', '2026-09');
    expect(text(fixture)).toContain('12.09');
    expect(text(fixture)).toContain('academy.childDetail.attendance.status.Present');

    toggle.click();
    await settle(fixture);
    expect(root(fixture).querySelector('.child-detail__session-panel')).toBeNull();
  });

  it('ignores a late response for a month the parent has already switched away from', async () => {
    getAthleteAttendance.and.returnValue(
      of([attendance('2026-09', 2026, 9, true), attendance('2026-08', 2026, 8, true)])
    );
    const september = new Subject<AttendanceSessionStatusDto[]>();
    const august = new Subject<AttendanceSessionStatusDto[]>();
    getAthleteAttendanceSessions.and.callFake((_sf: string, _id: string, period: string) =>
      period === '2026-09' ? september : august
    );
    const fixture = await render();
    fixture.componentInstance['selectTab']('attendance');
    fixture.detectChanges();

    const toggles = root(fixture).querySelectorAll(
      '.child-detail__attendance-toggle:not(.child-detail__attendance-toggle--spacer)'
    ) as NodeListOf<HTMLButtonElement>;
    toggles[0].click();
    toggles[1].click();
    august.next([attendanceSession({ startsAt: new Date(2026, 7, 3, 17, 0).toISOString(), status: 'Absent' } as Partial<AttendanceSessionStatusDto>)]);
    september.next([attendanceSession({ status: 'Present' })]);
    await settle(fixture);

    expect(fixture.componentInstance['expandedPeriod']()).toBe('2026-08');
    expect(text(fixture)).toContain('03.08');
    expect(text(fixture)).not.toContain('12.09');
  });

  async function expandSeptember(): Promise<ComponentFixture<AcademyChildDetailComponent>> {
    getAthleteAttendance.and.returnValue(of([attendance('2026-09', 2026, 9, true)]));
    const fixture = await render();
    fixture.componentInstance['selectTab']('attendance');
    fixture.detectChanges();
    (root(fixture).querySelector(
      '.child-detail__attendance-toggle:not(.child-detail__attendance-toggle--spacer)'
    ) as HTMLButtonElement).click();
    await settle(fixture);
    return fixture;
  }

  const sessionButton = (fixture: ComponentFixture<AcademyChildDetailComponent>) =>
    root(fixture).querySelector('.child-detail__session-actions button') as HTMLButtonElement | null;

  it('lets the parent report an absence for a session not attended yet and reloads the month', async () => {
    getAthleteAttendanceSessions.and.returnValue(of([attendanceSession({ status: 'NotRecorded' })]));
    const fixture = await expandSeptember();

    expect(sessionButton(fixture)!.textContent).toContain('academy.childDetail.attendance.reportAbsence');
    sessionButton(fixture)!.click();
    await settle(fixture);

    expect(requestAbsenceExcuse).toHaveBeenCalledWith('ath-1',
      jasmine.objectContaining({ storefrontId: 'sf-1', note: null }));
    expect(getAthleteAttendanceSessions).toHaveBeenCalledTimes(2);
  });

  it('shows a pending report and lets the parent withdraw it', async () => {
    getAthleteAttendanceSessions.and.returnValue(of([attendanceSession({
      status: 'NotRecorded', absenceExcuseId: 'exc-1', absenceExcuseStatus: 'Pending'
    } as Partial<AttendanceSessionStatusDto>)]));
    const fixture = await expandSeptember();

    expect(text(fixture)).toContain('academy.childDetail.attendance.excusePending');
    sessionButton(fixture)!.click();
    await settle(fixture);

    expect(cancelAbsenceExcuse).toHaveBeenCalledWith('sf-1', 'ath-1', 'exc-1');
  });

  it('offers no report for an attended session', async () => {
    getAthleteAttendanceSessions.and.returnValue(of([attendanceSession({ status: 'Present' })]));
    const fixture = await expandSeptember();

    expect(sessionButton(fixture)).toBeNull();
  });

  it('explains when a session can no longer be reported', async () => {
    getAthleteAttendanceSessions.and.returnValue(of([attendanceSession({ status: 'Absent' })]));
    requestAbsenceExcuse.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { errors: [{ code: 'absence_excuse_not_allowed', message: 'x' }] }
    })));
    const fixture = await expandSeptember();

    sessionButton(fixture)!.click();
    await settle(fixture);

    expect(text(fixture)).toContain('academy.childDetail.attendance.excuseNotAllowed');
  });

  it('shows an error message when loading the per-session breakdown fails', async () => {
    getAthleteAttendance.and.returnValue(of([attendance('2026-09', 2026, 9, true)]));
    getAthleteAttendanceSessions.and.returnValue(throwError(() => new Error('boom')));
    const fixture = await render();
    fixture.componentInstance['selectTab']('attendance');
    fixture.detectChanges();

    const toggle = root(fixture).querySelector(
      '.child-detail__attendance-toggle:not(.child-detail__attendance-toggle--spacer)'
    ) as HTMLButtonElement;
    toggle.click();
    await settle(fixture);

    expect(text(fixture)).toContain('academy.childDetail.attendance.sessionsError');
  });

  it('shows the error state and retries when the athlete call fails', async () => {
    getAthlete.and.returnValue(throwError(() => new Error('boom')));
    const fixture = await render();

    expect(fixture.componentInstance['status']()).toBe('error');
    expect(text(fixture)).toContain('academy.childDetail.loadError');

    getAthlete.and.returnValue(of(athleteDetails()));
    getAthlete.calls.reset();
    fixture.componentInstance['retry']();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getAthlete).toHaveBeenCalledWith('sf-1', 'ath-1');
    expect(fixture.componentInstance['status']()).toBe('loaded');
  });

  it('renders the current belt and history for each discipline', async () => {
    // Cast: the pinned academy-api release still types awardedOn, the API sends awardedAt.
    const grades = [
      {
        disciplineId: 'd-1',
        disciplineName: 'Akrobatyka sportowa',
        current: { gradeLevelId: 'gl-1', name: 'Żółty pas', colorHex: '#f5d90a', awardedAt: new Date(2026, 5, 1).toISOString() },
        history: [
          {
            id: 'award-1',
            gradeLevelId: 'gl-1',
            name: 'Żółty pas',
            colorHex: '#f5d90a',
            awardedAt: new Date(2026, 5, 1).toISOString(),
            examAt: new Date(2026, 4, 30).toISOString(),
            examinerName: 'Jan Trener',
            result: 'Passed',
            note: null
          }
        ]
      }
    ] as unknown as AthleteGradeDto[];
    getAthleteGrades.and.returnValue(of(grades));
    const fixture = await render();
    fixture.componentInstance['selectTab']('grades');
    fixture.detectChanges();

    const gradesText = text(fixture);
    expect(gradesText).toContain('Akrobatyka sportowa');
    expect(gradesText).toContain('Żółty pas');
    expect(gradesText).toContain('academy.childDetail.grades.result.Passed');
    expect(gradesText).toContain('Jan Trener');
  });

  it('shows the no-upcoming-session message on the athlete tab when there are no enrolled slots', async () => {
    const fixture = await render();

    expect(text(fixture)).toContain('academy.childDetail.athlete.noUpcomingSession');
  });

  it('shows the nearest upcoming session, picking the earliest across multiple enrolled slots', async () => {
    // Fixed "now": Wednesday 2026-09-09, 10:00 local time.
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 9, 10, 0, 0));

    getAthlete.and.returnValue(
      of(
        athleteDetails({
          enrolledSlots: [
            // Friday this week — 2 days out.
            {
              slotId: 'slot-far',
              groupId: 'gr-1',
              groupName: 'Grupa I',
              disciplineName: 'Akrobatyka',
              dayOfWeek: 'Friday',
              startTime: '09:00:00',
              endTime: '10:00:00'
            },
            // Wednesday (today) at 17:00 — still ahead of "now", and the true earliest.
            {
              slotId: 'slot-near',
              groupId: 'gr-2',
              groupName: 'Grupa II',
              disciplineName: 'Akrobatyka',
              dayOfWeek: 'Wednesday',
              startTime: '17:00:00',
              endTime: '18:00:00'
            }
          ]
        })
      )
    );

    try {
      const fixture = await render();
      const athleteText = text(fixture);
      expect(athleteText).toContain('academy.day.wednesday');
      expect(athleteText).toContain('17:00');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('shows a dash for the current-grade summary when the athlete has no current grades', async () => {
    const fixture = await render();

    const summary = (fixture.nativeElement as HTMLElement).querySelector('.child-detail__grade-summary');
    expect(summary?.textContent?.trim()).toBe('—');
  });

  it('shows a belt-chip per discipline in the current-grade summary on the athlete tab', async () => {
    // Cast: the pinned academy-api release still types awardedOn, the API sends awardedAt.
    const grades = [
      {
        disciplineId: 'd-1',
        disciplineName: 'Akrobatyka sportowa',
        current: { gradeLevelId: 'gl-1', name: 'Żółty pas', colorHex: '#f5d90a', awardedAt: new Date(2026, 5, 1).toISOString() },
        history: []
      },
      { disciplineId: 'd-2', disciplineName: 'Sztuki walki', current: null, history: [] }
    ];
    getAthleteGrades.and.returnValue(of(grades));
    const fixture = await render();

    const chips = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.child-detail__grade-summary .belt-chip'
    );
    expect(chips.length).toBe(1);
    expect(chips[0].textContent?.trim()).toBe('Żółty pas');
  });

  it('shows a no-belt notice for a discipline with no current grade', async () => {
    const grades: AthleteGradeDto[] = [
      { disciplineId: 'd-2', disciplineName: 'Sztuki walki', current: null, history: [] }
    ];
    getAthleteGrades.and.returnValue(of(grades));
    const fixture = await render();
    fixture.componentInstance['selectTab']('grades');
    fixture.detectChanges();

    expect(text(fixture)).toContain('academy.childDetail.grades.none');
  });

  it('shows the child photo component with the photo link from the athlete details', async () => {
    getAthlete.and.returnValue(of(athleteDetails({ photoUrl: 'https://cdn.example/p.jpg?sig=1' } as Partial<AthleteDetailsDto>)));

    const fixture = await render();

    expect(root(fixture).querySelector('app-academy-child-photo img')?.getAttribute('src'))
      .toBe('https://cdn.example/p.jpg?sig=1');
  });

  it('refetches only the athlete when the photo changes, without going back to the loading state', async () => {
    const fixture = await render();
    getAthlete.calls.reset();
    getAthleteAttendance.calls.reset();
    getAthlete.and.returnValue(of(athleteDetails({ photoUrl: 'https://cdn.example/new.jpg' } as Partial<AthleteDetailsDto>)));

    await (fixture.componentInstance as unknown as { reloadAthlete(): Promise<void> }).reloadAthlete();
    await settle(fixture);

    expect(getAthlete).toHaveBeenCalledTimes(1);
    expect(getAthleteAttendance).not.toHaveBeenCalled();
    expect(root(fixture).querySelector('app-academy-child-photo img')?.getAttribute('src'))
      .toBe('https://cdn.example/new.jpg');
  });
});
