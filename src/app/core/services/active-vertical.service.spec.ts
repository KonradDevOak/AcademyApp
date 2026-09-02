import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ActiveVerticalService } from './active-vertical.service';
import { StorefrontContextService } from './storefront-context.service';
import { MembershipsCacheService } from './memberships-cache.service';
import { MembershipDto } from '../models/member.model';

describe('ActiveVerticalService', () => {
  let selectedStorefrontId$: BehaviorSubject<string | null>;
  let memberships$: BehaviorSubject<MembershipDto[]>;

  const membership = (storefrontId: string, businessType?: string | null): MembershipDto => ({
    storefrontId,
    joinedAt: new Date().toISOString(),
    storefrontName: storefrontId,
    businessType
  });

  function createService(): ActiveVerticalService {
    TestBed.configureTestingModule({
      providers: [
        { provide: StorefrontContextService, useValue: { selectedStorefrontId$: selectedStorefrontId$.asObservable() } },
        { provide: MembershipsCacheService, useValue: { memberships$: memberships$.asObservable() } }
      ]
    });
    return TestBed.inject(ActiveVerticalService);
  }

  beforeEach(() => {
    selectedStorefrontId$ = new BehaviorSubject<string | null>(null);
    memberships$ = new BehaviorSubject<MembershipDto[]>([]);
  });

  it('resolves to academy when the active club is a SportsSchool', async () => {
    memberships$.next([membership('club-1', 'SportsSchool')]);
    selectedStorefrontId$.next('club-1');

    const service = createService();

    expect(await firstValueFrom(service.activeVertical$)).toBe('academy');
    expect(service.snapshot()).toBe('academy');
  });

  it('resolves to fitness when the active club is a Fitness storefront', async () => {
    memberships$.next([membership('club-1', 'Fitness')]);
    selectedStorefrontId$.next('club-1');

    const service = createService();

    expect(await firstValueFrom(service.activeVertical$)).toBe('fitness');
  });

  it('falls back to fitness when businessType is null or the membership is unknown', async () => {
    memberships$.next([membership('club-1', null)]);
    selectedStorefrontId$.next('club-1');

    const service = createService();
    expect(await firstValueFrom(service.activeVertical$)).toBe('fitness');

    selectedStorefrontId$.next('club-unknown');
    expect(await firstValueFrom(service.activeVertical$)).toBe('fitness');
  });

  it('switches when the active storefront changes', async () => {
    memberships$.next([membership('fit', 'Fitness'), membership('academy', 'SportsSchool')]);
    selectedStorefrontId$.next('fit');

    const service = createService();
    expect(await firstValueFrom(service.activeVertical$)).toBe('fitness');

    selectedStorefrontId$.next('academy');
    expect(await firstValueFrom(service.activeVertical$)).toBe('academy');
    expect(service.snapshot()).toBe('academy');
  });
});
