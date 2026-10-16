import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { MembershipDto } from '../models/member';
import { MembersApiService } from './members-api';
import { MEMBERSHIPS_STALE_AFTER_MS, MembershipContextService } from './membership-context';

function membership(overrides: Partial<MembershipDto> = {}): MembershipDto {
  return {
    storefrontId: 'sf-1',
    joinedAt: '2026-01-01T00:00:00Z',
    storefrontName: 'Klub Drobin',
    businessType: 'Academy',
    services: ['academy'],
    clubBackgroundDarkImage: null,
    clubBackgroundLightImage: null,
    ...overrides
  };
}

describe('MembershipContextService', () => {
  let getMyMemberships: jasmine.Spy;

  function create(): MembershipContextService {
    TestBed.configureTestingModule({
      providers: [{ provide: MembersApiService, useValue: { getMyMemberships } }]
    });
    return TestBed.inject(MembershipContextService);
  }

  beforeEach(() => {
    getMyMemberships = jasmine.createSpy('getMyMemberships');
  });

  it('starts idle and fetches once on the first ensureLoaded()', async () => {
    getMyMemberships.and.returnValue(of([membership()]));
    const service = create();

    expect(service.status()).toBe('idle');

    await service.ensureLoaded();

    expect(getMyMemberships).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('loaded');
    expect(service.memberships()).toEqual([membership()]);
  });

  it('does not re-fetch on a second ensureLoaded() once already loaded', async () => {
    getMyMemberships.and.returnValue(of([membership()]));
    const service = create();

    await service.ensureLoaded();
    await service.ensureLoaded();

    expect(getMyMemberships).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const subject = new Subject<MembershipDto[]>();
    getMyMemberships.and.returnValue(subject.asObservable());
    const service = create();

    const first = service.ensureLoaded();
    const second = service.ensureLoaded();
    expect(service.status()).toBe('loading');

    subject.next([membership()]);
    subject.complete();
    await Promise.all([first, second]);

    expect(getMyMemberships).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('loaded');
  });

  it('reload() forces a re-fetch even when already loaded', async () => {
    getMyMemberships.and.returnValue(of([membership()]));
    const service = create();
    await service.ensureLoaded();
    getMyMemberships.calls.reset();

    getMyMemberships.and.returnValue(of([membership({ storefrontId: 'sf-2' })]));
    await service.reload();

    expect(getMyMemberships).toHaveBeenCalledTimes(1);
    expect(service.memberships()).toEqual([membership({ storefrontId: 'sf-2' })]);
  });

  it('sets status to error and clears memberships when the fetch fails', async () => {
    getMyMemberships.and.returnValue(throwError(() => new Error('network')));
    const service = create();

    await service.ensureLoaded();

    expect(service.status()).toBe('error');
    expect(service.memberships()).toEqual([]);
  });

  it('keeps only academies', async () => {
    getMyMemberships.and.returnValue(
      of([
        membership({ storefrontId: 'groups', businessType: 'Academy', services: ['academy'] }),
        membership({ storefrontId: 'classes', businessType: 'Academy', services: ['classes_schedule', 'carnets_billing'] }),
        membership({ storefrontId: 'legacy', businessType: 'Fitness' }),
        membership({ storefrontId: 'retail', businessType: 'Retail' }),
        membership({ storefrontId: 'unknown', businessType: null })
      ])
    );
    const service = create();

    await service.ensureLoaded();

    expect(service.memberships().map((m) => m.storefrontId)).toEqual(['groups', 'classes']);
  });

  describe('background refresh', () => {
    let now: number;

    beforeEach(() => {
      now = Date.parse('2026-10-13T10:00:00Z');
      spyOn(Date, 'now').and.callFake(() => now);
    });

    async function loadedService(): Promise<MembershipContextService> {
      getMyMemberships.and.returnValue(of([membership()]));
      const service = create();
      await service.ensureLoaded();
      getMyMemberships.calls.reset();
      return service;
    }

    it('skips the request while the list is still fresh', async () => {
      const service = await loadedService();
      now += MEMBERSHIPS_STALE_AFTER_MS - 1;

      await service.refreshIfStale();

      expect(getMyMemberships).not.toHaveBeenCalled();
    });

    it('replaces a stale list without going through the loading state', async () => {
      const service = await loadedService();
      now += MEMBERSHIPS_STALE_AFTER_MS;
      const subject = new Subject<MembershipDto[]>();
      getMyMemberships.and.returnValue(subject.asObservable());

      const refresh = service.refreshIfStale();
      expect(service.status()).toBe('loaded');
      subject.next([membership({ storefrontId: 'sf-2' })]);
      subject.complete();
      await refresh;

      expect(service.status()).toBe('loaded');
      expect(service.memberships().map((m) => m.storefrontId)).toEqual(['sf-2']);
    });

    it('keeps the list already shown when the refresh fails', async () => {
      const service = await loadedService();
      now += MEMBERSHIPS_STALE_AFTER_MS;
      getMyMemberships.and.returnValue(throwError(() => new Error('network')));

      await service.refreshIfStale();

      expect(service.status()).toBe('loaded');
      expect(service.memberships()).toEqual([membership()]);
    });

    it('does nothing before the first load', async () => {
      const service = create();

      await service.refreshIfStale();

      expect(getMyMemberships).not.toHaveBeenCalled();
      expect(service.status()).toBe('idle');
    });

    it('runs when the tab becomes visible again', async () => {
      const service = await loadedService();
      now += MEMBERSHIPS_STALE_AFTER_MS;
      getMyMemberships.and.returnValue(of([membership({ storefrontId: 'sf-2' })]));
      const document = TestBed.inject(DOCUMENT);
      spyOnProperty(document, 'visibilityState').and.returnValue('visible');

      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
      await Promise.resolve();

      expect(getMyMemberships).toHaveBeenCalledTimes(1);
      expect(service.memberships().map((m) => m.storefrontId)).toEqual(['sf-2']);
    });
  });
});
