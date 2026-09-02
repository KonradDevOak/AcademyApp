import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';

import { TabsPage } from './tabs.page';
import { PushNotificationsService } from '../core/services/push-notifications.service';
import { MembershipsCacheService } from '../core/services/memberships-cache.service';
import { ActiveVerticalService, Vertical } from '../core/services/active-vertical.service';

describe('TabsPage', () => {
  let component: TabsPage;
  let fixture: ComponentFixture<TabsPage>;
  let vertical$: BehaviorSubject<Vertical>;

  beforeEach(async () => {
    vertical$ = new BehaviorSubject<Vertical>('fitness');

    await TestBed.configureTestingModule({
      imports: [TabsPage],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: PushNotificationsService, useValue: { init: () => Promise.resolve() } },
        { provide: MembershipsCacheService, useValue: { getOrRefresh: () => Promise.resolve([]) } },
        { provide: ActiveVerticalService, useValue: { activeVertical$: vertical$.asObservable(), snapshot: () => vertical$.value } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TabsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function tabNames(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('ion-tab-button')).map(
      (b) => (b as HTMLElement).getAttribute('tab') ?? ''
    );
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the fitness tab set by default', () => {
    expect(tabNames()).toEqual(['clubs', 'schedule', 'carnet', 'profile']);
  });

  it('renders the academy tab set when the active vertical is academy', () => {
    vertical$.next('academy');
    fixture.detectChanges();

    expect(tabNames()).toEqual(['clubs', 'academy-children', 'profile']);
  });
});
