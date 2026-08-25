import { pickBackgroundImage } from './club-background.util';
import { StorefrontImageDto } from '../models/storefront.model';

describe('pickBackgroundImage', () => {
  const dark: StorefrontImageDto = { id: 'd1', url: 'https://example.com/dark.png', fileName: 'bg-dark.png' };
  const light: StorefrontImageDto = { id: 'l1', url: 'https://example.com/light.png', fileName: 'bg-light.png' };

  it('returns the dark image url when dark theme is active and a dark image exists', () => {
    expect(pickBackgroundImage(dark, light, true)).toBe(dark.url);
  });

  it('returns the light image url when light theme is active and a light image exists', () => {
    expect(pickBackgroundImage(dark, light, false)).toBe(light.url);
  });

  it('falls back to the light image when dark theme is active but no dark image exists', () => {
    expect(pickBackgroundImage(null, light, true)).toBe(light.url);
  });

  it('falls back to the dark image when light theme is active but no light image exists', () => {
    expect(pickBackgroundImage(dark, null, false)).toBe(dark.url);
  });

  it('returns null when neither image exists', () => {
    expect(pickBackgroundImage(null, null, true)).toBeNull();
    expect(pickBackgroundImage(null, null, false)).toBeNull();
  });
});
