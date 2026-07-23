export const environment = {
  production: false,
  // Browser dev (no emulator): point at the nginx same-origin proxy (Sandbox/dev/nginx.conf,
  // 4214 -> ng serve on 4204 + /api/ -> backend on 5000) so the initial member-configuration
  // fetch avoids CORS entirely — open the app via http://localhost:4214, not :4204 directly.
  // Subsequent API calls already go relative (backend's memberConfig:apiConfig:uri is unset
  // locally), so only this bootstrap URL matters here.
  // Android emulator can't reach the host machine via `localhost` — swap to `http://10.0.2.2:5000`
  // (bypassing nginx) when testing on a real emulator/device.
  apiUrl: 'http://localhost:4214'
  // apiUrl: 'http://10.0.2.2:5000'
};
