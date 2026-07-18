export interface MemberDto {
  id: string;
  email: string;
  displayName: string | null;
  profileCompletedAt: string | null;
}

export interface MembershipDto {
  storefrontId: string;
  joinedAt: string;
}
