// Mirrors AcademyWeb's own core/models/member-notification.ts — both clients consume the exact same
// Notifications module endpoint (GET/POST api/notifications/member/inbox[...]), so the contract stays
// hand-synced rather than shared, the same tradeoff already made for known-service-ids (see root
// CLAUDE.md's "Backend conventions" — Angular can't import C#, and here it can't share types across two
// separate Angular apps either).
export interface MemberNotificationDto {
  id: string;
  subject: string;
  body: string;
  source: string;
  createdAt: string;
  readAt: string | null;
}

export interface PagedMemberNotifications {
  items: MemberNotificationDto[];
  currentPage: number;
  resultsPerPage: number;
  totalPages: number;
  totalResults: number;
}

export interface MemberNotificationInbox {
  page: PagedMemberNotifications;
  unreadCount: number;
}
