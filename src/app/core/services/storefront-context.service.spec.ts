import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { ActionSheetController } from '@ionic/angular/standalone';
import { Preferences } from '@capacitor/preferences';
import { StorefrontContextService, ActiveClubBackground } from './storefront-context.service';
import { MembershipsCacheService } from './memberships-cache.service';
import { MembershipDto } from '../models/member.model';
import { StorefrontImageDto } from '../models/storefront.model';

describe('StorefrontContextService — activeClubBackground$', () => {
  let service: StorefrontContextService;
  let membershipsSubject: BehaviorSubject<MembershipDto[]>;

  const dark: StorefrontImageDto = { id: 'd1', url: 'https://example.com/dark.png', fileName: 'bg-dark.png' };
  const light: StorefrontImageDto = { id: 'l1', url: 'https://example.com/light.png', fileName: 'bg-light.png' };

  const membership: MembershipDto = {
    storefrontId: 'club-1',
    storefrontName: 'Fit Club',
    joinedAt: new Date().toISOString(),
    clubBackgroundDarkImage: dark,
    clubBackgroundLightImage: light
  };

  beforeEach(async () => {
    await Preferences.clear();
    membershipsSubject = new BehaviorSubject<MembershipDto[]>([membership]);
    const membershipsCache = { memberships$: membershipsSubject.asObservable() };

    TestBed.configureTestingModule({
      providers: [
        { provide: MembershipsCacheService, useValue: membershipsCache },
        { provide: ActionSheetController, useValue: {} }
      ]
    });
    service = TestBed.inject(StorefrontContextService);
  });

  it('emits null when no club is active', async () => {
    const emitted: (ActiveClubBackground | null)[] = [];
    service.activeClubBackground$.subscribe((v: ActiveClubBackground | null) => emitted.push(v));

    expect(emitted[emitted.length - 1]).toBeNull();
  });

  it('emits the active club\'s background images once selected', async () => {
    const emitted: (ActiveClubBackground | null)[] = [];
    service.activeClubBackground$.subscribe((v: ActiveClubBackground | null) => emitted.push(v));

    await service.select('club-1');

    expect(emitted[emitted.length - 1]).toEqual({ dark, light });
  });

  it('emits null when the active id no longer matches any membership', async () => {
    const emitted: (ActiveClubBackground | null)[] = [];
    await service.select('club-1');
    service.activeClubBackground$.subscribe((v: ActiveClubBackground | null) => emitted.push(v));

    membershipsSubject.next([]);

    expect(emitted[emitted.length - 1]).toBeNull();
  });
});
