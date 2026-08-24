export interface MemberDto {
  id: string;
  email: string;
  displayName: string | null;
  profileCompletedAt: string | null;
}

export interface MembershipDto {
  storefrontId: string;
  joinedAt: string;
  storefrontName: string | null;
  businessType?: string | null;
}

export interface PendingConsentDto {
  documentType: string;
  documentVersionId: string;
  versionLabel: string;
  contentUrl: string;
}

export interface HealthQuestionnaireSubmissionDto {
  id: string;
  memberId: string;
  storefrontId: string;
  answersJson: string;
  submittedAt: string;
  submittedByMemberId: string | null;
  submittedByStaffEntraId: string | null;
  consentRecordId: string | null;
}
