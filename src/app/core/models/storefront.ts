// Mirror of the Storefronts module's anonymous, public endpoints (GET api/storefronts/public and
// GET api/storefronts/{id}/public) as consumed by the club finder and club card. Plain data shapes only.

import { StorefrontImageDto } from './member';

// One club in the discovery list. distanceKm is set only when the request carried lat/lng.
export interface ClubDiscoveryResultDto {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  businessType: string;
  services: string[];
  isOpenNow: boolean;
  rating: number | null;
  ratingCount: number;
  distanceKm: number | null;
}

// Public-safe profile of one club (no owner-only fields). Suspended clubs come back with only id/name.
export interface ClubPublicProfileDto {
  id: string;
  suspended?: boolean;
  name: string;
  bio: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  // Registered seller identity (operator-managed, null until filled in) — the club's documents and the
  // payment screens name the club by it.
  legalName: string | null;
  nip: string | null;
  businessType: string;
  services: string[];
  // Domains linked to the club's public website (Showcase); empty when none is linked or the club is suspended.
  domains: string[];
  acceptsOnlinePayment: boolean;
  p24Available: boolean;
  payNowAvailable: boolean;
  onlinePaymentGateway: 'P24' | 'PayNow' | null;
  galleryImages: StorefrontImageDto[];
  carouselImages: StorefrontImageDto[];
  clubBackgroundDarkImage: StorefrontImageDto | null;
  clubBackgroundLightImage: StorefrontImageDto | null;
}

// Public academy discipline (GET api/academy/public/{storefrontId}/disciplines).
export interface PublicDisciplineDto {
  id: string;
  name: string;
}

// A club's current terms/privacy policy (GET api/consent-documents/public/{storefrontId}) — its own
// published document, or LocalBiz's default one rendered by this app at /klub/:storefrontId/*.
export interface ClubConsentDocumentDto {
  documentType: ClubDocumentType;
  versionLabel: string;
  contentUrl: string;
  isDefault: boolean;
}

export type ClubDocumentType = 'StudioTerms' | 'StudioRodo';
