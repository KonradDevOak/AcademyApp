import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { MemberDto } from '../core/models/member';
import { MembersApiService } from '../core/services/members-api';
import { StorefrontContextService } from '../core/services/storefront-context';
import { ProfileComponent } from './profile';

function member(overrides: Partial<MemberDto> = {}): MemberDto {
  return {
    id: 'member-1',
    email: 'anna@example.pl',
    displayName: 'Anna Kowalska',
    firstName: 'Anna',
    lastName: 'Kowalska',
    phone: '500600700',
    profileCompletedAt: '2026-01-01',
    ...overrides
  };
}

describe('ProfileComponent', () => {
  let getMe: jasmine.Spy;
  let selectedStorefrontId: string | null;
  let fixture: ComponentFixture<ProfileComponent>;

  async function create(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: MembersApiService, useValue: { getMe } },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: () => selectedStorefrontId } }
      ]
    });
    fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    getMe = jasmine.createSpy('getMe').and.returnValue(of(null));
    selectedStorefrontId = 'sf-1';
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function detail(className: string): string {
    return ((fixture.nativeElement as HTMLElement).querySelector(`.${className}`)?.textContent ?? '').trim();
  }

  it('shows the member contact data as read-only text for the active club', async () => {
    getMe = jasmine.createSpy('getMe').and.returnValue(of(member()));
    await create();

    expect(getMe).toHaveBeenCalledWith('sf-1');
    expect(detail('profile__first-name')).toBe('Anna');
    expect(detail('profile__last-name')).toBe('Kowalska');
    expect(detail('profile__phone')).toBe('500600700');
    expect((fixture.nativeElement as HTMLElement).querySelector('form, input')).toBeNull();
    expect(text()).toContain('profile.managedByClub');
  });

  it('shows a placeholder for fields the club has not filled in', async () => {
    await create();

    expect(detail('profile__first-name')).toBe('profile.empty');
    expect(detail('profile__phone')).toBe('profile.empty');
  });

  it('asks for the member without a storefront when none is selected', async () => {
    selectedStorefrontId = null;
    await create();

    expect(getMe).toHaveBeenCalledWith(undefined);
  });

  it('does not render a payments section — payments live on /academy', async () => {
    await create();

    expect(text()).not.toContain('profile.duePayments');
    expect((fixture.nativeElement as HTMLElement).querySelector('.profile__due-list')).toBeNull();
  });

  it('shows a load error and reloads the profile on retry', async () => {
    getMe = jasmine.createSpy('getMe').and.returnValues(throwError(() => new Error('network')), of(member()));
    await create();

    expect(text()).toContain('profile.loadError');

    ((fixture.nativeElement as HTMLElement).querySelector('button.btn') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getMe).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain('profile.loadError');
  });
});
