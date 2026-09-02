// DTOs for the sports-academy vertical (Sandbox's Modules.Academy, parent-facing `api/academy/me/*`
// surface). camelCase, backend enums as string, nullable as `T | null`, timestamps as string —
// same conventions as the other model files here. Shapes mirror Modules.Academy.Application/Academy/DTO.
// Unlike the other models (deliberately slim projections), the whole parent-facing set is modelled up
// front because the G2 child-detail screen consumes nearly every field.

export type Discipline = 'Acrobatics' | 'MartialArts';
export type TrainingFrequency = 'OncePerWeek' | 'TwicePerWeek';
// BankTransfer/Cash are the only values a parent sees today; Przelewy24/Blik are reserved for Phase H.
export type PaymentMethod = 'BankTransfer' | 'Cash' | 'Przelewy24' | 'Blik';

export interface AcademyGuardianDto {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: string;
}

export interface AthleteDto {
  id: string;
  guardianId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  disciplines: string[];
  trainingFrequency: string;
  preferredLocality: string;
  currentGroupId: string | null;
  // Denormalized by GET me/athletes for the list view — null when unassigned. Detail screens carry
  // the full `group` object instead (see AthleteDetailsDto).
  currentGroupName: string | null;
  monthlyFeeGrosze: number | null;
  status: string;
  createdAt: string;
}

export interface AthleteGroupDto {
  id: string;
  name: string;
  locality: string;
  disciplines: string[];
}

// TimeOnly serializes as "HH:mm:ss".
export interface ScheduleSlotDto {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  locationNote: string;
}

// GET me/athletes/{id}. `group`/`scheduleSlots` stay null/empty until the operator assigns a group
// (requirement II.3 — schedule visible only for the assigned group).
export interface AthleteDetailsDto extends AthleteDto {
  guardianName: string;
  guardianPhone: string;
  group: AthleteGroupDto | null;
  scheduleSlots: ScheduleSlotDto[];
}

export interface TrainingGroupDto {
  id: string;
  name: string;
  locality: string;
  disciplines: string[];
  scheduleSlots: ScheduleSlotDto[];
  status: string;
  createdAt: string;
}

// GET me/athletes/{id}/attendance, sorted desc by period. No `periodLabel` — the "wrzesień 2026" label
// is composed client-side from year/month.
export interface MonthlyAttendanceDto {
  period: string;
  year: number;
  month: number;
  maxSessions: number;
  attendedSessions: number;
}

export interface PaymentRecordDto {
  id: string;
  amountGrosze: number;
  method: string;
  paidOn: string;
  lateFee: boolean;
  lateFeeAmountGrosze: number | null;
  source: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

// Result of POST me/athletes/{id}/fee-charges/{period}/pay — redirectUrl is the P24 hosted-checkout
// URL the app opens. Mirrors CarnetCheckoutResultDto.
export interface AcademyFeeChargeCheckoutResultDto {
  feeChargeId: string;
  redirectUrl: string;
}

// One per period. `status` is computed server-side (sum of payments >= expected ? Paid : Due).
export interface FeeChargeDto {
  id: string;
  period: string;
  year: number;
  month: number;
  expectedAmountGrosze: number;
  paidAmountGrosze: number;
  status: 'Paid' | 'Due';
  dueDate: string | null;
  payments: PaymentRecordDto[];
}

// Recurring monthly billing status for the parent's auto-pay toggle. `null` (from the API, not this
// type) means the athlete has no plan yet — the app shows an "enable" button instead of a toggle.
export interface AcademyBillingPlanDto {
  status: 'PendingFirstPayment' | 'Active' | 'PaymentFailed';
  autoRenewalEnabled: boolean;
  amountGrosze: number;
  nextChargeOn: string;
  lastPaymentFailedAt: string | null;
}

export interface CurrentGradeDto {
  gradeLevelId: string;
  name: string;
  colorHex: string;
  awardedOn: string;
}

export interface GradeAwardDto {
  id: string;
  gradeLevelId: string;
  // null when the grade level was later deleted from the catalog.
  name: string | null;
  colorHex: string | null;
  awardedOn: string;
  examDate: string | null;
  examinerName: string | null;
  result: 'Passed' | 'Failed';
  note: string | null;
}

// One entry per discipline. `current` is the highest-`awardedOn` `Passed` award, null until the first.
export interface AthleteGradeDto {
  discipline: string;
  current: CurrentGradeDto | null;
  history: GradeAwardDto[];
}

export interface RegisterAthleteRequest {
  storefrontId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  disciplines: string[];
  trainingFrequency: string;
  preferredLocality: string;
}

export interface UpdateGuardianRequest {
  storefrontId: string;
  firstName: string;
  lastName: string;
  phone: string;
}

// The backend requires storefrontId in the body, not just the token.
export interface AcceptInvitationRequest {
  token: string;
  storefrontId: string;
}
