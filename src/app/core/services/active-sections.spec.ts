import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MembershipDto } from '../models/member';
import { PROFILE_NAV_ITEM } from '../models/nav-item';
import { ActiveSectionsService, homeFor, membershipHome, sectionsOf } from './active-sections';
import { MembershipContextService } from './membership-context';
import { StorefrontContextService } from './storefront-context';

const GROUPS = ['academy', 'academy_payments'];
const CLASSES = ['classes_schedule', 'carnets_billing', 'club_members'];

function membership(overrides: Partial<MembershipDto>): MembershipDto {
  return {
    storefrontId: 'sf-1',
    joinedAt: '2026-01-01T00:00:00Z',
    storefrontName: 'Akademia testowa',
    businessType: 'Academy',
    services: GROUPS,
    clubBackgroundDarkImage: null,
    clubBackgroundLightImage: null,
    ...overrides
  };
}

describe('ActiveSectionsService', () => {
  const memberships = signal<MembershipDto[]>([]);
  const selectedId = signal<string | null>(null);

  function createService(): ActiveSectionsService {
    memberships.set([]);
    selectedId.set(null);
    TestBed.configureTestingModule({
      providers: [
        ActiveSectionsService,
        { provide: MembershipContextService, useValue: { memberships: memberships.asReadonly() } },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: selectedId.asReadonly() } }
      ]
    });
    return TestBed.inject(ActiveSectionsService);
  }

  it('offers only groups for an academy with the academy service', () => {
    const service = createService();
    memberships.set([membership({ storefrontId: 'a', services: GROUPS })]);
    selectedId.set('a');

    expect(service.sections()).toEqual(['academy']);
    expect(service.homePath()).toBe('/academy');
    expect(service.navItems()).toEqual([{ path: '/academy', label: 'shell.nav.academy' }, PROFILE_NAV_ITEM]);
    expect(service.activeClubName()).toBe('Akademia testowa');
  });

  it('offers only classes & passes for an academy with the carnet services', () => {
    const service = createService();
    memberships.set([membership({ storefrontId: 'a', services: CLASSES })]);
    selectedId.set('a');

    expect(service.sections()).toEqual(['classes']);
    expect(service.homePath()).toBe('/classes');
    expect(service.navItems()).toEqual([{ path: '/classes', label: 'shell.nav.classes' }, PROFILE_NAV_ITEM]);
  });

  it('offers both sections, groups first, for an academy with both service sets', () => {
    const service = createService();
    memberships.set([membership({ storefrontId: 'a', services: [...CLASSES, ...GROUPS] })]);
    selectedId.set('a');

    expect(service.sections()).toEqual(['academy', 'classes']);
    expect(service.homePath()).toBe('/academy');
    expect(service.navItems().map((item) => item.path)).toEqual(['/academy', '/classes', '/profile']);
  });

  it('switches the sections with the active academy', () => {
    const service = createService();
    memberships.set([
      membership({ storefrontId: 'a', services: GROUPS }),
      membership({ storefrontId: 'b', services: CLASSES })
    ]);
    selectedId.set('a');
    expect(service.sections()).toEqual(['academy']);

    selectedId.set('b');
    expect(service.sections()).toEqual(['classes']);
  });

  it('falls back to the academy card when the academy offers no section', () => {
    const service = createService();
    memberships.set([membership({ storefrontId: 'a', services: [] })]);
    selectedId.set('a');

    expect(service.sections()).toEqual([]);
    expect(service.homePath()).toBe('/clubs/a');
    expect(service.navItems()).toEqual([PROFILE_NAV_ITEM]);
  });

  it('has no sections when no membership matches the selected id', () => {
    const service = createService();
    memberships.set([membership({ storefrontId: 'a' })]);
    selectedId.set('missing');

    expect(service.activeMembership()).toBeNull();
    expect(service.sections()).toEqual([]);
    expect(service.homePath()).toBe('/');
    expect(service.activeClubName()).toBeNull();
  });
});

describe('sectionsOf / homeFor / membershipHome', () => {
  it('maps services to sections using the backend readiness sets', () => {
    expect(sectionsOf(['academy'])).toEqual(['academy']);
    expect(sectionsOf(['classes_schedule', 'carnets_billing', 'club_members'])).toEqual(['classes']);
    expect(sectionsOf(['academy', 'classes_schedule', 'carnets_billing', 'club_members'])).toEqual([
      'academy',
      'classes'
    ]);
    // A lone sub-feature never opens a section whose API calls the backend would refuse.
    expect(sectionsOf(['academy_attendance'])).toEqual([]);
    expect(sectionsOf(['carnets_billing'])).toEqual([]);
    expect(sectionsOf(['classes_schedule', 'carnets_billing'])).toEqual([]);
    expect(sectionsOf(['menu'])).toEqual([]);
    expect(sectionsOf(null)).toEqual([]);
    expect(sectionsOf(undefined)).toEqual([]);
  });

  it("maps sections to the first section's landing route", () => {
    expect(homeFor(['academy', 'classes'])).toBe('/academy');
    expect(homeFor(['classes'])).toBe('/classes');
    expect(homeFor([], 'sf-1')).toBe('/clubs/sf-1');
    expect(homeFor([])).toBe('/clubs');
  });

  it("resolves a membership's home from its services", () => {
    expect(membershipHome(membership({ services: CLASSES }))).toBe('/classes');
    expect(membershipHome(membership({ services: [...GROUPS, ...CLASSES] }))).toBe('/academy');
  });
});
