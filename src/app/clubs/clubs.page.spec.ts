import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { ClubsPage } from './clubs.page';
import { MembersApiService } from '../core/services/members-api.service';
import { MembershipDto } from '../core/models/member.model';

describe('ClubsPage', () => {
  let fixture: ComponentFixture<ClubsPage>;
  let component: ClubsPage;
  let membersApi: jasmine.SpyObj<MembersApiService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    membersApi = jasmine.createSpyObj('MembersApiService', ['getMyMemberships', 'join', 'leave']);
    membersApi.getMyMemberships.and.returnValue(of([]));
    router = jasmine.createSpyObj('Router', ['navigateByUrl']);

    await TestBed.configureTestingModule({
      imports: [ClubsPage],
      providers: [
        { provide: MembersApiService, useValue: membersApi },
        { provide: Router, useValue: router }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ClubsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads an empty membership list and exposes a CTA to find-club', () => {
    expect(component.memberships).toEqual([]);
    expect(component.isLoading).toBeFalse();

    component.goToFindClub();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/find-club');
  });

  it('reloads memberships after the shared manual-join component reports a successful join', () => {
    const membership: MembershipDto = {
      storefrontId: 'club-1',
      storefrontName: 'Fit Club',
      joinedAt: new Date().toISOString()
    };
    membersApi.getMyMemberships.and.returnValue(of([membership]));

    component.loadMemberships();

    expect(component.memberships.length).toBe(1);
  });
});
