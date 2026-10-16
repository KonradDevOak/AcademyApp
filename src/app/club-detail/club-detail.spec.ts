import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { MembershipDto } from '../core/models/member';
import { ClubPublicProfileDto } from '../core/models/storefront';
import { ClubDiscoveryService } from '../core/services/club-discovery';
import { MembersApiService } from '../core/services/members-api';
import { MembershipContextService } from '../core/services/membership-context';
import { StorefrontContextService } from '../core/services/storefront-context';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog';
import { ThemeService } from '../shared/services/theme.service';
import { ClubDetailComponent } from './club-detail';

const GROUPS = ['academy'];
const CLASSES = ['classes_schedule', 'carnets_billing', 'club_members'];

function profile(services: string[], domains: string[] = []): ClubPublicProfileDto {
  return {
    id: 'sf-1', name: 'Akademia', bio: null, address: 'Kraków', phone: null, email: null, legalName: null, nip: null,
    businessType: 'Academy', services, domains, acceptsOnlinePayment: false, p24Available: false, payNowAvailable: false,
    onlinePaymentGateway: null, galleryImages: [], carouselImages: [], clubBackgroundDarkImage: null, clubBackgroundLightImage: null
  };
}

describe('ClubDetailComponent', () => {
  let fixture: ComponentFixture<ClubDetailComponent>;
  let membersApi: jasmine.SpyObj<MembersApiService>;
  let select: jasmine.Spy;
  let reload: jasmine.Spy;
  let discovery: jasmine.SpyObj<ClubDiscoveryService>;
  const memberships = signal<MembershipDto[]>([]);

  async function create(services: string[], domains: string[] = []): Promise<void> {
    discovery = jasmine.createSpyObj<ClubDiscoveryService>(['getProfile', 'getAcademyDisciplines']);
    discovery.getProfile.and.returnValue(of(profile(services, domains)));
    discovery.getAcademyDisciplines.and.returnValue(of([{ id: 'd', name: 'Akrobatyka' }]));
    select = jasmine.createSpy('select');
    reload = jasmine.createSpy('reload').and.callFake(() => {
      memberships.set([{ storefrontId: 'sf-1', businessType: 'Academy', services } as MembershipDto]);
      return Promise.resolve();
    });

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ storefrontId: 'sf-1' }) } } },
        { provide: ClubDiscoveryService, useValue: discovery },
        { provide: MembersApiService, useValue: membersApi },
        {
          provide: MembershipContextService,
          useValue: { memberships: memberships.asReadonly(), ensureLoaded: () => Promise.resolve(), reload }
        },
        { provide: StorefrontContextService, useValue: { select, selectedStorefrontId: () => null, clear: () => {} } },
        { provide: ThemeService, useValue: { theme: () => 'dark' } }
      ]
    });
    fixture = TestBed.createComponent(ClubDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    memberships.set([]);
    membersApi = jasmine.createSpyObj<MembersApiService>([
      'getMe', 'completeProfile', 'getPendingConsents', 'acceptConsent', 'join', 'leave'
    ]);
    membersApi.getMe.and.returnValue(of({ profileCompletedAt: '2026-01-01T00:00:00Z' } as never));
    membersApi.getPendingConsents.and.returnValue(of([]));
    membersApi.join.and.returnValue(of(undefined));
  });

  it('shows disciplines and joins a groups academy straight into adding a child', async () => {
    await create(GROUPS);
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Akrobatyka');

    await (fixture.componentInstance as unknown as { startJoin(): Promise<void> }).startJoin();

    expect(membersApi.join).toHaveBeenCalledWith('sf-1');
    expect(reload).toHaveBeenCalled();
    expect(select).toHaveBeenCalledWith('sf-1');
    expect(navigate).toHaveBeenCalledWith('/academy/add');
  });

  it('asks for the profile first when it is not completed', async () => {
    membersApi.getMe.and.returnValue(of(null));
    await create(CLASSES);

    await (fixture.componentInstance as unknown as { startJoin(): Promise<void> }).startJoin();

    expect((fixture.componentInstance as unknown as { joinStep(): string }).joinStep()).toBe('needs-profile');
    expect(membersApi.join).not.toHaveBeenCalled();
  });

  it('requires accepting pending consents before joining', async () => {
    membersApi.getPendingConsents.and.returnValue(of([
      { documentType: 'StudioTerms', documentVersionId: 'v1', versionLabel: 'Regulamin', contentUrl: 'https://x' }
    ]));
    membersApi.acceptConsent.and.returnValue(of(undefined));
    await create(CLASSES);
    const component = fixture.componentInstance as unknown as {
      startJoin(): Promise<void>;
      joinStep(): string;
      toggleConsent(type: string, checked: boolean): void;
      submitConsents(): Promise<void>;
    };
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    await component.startJoin();
    expect(component.joinStep()).toBe('needs-consents');

    component.toggleConsent('StudioTerms', true);
    await component.submitConsents();

    expect(membersApi.acceptConsent).toHaveBeenCalledWith('sf-1', 'StudioTerms', 'v1');
    expect(membersApi.join).toHaveBeenCalledWith('sf-1');
  });

  function badges(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.club-detail__sections .badge')).map(
      (b) => b.textContent!.trim()
    );
  }

  it('joins a classes-only academy into classes & passes without loading disciplines', async () => {
    await create(CLASSES);
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    expect(badges()).toEqual(['clubs.verticalFitness']);
    expect(discovery.getAcademyDisciplines).not.toHaveBeenCalled();

    await (fixture.componentInstance as unknown as { startJoin(): Promise<void> }).startJoin();

    expect(navigate).toHaveBeenCalledWith('/classes');
  });

  it('shows both section badges and joins an academy offering both into adding a child', async () => {
    await create([...CLASSES, ...GROUPS]);
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    expect(badges()).toEqual(['clubs.verticalAcademy', 'clubs.verticalFitness']);
    expect(discovery.getAcademyDisciplines).toHaveBeenCalledWith('sf-1');

    await (fixture.componentInstance as unknown as { startJoin(): Promise<void> }).startJoin();

    expect(navigate).toHaveBeenCalledWith('/academy/add');
  });

  it('hides the health questionnaire from a member of a groups-only academy', async () => {
    memberships.set([{ storefrontId: 'sf-1', businessType: 'Academy', services: GROUPS } as MembershipDto]);
    await create(GROUPS);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('clubDetail.healthQuestionnaire');
    expect(text).toContain('clubDetail.leave');
  });

  it('offers the health questionnaire to a member of an academy offering both sections', async () => {
    memberships.set([{ storefrontId: 'sf-1', businessType: 'Academy', services: [...GROUPS, ...CLASSES] } as MembershipDto]);
    await create([...GROUPS, ...CLASSES]);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('clubDetail.healthQuestionnaire');
  });

  it('offers the health questionnaire and leaving to a classes member', async () => {
    memberships.set([{ storefrontId: 'sf-1', businessType: 'Academy', services: CLASSES } as MembershipDto]);
    await create(CLASSES);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('clubDetail.healthQuestionnaire');
    expect(text).toContain('clubDetail.leave');
    expect(text).not.toContain('clubDetail.join');
  });

  describe('leave dialog', () => {
    function leaveMessage(): string {
      return fixture.debugElement.query(By.directive(ConfirmDialogComponent))
        .componentInstance.message();
    }

    const cases: [string, string[], string][] = [
      ['groups only', GROUPS, 'clubDetail.leaveDialog.messageGroups'],
      ['classes only', CLASSES, 'clubDetail.leaveDialog.messageClasses'],
      ['both sections', [...GROUPS, ...CLASSES], 'clubDetail.leaveDialog.messageBoth'],
      ['no section', [], 'clubDetail.leaveDialog.message']
    ];

    for (const [label, services, key] of cases) {
      it(`describes what leaving ends for an academy with ${label}`, async () => {
        memberships.set([{ storefrontId: 'sf-1', businessType: 'Academy', services } as MembershipDto]);
        await create(services);

        expect(leaveMessage()).toBe(key);
      });
    }
  });

  it('links to the academy website when it has a domain', async () => {
    await create(GROUPS, ['klub.pl']);

    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a[target="_blank"].btn');
    expect(link?.getAttribute('href')).toBe('https://klub.pl');
    expect(link?.textContent).toContain('clubDetail.website');
  });

  it('hides the website link when the academy has no domain', async () => {
    await create(GROUPS);

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('clubDetail.website');
  });
});
