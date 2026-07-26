export const environment = {
  production: false,
  // Browser dev (no emulator): point at the nginx same-origin proxy (Sandbox/dev/nginx.conf,
  // 4214 -> ng serve on 4204 + /api/ -> backend on 5000) so the initial member-configuration
  // fetch avoids CORS entirely — open the app via http://localhost:4214, not :4204 directly.
  // Subsequent API calls already go relative (backend's memberConfig:apiConfig:uri is unset
  // locally), so only this bootstrap URL matters here.
  // Android emulator can't reach the host machine via `localhost` — swap to `http://10.0.2.2:5000`
  // (bypassing nginx) when testing on a real emulator/device.
  // Physical device over USB: run `adb reverse tcp:4214 tcp:4214` so the device's own
  // `localhost:4214` is forwarded over the USB/adb link to this port on the host — no Wi-Fi,
  // no LAN IP, no firewall involved. Re-run the adb reverse after every USB reconnect.
  apiUrl: 'http://localhost:4214',
  // apiUrl: 'http://10.0.2.2:5000'
  // apiUrl: 'http://192.168.0.177:4214'  // LAN IP variant, only if going over Wi-Fi instead

  // No real Firebase project/`google-services.json` provisioned yet (see CLAUDE.md "Push
  // notifications" — FCM credentials still unconfirmed). Without it, `PushNotifications.register()`
  // calls `FirebaseMessaging.getInstance()` natively, which throws `IllegalStateException` on a
  // background thread and crashes the whole app — a JS try/catch can't stop it, since the exception
  // never makes it back across the plugin bridge. Flip to `true` once `google-services.json` is real.
  pushNotificationsEnabled: false
};
