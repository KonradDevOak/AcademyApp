import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { Tab1Page } from './tab1.page';
import { MemberNotificationsApiService } from '../core/services/member-notifications-api.service';

// See clubs.page.spec.ts's identical comment — every root-tab page now renders
// <app-notification-bell>, stubbed here the same way to keep this page's own test isolated.
const notificationsApiStub = {
  browse: () => of({ page: { items: [], currentPage: 1, resultsPerPage: 20, totalPages: 1, totalResults: 0 }, unreadCount: 0 }),
  markRead: () => of(undefined),
  markAllRead: () => of(undefined)
};

describe('Tab1Page', () => {
  let component: Tab1Page;
  let fixture: ComponentFixture<Tab1Page>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tab1Page],
      providers: [
        provideTranslateService(),
        { provide: MemberNotificationsApiService, useValue: notificationsApiStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Tab1Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
