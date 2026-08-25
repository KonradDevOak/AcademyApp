import { StorefrontImageDto } from '../models/storefront.model';

// Shared by club tiles (clubs.page) and the app-wide active-club background layer. Prefers the
// variant matching the current theme; falls back to the other variant if only that one was uploaded,
// so a club with just one file still gets a background instead of none.
export function pickBackgroundImage(
  dark: StorefrontImageDto | null,
  light: StorefrontImageDto | null,
  isDarkTheme: boolean
): string | null {
  const preferred = isDarkTheme ? dark : light;
  const fallback = isDarkTheme ? light : dark;
  return (preferred ?? fallback)?.url ?? null;
}
