export interface CarnetDto {
  id: string;
  memberId: string;
  storefrontId: string;
  membershipTypeId: string;
  membershipTypeName: string;
  priceGroszeSnapshot: number;
  status: string;
  paymentMethod: string;
  manualPaymentMethod: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  autoRenewalEnabled: boolean;
  noticePeriodRequired: boolean;
  cancellationRequestedAt: string | null;
  cancellationEffectiveAt: string | null;
  reservationDeadlineAt: string | null;
  nextRetryAt: string | null;
  pendingPriceGrosze: number | null;
  pendingPriceProposedAt: string | null;
  pendingPriceAcceptedAt: string | null;
}

export interface CarnetCheckoutResultDto {
  carnetId: string;
  redirectUrl: string;
}

export interface SignUpForCarnetRequest {
  storefrontId: string;
  membershipTypeId: string;
  startingClassTypeId?: string;
  paymentMethod: string;
  discountCode?: string;
}

export interface MembershipTypeDto {
  id: string;
  storefrontId: string;
  name: string;
  description: string;
  priceGrosze: number;
  sessionsPerMonth: number;
  isActive: boolean;
  classTypeIds: string[];
}
