import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { AcademyChildrenPage } from './academy-children.page';
import { AcademyApiService } from '../../core/services/academy-api.service';
import { MembersApiService } from '../../core/services/members-api.service';
import { StorefrontContextService } from '../../core/services/storefront-context.service';
import { AthleteDto } from '../../core/models/academy.model';
import { MembershipDto } from '../../core/models/member.model';

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
      preferredLocality: 'Drobin',
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
        { provide: StorefrontContextService, useValue: storefrontContext }
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
