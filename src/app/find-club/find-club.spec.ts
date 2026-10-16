import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ClubDiscoveryService } from '../core/services/club-discovery';
import { MembershipContextService } from '../core/services/membership-context';
import { FindClubComponent } from './find-club';

describe('FindClubComponent', () => {
  let discovery: jasmine.SpyObj<ClubDiscoveryService>;

  beforeEach(() => {
    discovery = jasmine.createSpyObj<ClubDiscoveryService>(['search']);
    discovery.search.and.returnValue(of([
      { id: 'sf-1', slug: 'a', name: 'Akademia A', address: 'Kraków', businessType: 'Academy',
        services: ['academy', 'classes_schedule', 'carnets_billing', 'club_members'],
        isOpenNow: true, rating: null, ratingCount: 0, distanceKm: null },
      { id: 'sf-2', slug: 'b', name: 'Akademia B', address: 'Kraków', businessType: 'Academy',
        services: ['classes_schedule', 'carnets_billing', 'club_members'],
        isOpenNow: true, rating: null, ratingCount: 0, distanceKm: null }
    ]));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ClubDiscoveryService, useValue: discovery },
        {
          provide: MembershipContextService,
          useValue: { memberships: () => [{ storefrontId: 'sf-1' }], ensureLoaded: () => Promise.resolve() }
        }
      ]
    });
  });

  it('searches on open, shows each academy\'s sections and marks academies the member belongs to', fakeAsync(() => {
    const fixture = TestBed.createComponent(FindClubComponent);
    fixture.detectChanges();
    tick(400);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(discovery.search).toHaveBeenCalledWith(jasmine.objectContaining({ search: '' }));
    expect(root.querySelector('.pill-tabs')).toBeNull();
    const items = root.querySelectorAll('.find-club__item');
    const tags = (item: Element) =>
      Array.from(item.querySelectorAll('.badge--muted')).map((b) => b.textContent!.trim());
    expect(tags(items[0])).toEqual(['clubs.verticalAcademy', 'clubs.verticalFitness']);
    expect(tags(items[1])).toEqual(['clubs.verticalFitness']);
    expect(items[0].textContent).toContain('findClub.member');
    expect(items[1].textContent).not.toContain('findClub.member');
  }));

  it('debounces typing and re-searches', fakeAsync(() => {
    const fixture = TestBed.createComponent(FindClubComponent);
    fixture.detectChanges();
    tick(400);
    const component = fixture.componentInstance as unknown as { onSearch(v: string): void };

    component.onSearch('Kra');
    component.onSearch('Krak');
    tick(400);

    expect(discovery.search).toHaveBeenCalledTimes(2);
    expect(discovery.search.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ search: 'Krak' })
    );
  }));
});
