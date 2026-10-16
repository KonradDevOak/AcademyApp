import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { MembershipDto } from '../../core/models/member';
import { MembershipContextService } from '../../core/services/membership-context';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { ClubSwitcherComponent } from './club-switcher';

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

describe('ClubSwitcherComponent', () => {
  let fixture: ComponentFixture<ClubSwitcherComponent>;
  let select: jasmine.Spy;

  beforeEach(() => {
    select = jasmine.createSpy('select');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslateService(),
        {
          provide: MembershipContextService,
          useValue: {
            memberships: () => [
              membership('a', ['academy']),
              membership('f', ['classes_schedule', 'carnets_billing', 'club_members'])
            ]
          }
        },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: () => 'a', select } }
      ]
    });
    fixture = TestBed.createComponent(ClubSwitcherComponent);
    fixture.detectChanges();
  });

  it('lists every academy in one list and switches to the picked one', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    const navigated = jasmine.createSpy('navigated');
    fixture.componentInstance.navigated.subscribe(navigated);

    const items = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button.club-switcher__item');
    expect(items.length).toBe(2);
    expect(items[0].classList).toContain('is-active');
    expect((fixture.nativeElement as HTMLElement).querySelector('.club-switcher__group')).toBeNull();

    items[1].click();

    expect(select).toHaveBeenCalledWith('f');
    expect(navigate).toHaveBeenCalledWith('/classes');
    expect(navigated).toHaveBeenCalled();
  });
});
