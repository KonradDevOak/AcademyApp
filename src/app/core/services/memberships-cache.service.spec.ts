import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MembershipsCacheService, PREFERENCES_PLUGIN } from './memberships-cache.service';
import { MembersApiService } from './members-api.service';
import { MembershipDto } from '../models/member.model';

describe('MembershipsCacheService', () => {
  let service: MembershipsCacheService;
  let membersApi: jasmine.SpyObj<MembersApiService>;
  let store: Record<string, string>;

  const membership: MembershipDto = {
    storefrontId: 'club-1',
    storefrontName: 'Fit Club',
    joinedAt: new Date().toISOString()
  };

  beforeEach(() => {
    store = {};
    membersApi = jasmine.createSpyObj('MembersApiService', ['getMyMemberships']);
    membersApi.getMyMemberships.and.returnValue(of([membership]));

    const preferencesStub = {
      get: async ({ key }: { key: string }) => ({ value: store[key] ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => {
        store[key] = value;
      },
      remove: async ({ key }: { key: string }) => {
        delete store[key];
      }
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: MembersApiService, useValue: membersApi },
        { provide: PREFERENCES_PLUGIN, useValue: preferencesStub }
      ]
    });
    service = TestBed.inject(MembershipsCacheService);
  });

  it('fetches from the backend and caches when there is no cache yet', async () => {
    const result = await service.getOrRefresh();

    expect(result).toEqual([membership]);
    expect(membersApi.getMyMemberships).toHaveBeenCalledTimes(1);
    expect(store['memberships-cache']).toBeDefined();
  });

  it('returns cached memberships without hitting the backend when the cache is fresh', async () => {
    store['memberships-cache'] = JSON.stringify({ memberships: [membership], fetchedAt: Date.now() });

    const result = await service.getOrRefresh();

    expect(result).toEqual([membership]);
    expect(membersApi.getMyMemberships).not.toHaveBeenCalled();
  });

  it('refetches from the backend when the cache is older than 24 hours', async () => {
    const staleFetchedAt = Date.now() - 25 * 60 * 60 * 1000;
    store['memberships-cache'] = JSON.stringify({ memberships: [membership], fetchedAt: staleFetchedAt });

    await service.getOrRefresh();

    expect(membersApi.getMyMemberships).toHaveBeenCalledTimes(1);
  });

  it('refresh() always hits the backend regardless of cache freshness', async () => {
    store['memberships-cache'] = JSON.stringify({ memberships: [membership], fetchedAt: Date.now() });

    await service.refresh();

    expect(membersApi.getMyMemberships).toHaveBeenCalledTimes(1);
  });

  it('emits fetched memberships on memberships$', async () => {
    const emitted: MembershipDto[][] = [];
    service.memberships$.subscribe((m: MembershipDto[]) => emitted.push(m));

    await service.getOrRefresh();

    expect(emitted[emitted.length - 1]).toEqual([membership]);
  });

  it('invalidate() clears the cache and resets memberships$ to empty', async () => {
    await service.getOrRefresh();

    await service.invalidate();

    expect(store['memberships-cache']).toBeUndefined();
    let latest: MembershipDto[] = [];
    service.memberships$.subscribe((m: MembershipDto[]) => (latest = m));
    expect(latest).toEqual([]);
  });
});
