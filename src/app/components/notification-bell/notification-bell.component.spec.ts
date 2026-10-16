import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { NotificationBellComponent } from './notification-bell.component';
import { MemberNotificationsApiService } from '../../core/services/member-notifications-api.service';
import { MemberNotificationInbox } from '../../core/models/member-notification';

describe('NotificationBellComponent', () => {
  let fixture: ComponentFixture<NotificationBellComponent>;
  let api: jasmine.SpyObj<MemberNotificationsApiService>;

  const inbox = (unreadCount: number): MemberNotificationInbox => ({
    page: {
      items: [{ id: 'n1', subject: 'Karnet odnowiony', body: 'Body', source: 'push', createdAt: '2026-01-01T10:00:00Z', readAt: null }],
      currentPage: 1,
      resultsPerPage: 20,
      totalPages: 1,
      totalResults: 1
    },
    unreadCount
  });

  async function setup(): Promise<void> {
    api = jasmine.createSpyObj<MemberNotificationsApiService>(['browse', 'markRead', 'markAllRead']);
    api.browse.and.returnValue(of(inbox(1)));
    api.markRead.and.returnValue(of(undefined));
    api.markAllRead.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [provideTranslateService(), { provide: MemberNotificationsApiService, useValue: api }]
    });
    fixture = TestBed.createComponent(NotificationBellComponent);
    // rxResource subscribes to its stream from an effect scheduled during change detection, not
    // synchronously on creation — whenStable() flushes that scheduling before the first value is
    // reflected (same pattern as AcademyWeb's own notification-bell spec, and this repo's other
    // rxResource-backed page specs).
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  it('shows the unread count badge', async () => {
    await setup();
    const badge = (fixture.nativeElement as HTMLElement).querySelector('ion-badge');
    expect(badge?.textContent?.trim()).toBe('1');
  });

  it('hides the badge when there are no unread notifications', async () => {
    api = jasmine.createSpyObj<MemberNotificationsApiService>(['browse', 'markRead', 'markAllRead']);
    api.browse.and.returnValue(of(inbox(0)));
    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [provideTranslateService(), { provide: MemberNotificationsApiService, useValue: api }]
    });
    fixture = TestBed.createComponent(NotificationBellComponent);
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }

    expect((fixture.nativeElement as HTMLElement).querySelector('ion-badge')).toBeNull();
  });

  it('opens the popover and exposes the fetched notifications', async () => {
    await setup();
    fixture.componentInstance['toggle']();
    fixture.detectChanges();

    // ion-popover portals its <ng-template> content into an overlay outside this fixture's own DOM
    // subtree (Ionic's overlay controller appends it to the nearest ion-app, or document.body absent
    // one) — asserting against fixture.nativeElement.textContent would only ever see the bell button
    // itself. Assert the state the template binds instead, which is what actually drives it.
    expect(fixture.componentInstance['open']()).toBeTrue();
    expect(fixture.componentInstance['items']()[0].subject).toBe('Karnet odnowiony');
  });

  it('marks a notification as read and reloads the inbox', async () => {
    await setup();

    fixture.componentInstance['markRead']('n1');
    // rxResource's reload() re-fetch is scheduled via an effect, same as the initial load in setup() —
    // needs the same detectChanges/whenStable pump to actually run.
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }

    expect(api.markRead).toHaveBeenCalledWith('n1');
    expect(api.browse).toHaveBeenCalledTimes(2); // initial poll + reload after markRead
  });

  it('marks all notifications as read and reloads the inbox', async () => {
    await setup();

    fixture.componentInstance['markAllRead']();
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }

    expect(api.markAllRead).toHaveBeenCalled();
    expect(api.browse).toHaveBeenCalledTimes(2);
  });

  it('polls again after the refresh interval', fakeAsync(() => {
    void setup();
    tick(60_000);
    expect(api.browse).toHaveBeenCalledTimes(2);
  }));

  it('recovers after a failed poll instead of getting stuck in an error state', fakeAsync(() => {
    // Exercises pollInbox()'s own RxJS pipeline directly, bypassing rxResource/change-detection entirely
    // — isolates the fix (catchError swallowing one failed tick so switchMap keeps waiting for the next
    // interval emission) from Angular's resource/effect scheduling, covered by the other specs above.
    api = jasmine.createSpyObj<MemberNotificationsApiService>(['browse', 'markRead', 'markAllRead']);
    api.browse.and.returnValues(throwError(() => new Error('network error')), of(inbox(1)));

    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [provideTranslateService(), { provide: MemberNotificationsApiService, useValue: api }]
    });
    fixture = TestBed.createComponent(NotificationBellComponent);

    const values: MemberNotificationInbox[] = [];
    let errored = false;
    const subscription = fixture.componentInstance['pollInbox']().subscribe({
      next: (v: MemberNotificationInbox) => values.push(v),
      error: () => {
        errored = true;
      }
    });

    tick(0); // flushes the immediate startWith(0) emission — the failing first poll
    expect(errored).toBeFalse();
    expect(values.length).toBe(0);

    tick(60_000); // the interval's own first real tick — the recovering second poll
    subscription.unsubscribe();

    expect(errored).toBeFalse();
    expect(values).toEqual([inbox(1)]);
    expect(api.browse).toHaveBeenCalledTimes(2);
  }));
});
