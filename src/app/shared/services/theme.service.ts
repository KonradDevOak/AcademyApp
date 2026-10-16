import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

const STORAGE_KEY = 'academy.theme';
const PREFERENCE_CYCLE: readonly ThemePreference[] = ['dark', 'light', 'system'];

// Status bar background per theme — the --bg token of each theme (theme/_tokens.scss).
const STATUS_BAR_COLOR: Record<ThemeMode, string> = { dark: '#0e0e11', light: '#f7f7fa' };

// Same InjectionToken-wrapping pattern as CAPACITOR_APP — specs swap the plugin through this token.
export const STATUS_BAR_PLUGIN = new InjectionToken<typeof StatusBar>('STATUS_BAR_PLUGIN', {
  providedIn: 'root',
  factory: () => StatusBar
});

// Mirrors AcademyWeb's ThemeService — the 'light'/'dark' class on <html> flips the "Neon night" tokens
// (theme/_tokens.scss) and the Ionic variables mapped onto them (theme/variables.scss); the brand default
// is dark. One native extra on top: a 'system' preference that follows the OS appearance (reliable inside
// the app's WebView, unlike some desktop browsers). The status bar follows the applied theme.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly statusBar = inject(STATUS_BAR_PLUGIN);
  private readonly systemQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

  // The applied theme — what the screens render.
  public readonly theme = signal<ThemeMode>('dark');
  // What the member picked.
  public readonly preference = signal<ThemePreference>('dark');

  constructor() {
    this.systemQuery?.addEventListener?.('change', () => {
      if (this.preference() === 'system') {
        this.apply(this.resolve('system'));
      }
    });
  }

  public init(): void {
    const stored = readStored();
    const preference: ThemePreference =
      stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark';

    this.preference.set(preference);
    this.apply(this.resolve(preference));
  }

  public setPreference(preference: ThemePreference): void {
    writeStored(preference);
    this.preference.set(preference);
    this.apply(this.resolve(preference));
  }

  public setTheme(theme: ThemeMode): void {
    this.setPreference(theme);
  }

  // dark -> light -> system -> dark.
  public toggle(): void {
    const next = (PREFERENCE_CYCLE.indexOf(this.preference()) + 1) % PREFERENCE_CYCLE.length;
    this.setPreference(PREFERENCE_CYCLE[next]);
  }

  private resolve(preference: ThemePreference): ThemeMode {
    if (preference !== 'system') {
      return preference;
    }
    return this.systemQuery && !this.systemQuery.matches ? 'light' : 'dark';
  }

  private apply(theme: ThemeMode): void {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    this.theme.set(theme);
    void this.syncStatusBar(theme);
  }

  private async syncStatusBar(theme: ThemeMode): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    try {
      // Style.Dark = light icons for a dark background.
      await this.statusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light });
      if (Capacitor.getPlatform() === 'android') {
        await this.statusBar.setBackgroundColor({ color: STATUS_BAR_COLOR[theme] });
      }
    } catch {
      // Cosmetic only — never block the theme switch on the status bar.
    }
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // The choice still applies for this session.
  }
}
