import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MembershipDto } from '../models/member';
import { Section } from '../services/active-sections';
import { MembershipContextService, MembershipStatus } from '../services/membership-context';
import { StorefrontContextService } from '../services/storefront-context';
import { homeRedirectGuard, requireSection } from './active-storefront-guard';

const GROUPS = ['academy'];
const CLASSES = ['classes_schedule', 'carnets_billing', 'club_members'];

function membership(storefrontId: string, services: string[]): MembershipDto {
  return {
    storefrontId,
    joinedAt: '2026-01-01T00:00:00Z',
    storefrontName: `Akademia ${storefrontId}`,
    businessType: 'Academy',
    services,
    clubBackgroundDarkImage: null,
    clubBackgroundLightImage: null
  };
}

describe('section guards', () => {
  const memberships = signal<MembershipDto[]>([]);
  const status = signal<MembershipStatus>('loaded');
  let parseUrl: jasmine.Spy;

  beforeEach(() => {
    memberships.set([]);
    status.set('loaded');
    localStorage.removeItem('academy.active-storefront-id');
    parseUrl = jasmine.createSpy('parseUrl').and.callFake((url: string) => ({ url }));

    TestBed.configureTestingModule({
      providers: [
        StorefrontContextService,
        {
          provide: MembershipContextService,
          useValue: {
            ensureLoaded: jasmine.createSpy('ensureLoaded').and.resolveTo(),
            memberships: memberships.asReadonly(),
            status: status.asReadonly()
          }
        },
        { provide: Router, useValue: { parseUrl } }
      ]
    });
  });

  describe('requireSection', () => {
    function run(section: Section): unknown {
      return TestBed.runInInjectionContext(() => requireSection(section)({} as never, {} as never));
    }

    function activate(services: string[]): void {
      memberships.set([membership('a', services)]);
      TestBed.inject(StorefrontContextService).select('a');
    }

    it('lets the route through when the active academy offers the section', () => {
      activate(CLASSES);

      expect(run('classes')).toBeTrue();
    });

    it("redirects to the active academy's own home when it lacks the section", () => {
      activate(CLASSES);

      expect(run('academy')).toEqual({ url: '/classes' });
    });

    it('lets both sections through for an academy offering both', () => {
      activate([...GROUPS, ...CLASSES]);

      expect(run('academy')).toBeTrue();
      expect(run('classes')).toBeTrue();
    });

    it('redirects a groups-only academy away from classes', () => {
      activate(GROUPS);

      expect(run('classes')).toEqual({ url: '/academy' });
    });

    it('sends an academy without any section to its card', () => {
      activate([]);

      expect(run('academy')).toEqual({ url: '/clubs/a' });
    });

    it('fails open when no active academy is known', () => {
      expect(run('classes')).toBeTrue();
    });
  });

  describe('homeRedirectGuard', () => {
    function run(): Promise<unknown> {
      return TestBed.runInInjectionContext(() => homeRedirectGuard({} as never, {} as never)) as Promise<unknown>;
    }

    it('sends a member of several academies to the dashboard', async () => {
      memberships.set([membership('a', GROUPS), membership('f', CLASSES)]);
      expect(await run()).toEqual({ url: '/clubs' });
    });

    it("selects a single academy and opens its first section", async () => {
      memberships.set([membership('f', CLASSES)]);
      expect(await run()).toEqual({ url: '/classes' });
      expect(TestBed.inject(StorefrontContextService).selectedStorefrontId()).toBe('f');
    });

    it('opens groups first for a single academy offering both sections', async () => {
      memberships.set([membership('b', [...CLASSES, ...GROUPS])]);
      expect(await run()).toEqual({ url: '/academy' });
    });

    it('sends a member of no academy to the finder', async () => {
      expect(await run()).toEqual({ url: '/find-club' });
    });
  });
});
