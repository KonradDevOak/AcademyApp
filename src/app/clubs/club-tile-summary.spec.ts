import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { AcademyApiService } from '@konraddevoak/academy-api';
import { CarnetsApiService, ClassesApiService } from '@konraddevoak/fitness-api';
import { MembershipDto } from '../core/models/member';
import { ClubTileSummaryComponent } from './club-tile-summary';

const GROUPS = ['academy'];
const CLASSES = ['classes_schedule', 'carnets_billing', 'club_members'];

function membership(services: string[]): MembershipDto {
  return {
    storefrontId: 'sf-1',
    joinedAt: '2026-01-01T00:00:00Z',
    storefrontName: 'Akademia',
    businessType: 'Academy',
    services,
    clubBackgroundDarkImage: null,
    clubBackgroundLightImage: null
  };
}

describe('ClubTileSummaryComponent', () => {
  let carnets: jasmine.SpyObj<CarnetsApiService>;
  let classes: jasmine.SpyObj<ClassesApiService>;
  let academy: jasmine.SpyObj<AcademyApiService>;

  beforeEach(() => {
    carnets = jasmine.createSpyObj<CarnetsApiService>(['getMyCarnet']);
    classes = jasmine.createSpyObj<ClassesApiService>(['getMyEnrollments', 'getSessions']);
    academy = jasmine.createSpyObj<AcademyApiService>(['getMyAthletes', 'getMyPayments', 'getAthlete']);
    classes.getMyEnrollments.and.returnValue(of([]));
    classes.getSessions.and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: CarnetsApiService, useValue: carnets },
        { provide: ClassesApiService, useValue: classes },
        { provide: AcademyApiService, useValue: academy }
      ]
    });
  });

  function unpaidPeriod() {
    return of({
      creditGrosze: 0, onlineFeePercent: 0, onlinePaymentEnabled: true,
      charges: [{ id: 'g', period: '2026-10', year: 2026, month: 10, expectedAmountGrosze: 10000,
        adjustedAmountGrosze: 0, effectiveAmountGrosze: 10000, paidAmountGrosze: 0, creditAppliedGrosze: 0,
        remainingGrosze: 10000, status: 'Due' as const, dueAt: null, siblingDiscountPercent: 0,
        onlineFeeGrosze: 0, onlineTotalGrosze: 10000, lines: [], payments: [] }]
    });
  }

  async function render(services: string[]): Promise<string[]> {
    const fixture = TestBed.createComponent(ClubTileSummaryComponent);
    fixture.componentRef.setInput('membership', membership(services));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('span')).map((s) => s.textContent!.trim());
  }

  it('flags a classes-only academy without a carnet and skips the groups calls', async () => {
    carnets.getMyCarnet.and.returnValue(of(null));
    expect(await render(CLASSES)).toEqual(['clubs.summary.noCarnet']);
    expect(academy.getMyAthletes).not.toHaveBeenCalled();
  });

  it('flags an unpaid period of a groups-only academy and skips the carnet calls', async () => {
    academy.getMyAthletes.and.returnValue(of([]));
    academy.getMyPayments.and.returnValue(unpaidPeriod());
    expect(await render(GROUPS)).toEqual(['clubs.summary.noChildren', 'clubs.summary.due']);
    expect(carnets.getMyCarnet).not.toHaveBeenCalled();
  });

  it('summarises both sections, groups first, for an academy offering both', async () => {
    academy.getMyAthletes.and.returnValue(of([]));
    academy.getMyPayments.and.returnValue(unpaidPeriod());
    carnets.getMyCarnet.and.returnValue(of(null));
    expect(await render([...CLASSES, ...GROUPS])).toEqual([
      'clubs.summary.noChildren',
      'clubs.summary.due',
      'clubs.summary.noCarnet'
    ]);
  });

  it('keeps the other section when one section fails to load', async () => {
    academy.getMyAthletes.and.returnValue(throwError(() => new Error('boom')));
    academy.getMyPayments.and.returnValue(of({ creditGrosze: 0, onlineFeePercent: 0, onlinePaymentEnabled: false, charges: [] }));
    carnets.getMyCarnet.and.returnValue(of(null));
    expect(await render([...GROUPS, ...CLASSES])).toEqual(['clubs.summary.noCarnet']);
  });

  it('renders nothing (and does not throw) when the summary cannot load', async () => {
    carnets.getMyCarnet.and.returnValue(throwError(() => new Error('boom')));
    expect(await render(CLASSES)).toEqual([]);
  });

  it('renders nothing for an academy without any section', async () => {
    expect(await render([])).toEqual([]);
  });
});
