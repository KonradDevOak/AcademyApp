import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { EnrolledSlotDto, EnrollmentRequestDto, SlotWaitlistEntryDto, dayKey, shortTime } from '@konraddevoak/academy-api';
import { TranslatePipe } from '@ngx-translate/core';

// One tile per class on the schedule tab. Every place a class can show up for a child — an enrolled slot,
// a slot on an open request, a slot-waitlist entry — collapses into a single tile with exactly one action,
// so the guardian never sees the same class twice with two different buttons.
export type ScheduleTileState = 'enrolled' | 'withdrawPending' | 'Pending' | 'Waitlisted' | 'slotWaitlist';

export interface ScheduleTile {
  key: string;
  state: ScheduleTileState;
  groupName: string | null;
  dayOfWeek: string | null;
  startTime: string;
  endTime: string;
  // Set for 'enrolled' (the slot to withdraw from).
  slot?: EnrolledSlotDto;
  // Set for 'withdrawPending'/'Pending'/'Waitlisted' — the open request the action cancels.
  request?: EnrollmentRequestDto;
  // Labels of the request's other slots: cancelling is per request, not per slot, so they go too.
  otherRequestSlots?: string[];
  // Set for 'slotWaitlist'.
  waitlistEntry?: SlotWaitlistEntryDto;
}

// Presentational only — the parent owns the API calls and the confirm dialog, the tile just emits.
@Component({
  // Attribute selector on <li> keeps the roster a real list for screen readers.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'li[app-academy-schedule-tile]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './academy-schedule-tile.html',
  styleUrl: './academy-schedule-tile.scss',
  host: {
    class: 'schedule-tile',
    '[attr.data-state]': 'tile().state'
  }
})
export class AcademyScheduleTileComponent {
  readonly tile = input.required<ScheduleTile>();
  // The tile's action is in flight (cancel or leave-waitlist) — disables the button against double submits.
  readonly busy = input(false);

  readonly withdraw = output<EnrolledSlotDto>();
  readonly cancelRequest = output<EnrollmentRequestDto>();
  readonly leaveWaitlist = output<SlotWaitlistEntryDto>();

  protected readonly dayKey = dayKey;
  protected readonly shortTime = shortTime;

  protected readonly statusKey = computed(() => {
    const state = this.tile().state;
    return state === 'Pending' || state === 'Waitlisted'
      ? `academy.childDetail.requests.status.${state}`
      : `academy.childDetail.schedule.status.${state}`;
  });

  protected readonly badgeClass = computed(() => {
    switch (this.tile().state) {
      case 'enrolled':
        return 'ok';
      case 'Waitlisted':
      case 'slotWaitlist':
      case 'withdrawPending':
        return 'warn';
      default:
        return 'muted';
    }
  });

  protected readonly cancelLabel = computed(() =>
    this.tile().state === 'withdrawPending'
      ? 'academy.childDetail.schedule.cancelWithdraw'
      : 'academy.childDetail.requests.cancel'
  );
}
