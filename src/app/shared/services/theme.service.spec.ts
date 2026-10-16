import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.removeItem('academy.theme');
    document.documentElement.classList.remove('light', 'dark');
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.removeItem('academy.theme');
    document.documentElement.classList.remove('light', 'dark');
  });

  it('defaults to dark when nothing is stored', () => {
    service.init();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
  });

  it('prefers a stored value over the default', () => {
    localStorage.setItem('academy.theme', 'light');

    service.init();

    expect(service.theme()).toBe('light');
  });

  it('setTheme persists the choice and updates the class list', () => {
    service.setTheme('light');

    expect(localStorage.getItem('academy.theme')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBeTrue();
    expect(document.documentElement.classList.contains('dark')).toBeFalse();
  });

  it('toggle cycles dark -> light -> system -> dark', () => {
    service.setTheme('dark');

    service.toggle();
    expect(service.preference()).toBe('light');
    expect(service.theme()).toBe('light');

    service.toggle();
    expect(service.preference()).toBe('system');

    service.toggle();
    expect(service.preference()).toBe('dark');
    expect(service.theme()).toBe('dark');
  });

  it('system follows the OS appearance and is remembered as system', () => {
    service.setPreference('system');

    const osDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    expect(service.theme()).toBe(osDark ? 'dark' : 'light');
    expect(localStorage.getItem('academy.theme')).toBe('system');
  });

  it('restores a stored system preference', () => {
    localStorage.setItem('academy.theme', 'system');

    service.init();

    expect(service.preference()).toBe('system');
  });
});
