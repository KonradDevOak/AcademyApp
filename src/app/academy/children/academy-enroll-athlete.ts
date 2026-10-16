import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AcademyApiService,
  EnrollmentOptionGroupDto,
  EnrollmentOptionSlotDto,
  dayKey,
  shortTime
} from '@konraddevoak/academy-api';
import { TranslatePipe } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { enrollAthleteErrorKey } from '../enroll-athlete-errors';

type EnrollStatus = 'loading' | 'loaded' | 'error';

interface LocalityBucket {
  // null only for the very first group encountered whose `locality` itself is null/empty — the
  // template falls back to the `noLocality` i18n label for it, so pre-backfill groups still render
  // instead of vanishing.
  locality: string | null;
  groups: EnrollmentOptionGroupDto[];
}

// "Zgłoś zawodnika" — lets a parent browse the club's open training slots (grouped by locality, then
// by group) and submit a multi-slot enrollment request in one go, or join/leave the waitlist for a
// full slot. Visual precedent: Showcase's public "Lokalizacje" accordion (home.component.html,
// #lokalizacje) — same locality/full-slot/free-spots-count conventions, reimplemented locally since
// Showcase is a separate repo with no shared code.
@Component({
  selector: 'app-academy-enroll-athlete',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './academy-enroll-athlete.html',
  styleUrl: './academy-enroll-athlete.scss'
})
export class AcademyEnrollAthleteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AcademyApiService);
  private readonly storefrontContext = inject(StorefrontContextService);

  protected readonly athleteId = this.route.snapshot.paramMap.get('athleteId') ?? '';

  private readonly _status = signal<EnrollStatus>('loading');
  private readonly _groups = signal<EnrollmentOptionGroupDto[]>([]);
  private readonly _selectedSlotIds = signal<ReadonlySet<string>>(new Set());
  private readonly _isSubmitting = signal(false);
  private readonly _submitError = signal<string | null>(null);
  // Tracks which single slot's join/leave-waitlist call is in flight, so only that slot's button
  // disables instead of the whole page.
  private readonly _joiningWaitlistSlotId = signal<string | null>(null);
  private readonly _waitlistActionError = signal<string | null>(null);

  protected readonly status = this._status.asReadonly();
  protected readonly selectedSlotIds = this._selectedSlotIds.asReadonly();
  protected readonly isSubmitting = this._isSubmitting.asReadonly();
  protected readonly submitError = this._submitError.asReadonly();
  protected readonly joiningWaitlistSlotId = this._joiningWaitlistSlotId.asReadonly();
  protected readonly waitlistActionError = this._waitlistActionError.asReadonly();

  protected readonly dayKey = dayKey;
  protected readonly shortTime = shortTime;

  // Buckets groups by locality for the tile rendering, preserving first-seen order. `''` (not just
  // `null`) is folded into the same bucket as `null`, so a mix of empty-string and null localities
  // from the backend doesn't create two separate "no locality" tiles.
  protected readonly localityBuckets = computed<LocalityBucket[]>(() => {
    const buckets = new Map<string, LocalityBucket>();
    for (const group of this._groups()) {
      const key = group.locality ?? '';
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { locality: group.locality, groups: [] };
        buckets.set(key, bucket);
      }
      bucket.groups.push(group);
    }
    return [...buckets.values()];
  });

  ngOnInit(): void {
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected isFull(slot: EnrollmentOptionSlotDto): boolean {
    return slot.capacity !== null && (slot.freeSpots ?? 0) <= 0;
  }

  protected isSelected(slot: EnrollmentOptionSlotDto): boolean {
    return this._selectedSlotIds().has(slot.id);
  }

  protected toggleSlot(slot: EnrollmentOptionSlotDto): void {
    if (slot.alreadyEnrolled || slot.alreadyRequested || this.isFull(slot)) {
      return;
    }

    const next = new Set(this._selectedSlotIds());
    if (next.has(slot.id)) {
      next.delete(slot.id);
    } else {
      next.add(slot.id);
    }
    this._selectedSlotIds.set(next);
  }

  protected joinWaitlist(slot: EnrollmentOptionSlotDto): void {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId || this._joiningWaitlistSlotId()) {
      return;
    }

    this._joiningWaitlistSlotId.set(slot.id);
    this._waitlistActionError.set(null);
    this.api.joinWaitlist(storefrontId, this.athleteId, slot.id).subscribe({
      next: () => {
        this._joiningWaitlistSlotId.set(null);
        this.refreshGroups(storefrontId);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to join waitlist:', error);
        this._joiningWaitlistSlotId.set(null);
        this._waitlistActionError.set(enrollAthleteErrorKey(error));
      }
    });
  }

  protected leaveWaitlist(slot: EnrollmentOptionSlotDto): void {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId || this._joiningWaitlistSlotId()) {
      return;
    }

    this._joiningWaitlistSlotId.set(slot.id);
    this._waitlistActionError.set(null);
    this.api.leaveWaitlist(storefrontId, this.athleteId, slot.id).subscribe({
      next: () => {
        this._joiningWaitlistSlotId.set(null);
        this.refreshGroups(storefrontId);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Failed to leave waitlist:', error);
        this._joiningWaitlistSlotId.set(null);
        this._waitlistActionError.set(enrollAthleteErrorKey(error));
      }
    });
  }

  protected submit(): void {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    const addSlotIds = [...this._selectedSlotIds()];
    if (!storefrontId || addSlotIds.length === 0 || this._isSubmitting()) {
      return;
    }

    this._isSubmitting.set(true);
    this._submitError.set(null);
    this.api
      .createEnrollmentRequest(this.athleteId, { storefrontId, addSlotIds, removeSlotIds: [], note: null })
      .subscribe({
        next: () => {
          this._isSubmitting.set(false);
          void this.router.navigate(['/academy/children', this.athleteId]);
        },
        error: (error: HttpErrorResponse) => {
          console.error('Failed to submit enrollment request:', error);
          this._isSubmitting.set(false);
          this._submitError.set(enrollAthleteErrorKey(error));
        }
      });
  }

  // Refetches only the slot options (used after a waitlist join/leave) — deliberately not the same
  // as load(): it must not flip status() back to 'loading' (that would blank the whole page instead
  // of just settling the one button that was in flight) and must not reset the parent's in-progress
  // slot selection.
  private refreshGroups(storefrontId: string): void {
    this.api.getEnrollmentOptions(storefrontId, this.athleteId).subscribe({
      next: (groups) => this._groups.set(groups),
      error: (error: HttpErrorResponse) => console.error('Failed to refresh enrollment options:', error)
    });
  }

  private async load(): Promise<void> {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId || !this.athleteId) {
      this._status.set('error');
      return;
    }

    this._status.set('loading');
    this._selectedSlotIds.set(new Set());
    try {
      const groups = await firstValueFrom(this.api.getEnrollmentOptions(storefrontId, this.athleteId));
      this._groups.set(groups);
      this._status.set('loaded');
    } catch {
      this._status.set('error');
    }
  }
}
