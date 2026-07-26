# FitnessClub

Natywna appka klubowicza (Android/iOS) platformy LocalBiz — logowanie/rejestracja przez Entra External
ID (CIAM), lista klubów, i (w kolejnych zadaniach) grafik zajęć, karnety, zgody, ankieta zdrowotna,
powiadomienia push. Wyekstrahowana z `Sandbox/src/Clients/Mobile` 2026-07-18.

Backend: `Sandbox` repo (`src/Bootstrapper` + `src/Modules/Members`/`Classes`/`Carnets`/`Notifications`).
Panel właściciela klubu: LocalBizWeb (`Sandbox/src/Clients/LocalBizWeb`, `/club`). Publiczna wizytówka
klubu (bez logowania klubowicza): Showcase (`Workspace/Showcase`, osobne repo).

Zobacz `CLAUDE.md` po pełen kontekst architektoniczny.

## Komendy

```bash
npm install
npm start              # ionic serve — web preview, nie testuje pluginów natywnych
npm run build
npx cap sync android
npx cap sync ios
npx cap open android    # Android Studio
npx cap open ios        # Xcode
npm test
npm run lint
```

## Backend lokalnie

`src/environments/environment.ts` wskazuje na `http://localhost:5000` (Android emulator: podmień na
`http://10.0.2.2:5000`). Backend uruchamiany osobno w repo `Sandbox` (`dotnet run --project
src/Bootstrapper/Bootstrapper`).

## Uruchomienie na fizycznym urządzeniu Android (USB)

Zweryfikowany sposób testowania na realnym telefonie — przez kabel USB (`adb reverse`), bez potrzeby
wspólnej sieci Wi-Fi (router z client isolation by to zablokował, USB nie).

1. **Włącz USB debugging** na telefonie (Ustawienia → Opcje deweloperskie) i podłącz go kablem USB.
   Sprawdź, czy system go widzi:
   ```bash
   adb devices        # powinno pokazać urządzenie ze statusem "device"
   ```
2. **Odpal backend** w repo `Sandbox` (`dotnet run --project src/Bootstrapper/Bootstrapper`) razem z
   dev nginx proxy z `Sandbox/dev/nginx.conf` (nasłuchuje na porcie `4214`).
3. **Przekieruj port** z telefonu na hosta:
   ```bash
   adb reverse tcp:4214 tcp:4214
   ```
   To trzeba powtórzyć po każdym nowym podłączeniu kabla (odłączenie/reset ADB kasuje przekierowanie).
4. **`src/environments/environment.ts`** — `apiUrl` musi być `http://localhost:4214` (nie LAN IP, nie
   `10.0.2.2` — te adresy są tylko dla Wi-Fi/emulatora).
5. **`android/app/src/main/res/xml/network_security_config.xml`** — upewnij się, że jest wyjątek
   `cleartextTrafficPermitted="true"` dla domeny `localhost` (nie tylko dla `10.0.2.2` jak przy
   emulatorze) — inaczej Android zablokuje cały ruch `http://` z WebView mimo poprawnego `adb reverse`.
6. **Zbuduj appkę w konfiguracji development** — zwykłe `npm run build` domyślnie robi build
   `production` (`fileReplacements` na `environment.prod.ts`, czyli `https://api.localbiz.pl`),
   niezależnie od tego, co wpiszesz do `environment.ts`:
   ```bash
   npm run build -- --configuration development
   ```
   Pominięcie tego kroku objawia się białym ekranem po starcie appki (bootstrap próbuje uderzyć w
   `https://api.localbiz.pl`, co na urządzeniu deweloperskim kończy się błędem sieciowym widocznym
   tylko przez zdalny debugging WebView — `chrome://inspect` w Chrome na komputerze, podłączonym przez
   to samo USB).
7. **Zsynchronizuj i uruchom appkę** — `npx cap sync`/`npx cap run` same w sobie **nie** robią
   `ng build`, więc krok 6 musi być wykonany wcześniej:
   ```bash
   npx cap sync android
   npx cap run android
   # albo: npx cap open android   →  Run z poziomu Android Studio
   ```

Po tych krokach appka powinna wystartować na telefonie, zalogować przez CIAM (system browser →
powrót przez deep link `pl.localbiz.fitnessclub://auth-callback`) i normalnie rozmawiać z lokalnym
backendem. Jeśli appka nie startuje lub wisi na białym ekranie, podłącz zdalny debugger
(`chrome://inspect` → wybierz WebView appki) i sprawdź konsolę — patrz też `CLAUDE.md` po pełen opis
znanych błędów (`AADSTS9002326`, `IDX40001`) i ich przyczyn.
