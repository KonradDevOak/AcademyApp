import { InjectionToken } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';

// Native location (system permission prompt) instead of navigator.geolocation. Wrapped in a token like the
// other Capacitor plugins — the plugin object is a Proxy that defeats jasmine.spyOn.
export const GEOLOCATION_PLUGIN = new InjectionToken<typeof Geolocation>('GEOLOCATION_PLUGIN', {
  providedIn: 'root',
  factory: () => Geolocation
});
