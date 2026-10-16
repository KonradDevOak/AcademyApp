import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AcademyApiService, GuardianChargeDto } from '@konraddevoak/academy-api';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { StorefrontContextService } from '../core/services/storefront-context';
import { AcademyHomeComponent } from './academy-home';
import { ClubDiscoveryService } from '../core/services/club-discovery';

// Thin container today (see the class-level comment on branching by role) — this confirms it renders
// both sections as a single-open accordion, reordered by CSS `order` (not DOM position — the payments
// component keeps its HTTP-backed state instead of being destroyed/recreated) and seeded open/closed,
// depending on whether the current period is already paid, so a future role-branch doesn't silently
// regress the default (parent) path.
describe('AcademyHomeComponent', () => {
  async function createFixture(
    charges: Partial<GuardianChargeDto>[],
    creditGrosze = 0
  ): Promise<ComponentFixture<AcademyHomeComponent>> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslateService(),
        {
          provide: AcademyApiService,
          useValue: {
            getMyAthletes: jasmine.createSpy().and.returnValue(of([])),
            getMyPayments: jasmine
              .createSpy()
              .and.returnValue(of({
                creditGrosze,
                onlineFeePercent: 0,
                onlinePaymentEnabled: true,
                charges: charges.map((c) => ({ lines: [], payments: [], ...c }))
              }))
          }
        },
        { provide: ClubDiscoveryService, useValue: { getProfile: () => of(null), getClubDocuments: () => of([]) } },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: () => 'sf-1' } }
      ]
    });
    const fixture = TestBed.createComponent(AcademyHomeComponent);
    fixture.detectChanges();
    // AcademyPaymentsComponent.load() is async (firstValueFrom) — let it settle before the second
    // detectChanges() that picks up currentPeriodPaid()/resolved() for the [class.academy-home--settled]
    // binding and the seeded accordion panel.
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  // The open panel is the accordion group's value — the ion-accordion whose value it holds.
  function isExpanded(host: HTMLElement, panelClass: string): boolean {
    const group = host.querySelector('ion-accordion-group') as HTMLElement & { value?: string };
    return host.querySelector(`.${panelClass}`)!.getAttribute('value') === group.value;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders both the payments and the roster component', async () => {
    const host = (await createFixture([])).nativeElement as HTMLElement;
    expect(host.querySelector('app-academy-payments')).not.toBeNull();
    expect(host.querySelector('app-academy-children')).not.toBeNull();
  });

  it('keeps payments on top when there is no charge yet (nothing to react to)', async () => {
    const host = (await createFixture([])).nativeElement as HTMLElement;
    expect(host.querySelector('.academy-home--settled')).toBeNull();
  });

  it('keeps payments on top when the current period is still due', async () => {
    const host = (await createFixture([{ status: 'Due' } as GuardianChargeDto])).nativeElement as HTMLElement;
    expect(host.querySelector('.academy-home--settled')).toBeNull();
  });

  it('pushes payments below the roster once the current period is paid', async () => {
    const host = (await createFixture([{ status: 'Paid' } as GuardianChargeDto])).nativeElement as HTMLElement;
    expect(host.querySelector('.academy-home--settled')).not.toBeNull();
  });

  it('opens the roster panel by default when the organizer has issued nothing yet', async () => {
    const host = (await createFixture([])).nativeElement as HTMLElement;
    expect(isExpanded(host, 'academy-home__panel--children')).toBe(true);
    expect(isExpanded(host, 'academy-home__panel--payments')).toBe(false);
  });

  it('opens the payments panel by default when there is credit but no charge issued yet', async () => {
    const host = (await createFixture([], 20000)).nativeElement as HTMLElement;
    expect(isExpanded(host, 'academy-home__panel--payments')).toBe(true);
    expect(isExpanded(host, 'academy-home__panel--children')).toBe(false);
  });

  it('opens the payments panel by default when the current period is still due', async () => {
    const host = (await createFixture([{ status: 'Due' } as GuardianChargeDto])).nativeElement as HTMLElement;
    expect(isExpanded(host, 'academy-home__panel--payments')).toBe(true);
    expect(isExpanded(host, 'academy-home__panel--children')).toBe(false);
  });

  it('opens the roster panel by default once the current period is paid', async () => {
    const host = (await createFixture([{ status: 'Paid' } as GuardianChargeDto])).nativeElement as HTMLElement;
    expect(isExpanded(host, 'academy-home__panel--children')).toBe(true);
    expect(isExpanded(host, 'academy-home__panel--payments')).toBe(false);
  });
});
