import { ChangeDetectionStrategy, Component, NgZone, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  IonButton,
  IonIcon,
  IonBadge,
  IonPopover,
  IonList,
  IonItem,
  IonLabel,
  IonText
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { notificationsOutline } from 'ionicons/icons';
import { EMPTY, Observable, catchError, interval, startWith, switchMap } from 'rxjs';
import { MemberNotificationsApiService } from '../../core/services/member-notifications-api.service';
import { MemberNotificationInbox } from '../../core/models/member-notification';

const REFRESH_INTERVAL_MS = 60_000;

// Native equivalent of AcademyWeb's notification-bell (same backend endpoint, same 60s-polling
// rationale — see that component's own comment: no linked backend behind AcademyWeb's Azure SWA Free
// tier means no SignalR there either, and this app doesn't have one at all, so polling stays the one
// mechanism both clients share). Rendered per-page (in each root tab's ion-toolbar), not once in a
// shared app-shell header — Ionic's <ion-tabs> has no single shared header the way a web app-shell does.
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [IonButton, IonIcon, IonBadge, IonPopover, IonList, IonItem, IonLabel, IonText, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss'
})
export class NotificationBellComponent {
  private readonly api = inject(MemberNotificationsApiService);
  private readonly zone = inject(NgZone);

  protected readonly open = signal(false);

  constructor() {
    addIcons({ notificationsOutline });
  }

  // Same zone-escape pattern as AcademyWeb's — a live 60s timer inside NgZone never lets it report
  // stable; a failed poll (cold start, token refresh, offline) must not end the stream, since rxResource
  // moves to its 'error' state on any error and .value() then throws on every subsequent read, including
  // from the badge binding rendered on every page.
  private pollInbox(): Observable<MemberNotificationInbox> {
    return new Observable<MemberNotificationInbox>((subscriber) => {
      let innerSubscription: { unsubscribe(): void } | undefined;
      this.zone.runOutsideAngular(() => {
        innerSubscription = interval(REFRESH_INTERVAL_MS)
          .pipe(
            startWith(0),
            switchMap(() => this.api.browse(1, 20).pipe(catchError(() => EMPTY)))
          )
          .subscribe({
            next: (value) => this.zone.run(() => subscriber.next(value))
          });
      });
      return () => innerSubscription?.unsubscribe();
    });
  }

  protected readonly inbox = rxResource({
    stream: () => this.pollInbox()
  });

  protected readonly unreadCount = () => this.inbox.value()?.unreadCount ?? 0;
  protected readonly items = () => this.inbox.value()?.page.items ?? [];

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected dismiss(): void {
    this.open.set(false);
  }

  protected markRead(id: string): void {
    this.api.markRead(id).subscribe(() => this.inbox.reload());
  }

  protected markAllRead(): void {
    this.api.markAllRead().subscribe(() => this.inbox.reload());
  }
}
