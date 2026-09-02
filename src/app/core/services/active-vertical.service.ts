import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import { StorefrontContextService } from './storefront-context.service';
import { MembershipsCacheService } from './memberships-cache.service';

// FitnessClub started as a single-vertical (Fitness) app and is now multi-vertical: a member/parent
// whose active club is a sports academy (backend BusinessType "SportsSchool") gets the Academy tab set
// instead of the fitness one. This resolves "which vertical is the active club" from the already-cached
// membership list — MembershipDto.businessType rides along on GET /members/me/memberships, so no extra
// request. Anything unknown (no active club, membership not found, null businessType from a fail-open
// backend lookup) falls back to 'fitness', preserving the app's original behaviour.
export type Vertical = 'fitness' | 'academy';

const SPORTS_SCHOOL_BUSINESS_TYPE = 'SportsSchool';

@Injectable({ providedIn: 'root' })
export class ActiveVerticalService {
  private readonly storefrontContext = inject(StorefrontContextService);
  private readonly membershipsCache = inject(MembershipsCacheService);

  private latest: Vertical = 'fitness';

  readonly activeVertical$: Observable<Vertical> = combineLatest([
    this.storefrontContext.selectedStorefrontId$,
    this.membershipsCache.memberships$
  ]).pipe(
    map(([storefrontId, memberships]): Vertical => {
      const membership = memberships.find((m) => m.storefrontId === storefrontId);
      return membership?.businessType === SPORTS_SCHOOL_BUSINESS_TYPE ? 'academy' : 'fitness';
    }),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  constructor() {
    // Keep a synchronous snapshot for callers that can't take an Observable (e.g. a route guard).
    this.activeVertical$.subscribe((vertical) => (this.latest = vertical));
  }

  snapshot(): Vertical {
    return this.latest;
  }
}
