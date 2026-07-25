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
