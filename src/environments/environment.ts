export const environment = {
  production: false,
  // Android emulator can't reach the host machine via `localhost` — use `http://10.0.2.2:5000`
  // there instead (iOS simulator and `ionic serve` web preview can keep `localhost`).
  apiUrl: 'http://10.0.2.2:5000'
};
