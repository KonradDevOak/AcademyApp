import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AcademyApiService } from '@konraddevoak/academy-api';
import { CarnetsApiService, ClassesApiService } from '@konraddevoak/fitness-api';
import { MembershipDto } from '../core/models/member';
import { MembershipContextService } from '../core/services/membership-context';
import { StorefrontContextService } from '../core/services/storefront-context';
import { ThemeService } from '../shared/services/theme.service';
import { ClubsComponent } from './clubs';

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

describe('ClubsComponent', () => {
  let fixture: ComponentFixture<ClubsComponent>;
  const memberships = signal<MembershipDto[]>([]);
  let select: jasmine.Spy;

  function create(list: MembershipDto[]): void {
    memberships.set(list);
    select = jasmine.createSpy('select');
    const carnets = jasmine.createSpyObj<CarnetsApiService>(['getMyCarnet']);
    carnets.getMyCarnet.and.returnValue(of(null));
    const classes = jasmine.createSpyObj<ClassesApiService>(['getMyEnrollments', 'getSessions']);
    classes.getMyEnrollments.and.returnValue(of([]));
    classes.getSessions.and.returnValue(of([]));
    const academy = jasmine.createSpyObj<AcademyApiService>(['getMyAthletes', 'getMyPayments', 'getAthlete']);
    academy.getMyAthletes.and.returnValue(of([]));
    academy.getMyPayments.and.returnValue(of({ creditGrosze: 0, onlineFeePercent: 0, onlinePaymentEnabled: false, charges: [] }));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslateService(),
        {
          provide: MembershipContextService,
          useValue: { memberships: memberships.asReadonly(), status: () => 'loaded', ensureLoaded: () => Promise.resolve() }
        },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: () => 'f-1', select } },
        { provide: ThemeService, useValue: { theme: () => 'dark' } },
        { provide: CarnetsApiService, useValue: carnets },
        { provide: ClassesApiService, useValue: classes },
        { provide: AcademyApiService, useValue: academy }
      ]
    });
    fixture = TestBed.createComponent(ClubsComponent);
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('lists every academy in one grid and highlights the active one', () => {
    create([membership('a-1', GROUPS), membership('f-1', CLASSES), membership('f-2', [...GROUPS, ...CLASSES])]);

    expect(root().querySelectorAll('.clubs__grid').length).toBe(1);
    expect(root().querySelectorAll('.club-tile__main').length).toBe(3);
    expect(root().querySelector('.club-tile--active .club-tile__name')?.textContent).toContain('Akademia f-1');
  });

  it('selects an academy and opens its first section', () => {
    create([membership('f-1', CLASSES)]);
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    root().querySelector<HTMLButtonElement>('.club-tile__main')!.click();

    expect(select).toHaveBeenCalledWith('f-1');
    expect(navigate).toHaveBeenCalledWith('/classes');
  });

  it('opens groups first for an academy offering both sections', () => {
    create([membership('f-1', [...CLASSES, ...GROUPS])]);
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    root().querySelector<HTMLButtonElement>('.club-tile__main')!.click();

    expect(navigate).toHaveBeenCalledWith('/academy');
  });

  it('points a member of no academy to the finder', () => {
    create([]);
    expect(root().textContent).toContain('clubs.empty');
    expect(root().querySelector('a[href="/find-club"]')).not.toBeNull();
  });
});
