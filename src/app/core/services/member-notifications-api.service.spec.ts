import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExternalConfigService } from '@shared/iam-msal-external';
import { MemberNotificationsApiService } from './member-notifications-api.service';

describe('MemberNotificationsApiService', () => {
  let service: MemberNotificationsApiService;
  let httpMock: HttpTestingController;
  const base = 'https://api.test/api/notifications/member/inbox';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ExternalConfigService, useValue: { getConfig: () => ({ apiConfig: { uri: 'https://api.test' } }) } }
      ]
    });
    service = TestBed.inject(MemberNotificationsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('browses the inbox with page/pageSize', () => {
    service.browse(1, 20).subscribe();
    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush({ page: { items: [], currentPage: 1, resultsPerPage: 20, totalPages: 1, totalResults: 0 }, unreadCount: 0 });
  });

  it('marks one notification as read', () => {
    service.markRead('n1').subscribe();
    const req = httpMock.expectOne(`${base}/n1/read`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('marks all notifications as read', () => {
    service.markAllRead().subscribe();
    const req = httpMock.expectOne(`${base}/read-all`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
