# Clubhouse

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
