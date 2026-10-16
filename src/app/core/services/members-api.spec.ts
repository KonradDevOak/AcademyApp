import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { MembersApiService } from './members-api';

describe('MembersApiService', () => {
  let service: MembersApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/api/members`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(MembersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists my memberships', () => {
    service.getMyMemberships().subscribe();
    const req = httpMock.expectOne(`${base}/me/memberships`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets the current member', () => {
    service.getMe().subscribe();
    const req = httpMock.expectOne(`${base}/me`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'm-1', email: 'a@b.pl', displayName: null, profileCompletedAt: null });
  });

  it('passes the storefront so the backend can overlay the CRM card', () => {
    service.getMe('sf-1').subscribe();
    const req = httpMock.expectOne(`${base}/me?storefrontId=sf-1`);
    expect(req.request.method).toBe('GET');
    req.flush(null);
  });

  it('completes the profile with a displayName', () => {
    service.completeProfile('Anna Kowalska').subscribe();
    const req = httpMock.expectOne(`${base}/complete-profile`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ displayName: 'Anna Kowalska' });
    req.flush(null);
  });

  it('lists pending consents for a storefront', () => {
    service.getPendingConsents('sf-1').subscribe();
    const req = httpMock.expectOne(`${base}/sf-1/consents/pending`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('accepts a consent', () => {
    service.acceptConsent('sf-1', 'StudioTerms', 'v-1').subscribe();
    const req = httpMock.expectOne(`${base}/sf-1/consents/accept`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ documentType: 'StudioTerms', documentVersionId: 'v-1' });
    req.flush(null);
  });

  it('joins a storefront with no body', () => {
    service.join('sf-1').subscribe();
    const req = httpMock.expectOne(`${base}/sf-1/join`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(null);
  });
});
