import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { AcademyChildrenPage } from './academy-children.page';
import { AcademyApiService, AthleteDto } from '@konraddevoak/academy-api';
import { MembersApiService } from '../../core/services/members-api.service';
import { StorefrontContextService } from '../../core/services/storefront-context.service';
import { MemberNotificationsApiService } from '../../core/services/member-notifications-api.service';
import { MembershipDto } from '../../core/models/member.model';

// See clubs.page.spec.ts's identical comment — every root-tab page now renders
// <app-notification-bell>, stubbed here the same way to keep this page's own tests isolated.
const notificationsApiStub = {
  browse: () => of({ page: { items: [], currentPage: 1, resultsPerPage: 20, totalPages: 1, totalResults: 0 }, unreadCount: 0 }),
  markRead: () => of(undefined),
  markAllRead: () => of(undefined)
};

describe('AcademyChildrenPage', () => {
  let fixture: ComponentFixture<AcademyChildrenPage>;
  let component: AcademyChildrenPage;
  let academyApi: jasmine.SpyObj<AcademyApiService>;
  let membersApi: jasmine.SpyObj<MembersApiService>;
  let storefrontContext: jasmine.SpyObj<StorefrontContextService>;

  const membership: MembershipDto = {
    storefrontId: 'sf-1',
    storefrontName: 'KS Master Gang',
    joinedAt: new Date().toISOString(),
    businessType: 'SportsSchool'
  };

  function createAthlete(overrides: Partial<AthleteDto> = {}): AthleteDto {
    return {
      id: 'ath-1',
      guardianId: 'g-1',
      firstName: 'Jaś',
      lastName: 'Kowalski',
      dateOfBirth: '2016-05-01',
      disciplines: ['Acrobatics'],
      trainingFrequency: 'OncePerWeek',
      // Required by AthleteDto in the currently-pinned pre-major-bump @konraddevoak/academy-api;
      // the app itself no longer reads or sets this field. Drop once the package is bumped.
      preferredLocality: '',
      currentGroupId: null,
      currentGroupName: null,
      monthlyFeeGrosze: null,
      status: 'Active',
      createdAt: new Date().toISOString(),
      ...overrides
    };
  }

  async function setup() {
    academyApi = jasmine.createSpyObj('AcademyApiService', ['getMyAthletes']);
    academyApi.getMyAthletes.and.returnValue(of([]));

    membersApi = jasmine.createSpyObj('MembersApiService', ['getMyMemberships']);
    membersApi.getMyMemberships.and.returnValue(of([membership]));

    storefrontContext = jasmine.createSpyObj('StorefrontContextService', ['resolve']);
    storefrontContext.resolve.and.resolveTo('sf-1');

    await TestBed.configureTestingModule({
      imports: [AcademyChildrenPage],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: AcademyApiService, useValue: academyApi },
        { provide: MembersApiService, useValue: membersApi },
        { provide: StorefrontContextService, useValue: storefrontContext },
        { provide: MemberNotificationsApiService, useValue: notificationsApiStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AcademyChildrenPage);
    component = fixture.componentInstance;
  }

  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders one row per child with the group name', async () => {
    await setup();
    academyApi.getMyAthletes.and.returnValue(
      of([createAthlete({ currentGroupId: 'grp-1', currentGroupName: 'Drobin I' })])
    );

    await render();

    const rows = fixture.nativeElement.querySelectorAll('ion-list ion-item');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Jaś Kowalski');
    expect(rows[0].textContent).toContain('Drobin I');
  });

  it('shows the empty state when the guardian has no children', async () => {
    await setup();
    academyApi.getMyAthletes.and.returnValue(of([]));

    await render();

    expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('ion-list')).toBeFalsy();
  });

  it('shows the no-clubs state and skips the athletes call when the member has no memberships', async () => {
    await setup();
    membersApi.getMyMemberships.and.returnValue(of([]));
    storefrontContext.resolve.and.resolveTo(null);

    await render();

    expect(component.hasNoClubs).toBeTrue();
    expect(academyApi.getMyAthletes).not.toHaveBeenCalled();
  });

  it('falls back to an empty list when the athletes call fails', async () => {
    await setup();
    academyApi.getMyAthletes.and.returnValue(throwError(() => new Error('boom')));

    await render();

    expect(component.athletes).toEqual([]);
    expect(component.isLoading).toBeFalse();
  });
});
