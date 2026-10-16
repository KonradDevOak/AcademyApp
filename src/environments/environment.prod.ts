export const environment = {
  production: true,
  // The backend's only public origin — the same base URL AcademyWeb uses in production. The app's
  // WebView origin (http://localhost on Android, capacitor://localhost on iOS) must be on the
  // backend's CORS allow-list for every call.
  apiBaseUrl: 'https://localbiz.pl',
  webAppBaseUrl: 'https://academy.localbiz.pl',
  // See environment.ts — same "no google-services.json yet" reasoning applies to prod.
  pushNotificationsEnabled: false
};
