// Slim, public-safe projection returned by GET /api/storefronts/public — see backend
// StorefrontMapPointDto. Only the fields the "find a club" discovery flow actually needs.
export interface StorefrontDiscoveryResultDto {
  id: string;
  name: string;
  address: string | null;
  businessType: string;
  services: string[];
  isOpenNow: boolean;
  rating: number | null;
  ratingCount: number;
  // Only populated when the request included lat/lng — null when falling back to alphabetical
  // sorting (no GPS available/permission denied).
  distanceKm: number | null;
}

// A single owner-uploaded image, as resolved by the backend to a signed URL — same shape backend-side
// as GalleryImageDto (Sandbox's StorefrontPublicProfileDto).
export interface StorefrontImageDto {
  id: string;
  url: string;
  fileName: string;
}

// Minimal projection of Sandbox's StorefrontPublicProfileDto — see GET /api/storefronts/{id}/public
// (StorefrontProfileService.getPublicProfile). Only the fields actually used today; the backend DTO has
// many more (gallery/carousel images, delivery, payment availability, etc.) that this app doesn't need
// yet — extend this interface as/when a consumer needs another field, don't mirror it speculatively.
export interface StorefrontPublicProfileDto {
  id: string;
  name: string;
  // Vertical discriminator (backend StorefrontBusinessType, e.g. "Fitness" / "SportsSchool") — used
  // by ActiveVerticalService as a fallback when a membership row carries no businessType.
  businessType: string;
  // Owner-curated per-club background, split by filename prefix (bg-dark/bg-light) — null until the
  // owner uploads a matching file in File Manager. No consuming screen renders these yet.
  clubBackgroundDarkImage: StorefrontImageDto | null;
  clubBackgroundLightImage: StorefrontImageDto | null;
}
