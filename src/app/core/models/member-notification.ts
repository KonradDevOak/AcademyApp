// Contract of the Notifications module's member inbox (GET/POST api/notifications/member/inbox[...]),
// hand-synced with the backend DTOs.
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
