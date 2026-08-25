import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService.isDarkFor', () => {
  let service: ThemeService;

  beforeEach(() => {
    service = TestBed.inject(ThemeService);
  });

  it('returns true for an explicit dark preference', () => {
    expect(service.isDarkFor('dark')).toBeTrue();
  });

  it('returns false for an explicit light preference', () => {
    expect(service.isDarkFor('light')).toBeFalse();
  });
});
