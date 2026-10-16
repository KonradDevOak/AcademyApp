import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MembershipDto } from '../models/member';
import { MembershipStatus, MembershipContextService } from '../services/membership-context';
import { StorefrontContextService } from '../services/storefront-context';
import { activeStorefrontGuard } from './active-storefront-guard';

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

describe('activeStorefrontGuard', () => {
  const memberships = signal<MembershipDto[]>([]);
  const status = signal<MembershipStatus>('loaded');
  let ensureLoaded: jasmine.Spy;
  let parseUrl: jasmine.Spy;

  function run(): Promise<unknown> {
    return TestBed.runInInjectionContext(() => activeStorefrontGuard({} as never, {} as never)) as Promise<unknown>;
  }

  beforeEach(() => {
    memberships.set([]);
    status.set('loaded');
    localStorage.removeItem('academy.active-storefront-id');
    ensureLoaded = jasmine.createSpy('ensureLoaded').and.resolveTo();
    parseUrl = jasmine.createSpy('parseUrl').and.callFake((url: string) => ({ url }));

    TestBed.configureTestingModule({
      providers: [
        StorefrontContextService,
        {
          provide: MembershipContextService,
          useValue: { ensureLoaded, memberships: memberships.asReadonly(), status: status.asReadonly() }
        },
        { provide: Router, useValue: { parseUrl } }
      ]
    });
  });

  it('awaits the membership fetch before resolving', async () => {
    memberships.set([membership('a')]);
    await run();
    expect(ensureLoaded).toHaveBeenCalledTimes(1);
  });

  it('redirects to /find-club for zero memberships', async () => {
    memberships.set([]);
    const result = await run();
    expect(parseUrl).toHaveBeenCalledWith('/find-club');
    expect(result).toEqual({ url: '/find-club' });
  });

  it('proceeds and auto-selects for exactly one membership', async () => {
    memberships.set([membership('solo')]);
    const result = await run();
    expect(result).toBeTrue();
    expect(TestBed.inject(StorefrontContextService).selectedStorefrontId()).toBe('solo');
  });

  it('redirects to /clubs for >1 membership with no remembered choice', async () => {
    memberships.set([membership('a'), membership('b')]);
    await run();
    expect(parseUrl).toHaveBeenCalledWith('/clubs');
  });

  it('fails open (proceeds) when the fetch errored', async () => {
    status.set('error');
    memberships.set([]);
    const result = await run();
    expect(result).toBeTrue();
    expect(parseUrl).not.toHaveBeenCalled();
  });
});
