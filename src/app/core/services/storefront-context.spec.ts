import { TestBed } from '@angular/core/testing';
import { MembershipDto } from '../models/member';
import { StorefrontContextService } from './storefront-context';

const STORAGE_KEY = 'academy.active-storefront-id';

function membership(storefrontId: string): MembershipDto {
  return {
    storefrontId,
    joinedAt: '2026-01-01T00:00:00Z',
    storefrontName: `Klub ${storefrontId}`,
    businessType: 'Academy',
    services: ['academy'],
    clubBackgroundDarkImage: null,
    clubBackgroundLightImage: null
  };
}

describe('StorefrontContextService', () => {
  let service: StorefrontContextService;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({ providers: [StorefrontContextService] });
    service = TestBed.inject(StorefrontContextService);
  });

  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('persists and clears the selected storefront', () => {
    service.select('sf-9');
    expect(service.selectedStorefrontId()).toBe('sf-9');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('sf-9');

    service.clear();
    expect(service.selectedStorefrontId()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  describe('resolveForNavigation', () => {
    it('returns "empty" for zero memberships', () => {
      expect(service.resolveForNavigation([]).outcome).toBe('empty');
    });

    it('auto-selects the only club and returns "ok"', () => {
      const result = service.resolveForNavigation([membership('only')]);
      expect(result).toEqual({ outcome: 'ok', storefrontId: 'only' });
      expect(service.selectedStorefrontId()).toBe('only');
      expect(localStorage.getItem(STORAGE_KEY)).toBe('only');
    });

    it('returns "needs-picker" for >1 club with no remembered choice', () => {
      expect(service.resolveForNavigation([membership('a'), membership('b')]).outcome).toBe('needs-picker');
    });

    it('returns "ok" for >1 club when the remembered choice is still valid', () => {
      service.select('b');
      const result = service.resolveForNavigation([membership('a'), membership('b')]);
      expect(result).toEqual({ outcome: 'ok', storefrontId: 'b' });
    });

    it('returns "needs-picker" for >1 club when the remembered choice is stale', () => {
      service.select('gone');
      expect(service.resolveForNavigation([membership('a'), membership('b')]).outcome).toBe('needs-picker');
    });
  });

  describe('getPersistedIfValid', () => {
    it('returns the id when it matches a membership', () => {
      service.select('a');
      expect(service.getPersistedIfValid([membership('a'), membership('b')])).toBe('a');
    });

    it('returns null when it does not match', () => {
      service.select('x');
      expect(service.getPersistedIfValid([membership('a')])).toBeNull();
    });
  });
});
