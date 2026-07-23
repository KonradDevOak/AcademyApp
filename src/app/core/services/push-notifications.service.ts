import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { ToastController } from '@ionic/angular/standalone';
import { NotificationsApiService } from './notifications-api.service';

// Native FCM (Android) / APNs (iOS) push — deliberately NOT the browser Web-Push/VAPID flow the
// backend also has, since a Capacitor WebView doesn't guarantee delivery-while-closed the way a real
// browser tab does. Best-effort throughout: registration/permission failures never block app usage.
@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private notificationsApi = inject(NotificationsApiService);
  private toastController = inject(ToastController);
  private router = inject(Router);
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized || !Capacitor.isNativePlatform()) return;
    this.initialized = true;

    const permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt') {
      await PushNotifications.requestPermissions();
    }

    const granted = await PushNotifications.checkPermissions();
    if (granted.receive !== 'granted') return;

    await PushNotifications.addListener('registration', (token: Token) => {
      const platform = Capacitor.getPlatform() === 'ios' ? 'iOS' : 'Android';
      this.notificationsApi.registerDeviceToken(platform, token.value).subscribe({
        error: (error: unknown) => console.error('Failed to register push device token:', error)
      });
    });

    await PushNotifications.addListener('registrationError', (error: unknown) => {
      console.error('Push registration failed:', error);
    });

    await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      const toast = await this.toastController.create({
        message: notification.title ? `${notification.title}: ${notification.body ?? ''}` : notification.body,
        duration: 4000,
        position: 'top'
      });
      await toast.present();
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const url = action.notification.data?.['url'];
      if (url) {
        this.router.navigateByUrl(url).catch((error: unknown) => console.error('Push navigation failed:', error));
      }
    });

    await PushNotifications.register();
  }
}
