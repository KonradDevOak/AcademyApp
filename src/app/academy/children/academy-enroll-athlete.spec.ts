import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AcademyApiService, EnrollmentOptionGroupDto, EnrollmentOptionSlotDto } from '@konraddevoak/academy-api';
import { provideTranslateService } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { AcademyEnrollAthleteComponent } from './academy-enroll-athlete';

function slot(overrides: Partial<EnrollmentOptionSlotDto> = {}): EnrollmentOptionSlotDto {
  return {
    id: 'slot-1',
    dayOfWeek: 'Monday',
    startTime: '17:00:00',
    endTime: '18:00:00',
    locationNote: null,
    capacity: 10,
    freeSpots: 5,
    alreadyEnrolled: false,
    alreadyRequested: false,
    isOnWaitlist: false,
    ...overrides
  };
}

function group(overrides: Partial<EnrollmentOptionGroupDto> = {}): EnrollmentOptionGroupDto {
  return {
    id: 'group-1',
    name: 'Grupa I',
    disciplineName: 'Akrobatyka',
    locality: 'Płock',
    branchId: null,
    slots: [slot()],
    ...overrides
  };
}

describe('AcademyEnrollAthleteComponent', () => {
  const selectedId = signal<string | null>('sf-1');
  let getEnrollmentOptions: jasmine.Spy;
  let createEnrollmentRequest: jasmine.Spy;
  let joinWaitlist: jasmine.Spy;
  let leaveWaitlist: jasmine.Spy;
  let navigate: jasmine.Spy;

  async function render(): Promise<ComponentFixture<AcademyEnrollAthleteComponent>> {
    const fixture = TestBed.createComponent(AcademyEnrollAthleteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<AcademyEnrollAthleteComponent>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function slotToggleButtons(fixture: ComponentFixture<AcademyEnrollAthleteComponent>): HTMLButtonElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.enroll-athlete__slot-toggle')
    ) as HTMLButtonElement[];
  }

  beforeEach(() => {
    selectedId.set('sf-1');
    getEnrollmentOptions = jasmine.createSpy('getEnrollmentOptions').and.returnValue(of([group()]));
    createEnrollmentRequest = jasmine.createSpy('createEnrollmentRequest');
    joinWaitlist = jasmine.createSpy('joinWaitlist');
    leaveWaitlist = jasmine.createSpy('leaveWaitlist');

    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        {
          provide: AcademyApiService,
          useValue: { getEnrollmentOptions, createEnrollmentRequest, joinWaitlist, leaveWaitlist }
        },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: selectedId.asReadonly() } },
        provideRouter([])
      ]
    });

    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { paramMap: convertToParamMap({ athleteId: 'ath-1' }) } }
    });

    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  it('shows a loading state before the enrollment options resolve', () => {
    const fixture = TestBed.createComponent(AcademyEnrollAthleteComponent);
    fixture.detectChanges();

    expect(text(fixture)).toContain('academy.enroll.loading');
  });

  it('loads options and shows the error state with retry on failure', async () => {
    getEnrollmentOptions.and.returnValue(throwError(() => new Error('boom')));
    const fixture = await render();

    expect(text(fixture)).toContain('academy.enroll.loadError');

    getEnrollmentOptions.and.returnValue(of([group()]));
    getEnrollmentOptions.calls.reset();
    (fixture.nativeElement as HTMLElement).querySelector('button')?.dispatchEvent(new Event('click'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getEnrollmentOptions).toHaveBeenCalledWith('sf-1', 'ath-1');
    expect(fixture.componentInstance['status']()).toBe('loaded');
  });

  it('groups slots by locality, falling back to the noLocality label for a null/empty locality', async () => {
    getEnrollmentOptions.and.returnValue(
      of([
        group({ id: 'g1', locality: 'Płock' }),
        group({ id: 'g2', name: 'Grupa II', locality: null }),
        group({ id: 'g3', name: 'Grupa III', locality: '' })
      ])
    );
    const fixture = await render();

    const headings = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.enroll-athlete__locality-heading')
    ).map((h) => h.textContent?.trim());

    expect(headings).toEqual(['Płock', 'academy.enroll.noLocality']);
    // g2 (null) and g3 ('') fold into the same "no locality" bucket rather than creating two tiles.
    expect(text(fixture)).toContain('Grupa II');
    expect(text(fixture)).toContain('Grupa III');
  });

  it('shows the empty notice when there are no groups at all', async () => {
    getEnrollmentOptions.and.returnValue(of([]));
    const fixture = await render();

    expect(text(fixture)).toContain('academy.enroll.empty');
  });

  it('toggles a free, open slot into the selection and back out', async () => {
    const fixture = await render();

    expect(fixture.componentInstance['selectedSlotIds']().size).toBe(0);
    const toggle = slotToggleButtons(fixture)[0];
    toggle.click();
    fixture.detectChanges();

    expect(fixture.componentInstance['selectedSlotIds']().has('slot-1')).toBeTrue();
    expect(toggle.closest('.enroll-athlete__slot')?.classList.contains('is-selected')).toBeTrue();

    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedSlotIds']().has('slot-1')).toBeFalse();
  });

  it('cannot select an already-enrolled slot', async () => {
    getEnrollmentOptions.and.returnValue(of([group({ slots: [slot({ alreadyEnrolled: true })] })]));
    const fixture = await render();

    const toggle = slotToggleButtons(fixture)[0];
    expect(toggle.disabled).toBeTrue();
    expect(text(fixture)).toContain('academy.enroll.alreadyEnrolled');

    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedSlotIds']().size).toBe(0);
  });

  it('cannot select a slot with an already-pending request', async () => {
    getEnrollmentOptions.and.returnValue(of([group({ slots: [slot({ alreadyRequested: true })] })]));
    const fixture = await render();

    const toggle = slotToggleButtons(fixture)[0];
    expect(toggle.disabled).toBeTrue();
    expect(text(fixture)).toContain('academy.enroll.pendingRequest');

    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedSlotIds']().size).toBe(0);
  });

  it('cannot select a full slot, and always still shows it with a full badge', async () => {
    getEnrollmentOptions.and.returnValue(of([group({ slots: [slot({ capacity: 10, freeSpots: 0 })] })]));
    const fixture = await render();

    const toggle = slotToggleButtons(fixture)[0];
    expect(toggle.disabled).toBeTrue();
    expect(text(fixture)).toContain('academy.enroll.full');

    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedSlotIds']().size).toBe(0);
  });

  it('shows unlimited spots for a null-capacity slot and a numeric count otherwise', async () => {
    getEnrollmentOptions.and.returnValue(
      of([
        group({
          id: 'g1',
          slots: [slot({ id: 's-unlimited', capacity: null, freeSpots: null }), slot({ id: 's-count', capacity: 10, freeSpots: 3 })]
        })
      ])
    );
    const fixture = await render();

    expect(text(fixture)).toContain('academy.enroll.unlimitedSpots');
    expect(text(fixture)).toContain('academy.enroll.freeSpotsCount');
  });

  it('disables submit while nothing is selected, and submits the selected slots as one request', async () => {
    createEnrollmentRequest.and.returnValue(of('request-1'));
    getEnrollmentOptions.and.returnValue(
      of([group({ slots: [slot({ id: 's1' }), slot({ id: 's2' })] })])
    );
    const fixture = await render();

    const submitButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ).find((b) => b.textContent?.includes('academy.enroll.submit')) as HTMLButtonElement;
    expect(submitButton.disabled).toBeTrue();

    const toggles = slotToggleButtons(fixture);
    toggles[0].click();
    toggles[1].click();
    fixture.detectChanges();
    expect(submitButton.disabled).toBeFalse();

    submitButton.click();
    fixture.detectChanges();

    expect(createEnrollmentRequest).toHaveBeenCalledWith('ath-1', {
      storefrontId: 'sf-1',
      addSlotIds: ['s1', 's2'],
      removeSlotIds: [],
      note: null
    });
    expect(navigate).toHaveBeenCalledWith(['/academy/children', 'ath-1']);
  });

  it('shows a mapped error and does not navigate when submit fails', async () => {
    createEnrollmentRequest.and.returnValue(
      throwError(() => new HttpErrorResponse({ error: { errors: [{ code: 'slot_full' }] }, status: 400 }))
    );
    const fixture = await render();

    slotToggleButtons(fixture)[0].click();
    fixture.detectChanges();

    const submitButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ).find((b) => b.textContent?.includes('academy.enroll.submit')) as HTMLButtonElement;
    submitButton.click();
    fixture.detectChanges();

    expect(text(fixture)).toContain('academy.enroll.errors.full');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('joins the waitlist for a full slot and reloads to reflect the new state', async () => {
    joinWaitlist.and.returnValue(of(undefined));
    getEnrollmentOptions.and.returnValues(
      of([group({ slots: [slot({ capacity: 10, freeSpots: 0, isOnWaitlist: false })] })]),
      of([group({ slots: [slot({ capacity: 10, freeSpots: 0, isOnWaitlist: true })] })])
    );
    const fixture = await render();

    const waitlistButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.enroll-athlete__waitlist-btn')
    )[0] as HTMLButtonElement;
    expect(waitlistButton.textContent?.trim()).toBe('academy.enroll.joinWaitlist');

    waitlistButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(joinWaitlist).toHaveBeenCalledWith('sf-1', 'ath-1', 'slot-1');
    expect(getEnrollmentOptions).toHaveBeenCalledTimes(2);
    const updatedButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.enroll-athlete__waitlist-btn')
    )[0] as HTMLButtonElement;
    expect(updatedButton.textContent?.trim()).toBe('academy.enroll.leaveWaitlist');
  });

  it('leaves the waitlist when already on it', async () => {
    leaveWaitlist.and.returnValue(of(undefined));
    getEnrollmentOptions.and.returnValue(
      of([group({ slots: [slot({ capacity: 10, freeSpots: 0, isOnWaitlist: true })] })])
    );
    const fixture = await render();

    const waitlistButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.enroll-athlete__waitlist-btn')
    )[0] as HTMLButtonElement;
    expect(waitlistButton.textContent?.trim()).toBe('academy.enroll.leaveWaitlist');

    waitlistButton.click();
    fixture.detectChanges();

    expect(leaveWaitlist).toHaveBeenCalledWith('sf-1', 'ath-1', 'slot-1');
  });

  it('shows a mapped error when a waitlist action fails, without blocking further attempts', async () => {
    joinWaitlist.and.returnValue(
      throwError(
        () => new HttpErrorResponse({ error: { errors: [{ code: 'already_on_slot_waitlist' }] }, status: 400 })
      )
    );
    getEnrollmentOptions.and.returnValue(
      of([group({ slots: [slot({ capacity: 10, freeSpots: 0, isOnWaitlist: false })] })])
    );
    const fixture = await render();

    const waitlistButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.enroll-athlete__waitlist-btn')
    )[0] as HTMLButtonElement;
    waitlistButton.click();
    fixture.detectChanges();

    expect(text(fixture)).toContain('academy.enroll.errors.alreadyOnWaitlist');
    expect(waitlistButton.disabled).toBeFalse();
  });
});
