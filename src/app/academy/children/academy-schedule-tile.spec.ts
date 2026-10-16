import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EnrolledSlotDto, EnrollmentRequestDto, SlotWaitlistEntryDto } from '@konraddevoak/academy-api';
import { provideTranslateService } from '@ngx-translate/core';
import { AcademyScheduleTileComponent, ScheduleTile } from './academy-schedule-tile';

const slot = { slotId: 'slot-1', groupName: 'Grupa I', dayOfWeek: 'Monday', startTime: '17:00:00', endTime: '18:30:00' } as EnrolledSlotDto;
const request = { id: 'req-1', waitlistNote: 'Po feriach' } as EnrollmentRequestDto;
const entry = { id: 'wl-1', trainingSlotId: 'slot-1' } as SlotWaitlistEntryDto;

function tile(overrides: Partial<ScheduleTile>): ScheduleTile {
  return {
    key: 'k',
    state: 'enrolled',
    groupName: 'Grupa I',
    dayOfWeek: 'Monday',
    startTime: '17:00:00',
    endTime: '18:30:00',
    ...overrides
  };
}

@Component({
  imports: [AcademyScheduleTileComponent],
  template: `<ul>
    <li
      app-academy-schedule-tile
      [tile]="tile()"
      [busy]="busy()"
      (withdraw)="withdrawn = $event"
      (cancelRequest)="cancelled = $event"
      (leaveWaitlist)="left = $event"
    ></li>
  </ul>`
})
class HostComponent {
  readonly tile = signal<ScheduleTile>(tile({ slot }));
  readonly busy = signal(false);
  withdrawn: EnrolledSlotDto | null = null;
  cancelled: EnrollmentRequestDto | null = null;
  left: SlotWaitlistEntryDto | null = null;
}

describe('AcademyScheduleTileComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  function li(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('li.schedule-tile') as HTMLElement;
  }

  function buttons(): HTMLButtonElement[] {
    return Array.from(li().querySelectorAll('button'));
  }

  function show(value: ScheduleTile, busy = false): void {
    fixture.componentInstance.tile.set(value);
    fixture.componentInstance.busy.set(busy);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders an enrolled slot with its group, day, time and a Withdraw action that emits the slot', () => {
    expect(li().dataset['state']).toBe('enrolled');
    expect(li().textContent).toContain('Grupa I');
    expect(li().textContent).toContain('academy.day.monday');
    expect(li().textContent).toContain('17:00–18:30');
    expect(li().querySelector('.badge--ok')?.textContent?.trim()).toBe('academy.childDetail.schedule.status.enrolled');
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['academy.childDetail.schedule.withdraw']);

    buttons()[0].click();
    expect(fixture.componentInstance.withdrawn).toBe(slot);
  });

  it('offers "cancel withdrawal" on a withdrawal-pending tile and emits its request', () => {
    show(tile({ state: 'withdrawPending', slot, request }));

    expect(li().textContent).toContain('academy.childDetail.schedule.status.withdrawPending');
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['academy.childDetail.schedule.cancelWithdraw']);
    buttons()[0].click();
    expect(fixture.componentInstance.cancelled).toBe(request);
  });

  it('shows the club waitlist info and note on a Waitlisted request tile', () => {
    show(tile({ state: 'Waitlisted', request }));

    expect(li().querySelector('.badge--warn')?.textContent?.trim()).toBe('academy.childDetail.requests.status.Waitlisted');
    expect(li().textContent).toContain('academy.childDetail.requests.waitlistedInfo');
    expect(li().textContent).toContain('Po feriach');
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['academy.childDetail.requests.cancel']);
  });

  it('warns that cancelling also covers the other slots of the same request', () => {
    show(tile({ state: 'Pending', request, otherRequestSlots: ['Grupa II · Piątek'] }));

    expect(li().textContent).toContain('academy.childDetail.schedule.cancelAlsoAffects');
    expect(li().querySelector('.badge--muted')).not.toBeNull();
  });

  it('offers Leave waitlist on a slot-waitlist tile, disabled while busy', () => {
    show(tile({ state: 'slotWaitlist', waitlistEntry: entry }), true);

    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['academy.enroll.leaveWaitlist']);
    expect(buttons()[0].disabled).toBeTrue();

    show(tile({ state: 'slotWaitlist', waitlistEntry: entry }));
    buttons()[0].click();
    expect(fixture.componentInstance.left).toBe(entry);
  });
});
