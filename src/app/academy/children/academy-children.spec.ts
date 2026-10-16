import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AcademyApiService, AthleteDto } from '@konraddevoak/academy-api';
import { provideTranslateService } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { AcademyChildrenComponent } from './academy-children';

function athlete(overrides: Partial<AthleteDto>): AthleteDto {
  return {
    id: 'ath-1',
    guardianMemberId: 'member-1',
    firstName: 'Jaś',
    lastName: 'Kowalski',
    dateOfBirth: '2016-05-01',
    sessionsPerWeek: 0,
    groups: [],
    monthlyFeeGrosze: null,
    status: 'Active',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

describe('AcademyChildrenComponent', () => {
  const selectedId = signal<string | null>('sf-1');
  let getMyAthletes: jasmine.Spy;
  let navigateByUrl: jasmine.Spy;

  async function render(): Promise<ComponentFixture<AcademyChildrenComponent>> {
    const fixture = TestBed.createComponent(AcademyChildrenComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<AcademyChildrenComponent>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(() => {
    selectedId.set('sf-1');
    getMyAthletes = jasmine.createSpy('getMyAthletes').and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: AcademyApiService, useValue: { getMyAthletes } },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: selectedId.asReadonly() } },
        provideRouter([])
      ]
    });

    navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  it('loads athletes for the active storefront and renders one row each', async () => {
    getMyAthletes.and.returnValue(
      of([
        athlete({ id: 'a', firstName: 'Ala', groups: [{ id: 'g1', name: 'Grupa I', disciplineName: 'Akrobatyka' }] }),
        athlete({ id: 'b', firstName: 'Bartek', groups: [] })
      ])
    );

    const fixture = await render();

    expect(getMyAthletes).toHaveBeenCalledWith('sf-1');
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.academy-children__item');
    expect(rows.length).toBe(2);
    expect(text(fixture)).toContain('Ala Kowalski');
    expect(text(fixture)).toContain('Grupa I');
  });

  it('links each row to the athlete detail route', async () => {
    getMyAthletes.and.returnValue(of([athlete({ id: 'abc' })]));
    const fixture = await render();
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      '.academy-children__link'
    ) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/academy/children/abc');
  });

  it('shows the no-group i18n key when the athlete has no group', async () => {
    getMyAthletes.and.returnValue(of([athlete({ groups: [] })]));
    const fixture = await render();
    expect(text(fixture)).toContain('academy.children.noGroup');
  });

  it("renders the athlete's group discipline name verbatim", async () => {
    getMyAthletes.and.returnValue(
      of([athlete({ groups: [{ id: 'g1', name: 'Grupa I', disciplineName: 'Akrobatyka sportowa' }] })])
    );
    const fixture = await render();
    expect(text(fixture)).toContain('Akrobatyka sportowa');
  });

  it('shows an empty state and no list when the parent has no children', async () => {
    getMyAthletes.and.returnValue(of([]));
    const fixture = await render();
    expect(text(fixture)).toContain('academy.children.empty');
    expect((fixture.nativeElement as HTMLElement).querySelector('.academy-children__list')).toBeNull();
  });

  it('shows an error state when the fetch fails', async () => {
    getMyAthletes.and.returnValue(throwError(() => new Error('network')));
    const fixture = await render();
    expect(fixture.componentInstance['status']()).toBe('error');
    expect(text(fixture)).toContain('academy.children.loadError');
  });

  it('re-fetches on refresh()', async () => {
    getMyAthletes.and.returnValue(of([athlete({})]));
    const fixture = await render();
    getMyAthletes.calls.reset();

    fixture.componentInstance['refresh']();
    await fixture.whenStable();

    expect(getMyAthletes).toHaveBeenCalledWith('sf-1');
  });

  it('navigates to the add-child route from goToAdd()', async () => {
    const fixture = await render();
    await fixture.componentInstance['goToAdd']();
    expect(navigateByUrl).toHaveBeenCalledWith('/academy/add');
  });

  describe('photo', () => {
    function monogram(fixture: ComponentFixture<AcademyChildrenComponent>): HTMLElement {
      return (fixture.nativeElement as HTMLElement).querySelector('.monogram') as HTMLElement;
    }

    it('shows the photo when the athlete has one', async () => {
      getMyAthletes.and.returnValue(of([{ ...athlete({}), photoUrl: 'https://files/p.jpg' }]));
      const fixture = await render();

      expect(monogram(fixture).querySelector('img')?.getAttribute('src')).toBe('https://files/p.jpg');
    });

    it('keeps the initials when there is no photo', async () => {
      getMyAthletes.and.returnValue(of([athlete({})]));
      const fixture = await render();

      expect(monogram(fixture).querySelector('img')).toBeNull();
      expect(monogram(fixture).textContent?.trim()).toBe('JK');
    });

    it('falls back to the initials when the photo fails to load', async () => {
      getMyAthletes.and.returnValue(of([{ ...athlete({}), photoUrl: 'https://files/expired.jpg' }]));
      const fixture = await render();

      monogram(fixture).querySelector('img')!.dispatchEvent(new Event('error'));
      fixture.detectChanges();

      expect(monogram(fixture).querySelector('img')).toBeNull();
      expect(monogram(fixture).textContent?.trim()).toBe('JK');
    });
  });
});
