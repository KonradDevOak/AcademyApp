import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme-preference';
const DARK_CLASS = 'ion-palette-dark';

// Ionic's dark.class.css palette is only active when `.ion-palette-dark` is present on an ancestor
// element — switching to it (from dark.system.css) is what lets a user's explicit choice override the
// OS-level prefers-color-scheme, while still defaulting to "system" when they haven't chosen.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly subject = new BehaviorSubject<ThemePreference>('system');
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private initialized = false;

  readonly preference$ = this.subject.asObservable();

  get preference(): ThemePreference {
    return this.subject.value;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const { value } = await Preferences.get({ key: STORAGE_KEY });
    const restored: ThemePreference = value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
    this.subject.next(restored);
    this.apply(restored);

    this.media.addEventListener('change', () => {
      if (this.subject.value === 'system') {
        this.apply('system');
      }
    });
  }

  async setPreference(preference: ThemePreference): Promise<void> {
    this.subject.next(preference);
    this.apply(preference);
    await Preferences.set({ key: STORAGE_KEY, value: preference });
  }

  private apply(preference: ThemePreference): void {
    const isDark = preference === 'system' ? this.media.matches : preference === 'dark';
    document.documentElement.classList.toggle(DARK_CLASS, isDark);
  }
}
