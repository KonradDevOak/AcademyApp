export interface MemberSessionDto {
  id: string;
  classTypeId: string;
  classTypeName: string;
  roomId: string;
  roomName: string;
  trainerId: string;
  trainerName: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  seatsRemaining: number;
  canEnrollManually: boolean;
  manualEnrollmentOpensAt: string;
}

export interface MyEnrollmentDto {
  id: string;
  sessionId: string;
  status: string;
  source: string;
  enrolledAt: string;
}

export interface MakeupCreditDto {
  id: string;
  sourceSessionId: string;
  earnedAt: string;
  creditMonth: string;
  status: string;
  expiresAt: string;
}

export interface ClassTypeDto {
  id: string;
  name: string;
  description: string;
  defaultDurationMinutes: number;
  isActive: boolean;
}
