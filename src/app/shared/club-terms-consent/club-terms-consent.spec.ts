import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { ClubDiscoveryService } from '../../core/services/club-discovery';
import { ClubTermsConsentComponent } from './club-terms-consent';

describe('ClubTermsConsentComponent', () => {
  async function render(discovery: object) {
    TestBed.configureTestingModule({
      imports: [ClubTermsConsentComponent],
      providers: [provideTranslateService(), { provide: ClubDiscoveryService, useValue: discovery }]
    });
    const fixture = TestBed.createComponent(ClubTermsConsentComponent);
    fixture.componentRef.setInput('storefrontId', 'sf-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const link = (el: HTMLElement) => el.querySelector('a') as HTMLAnchorElement;

  it("links to the club's own terms and names the seller by its legal name", async () => {
    const fixture = await render({
      getProfile: () => of({ name: 'Master Gang', legalName: 'KS Master Gang', nip: '123' }),
      getClubDocuments: () =>
        of([{ documentType: 'StudioTerms', versionLabel: 'v1', contentUrl: 'https://club.pl/regulamin', isDefault: false }])
    });
    const component = fixture.componentInstance as unknown as { sellerName(): string | null; nip(): string | null };

    expect(link(fixture.nativeElement).href).toBe('https://club.pl/regulamin');
    expect(component.sellerName()).toBe('KS Master Gang');
    expect(component.nip()).toBe('123');
  });

  it('falls back to the default terms page when the documents cannot be loaded', async () => {
    const fixture = await render({
      getProfile: () => throwError(() => new Error('down')),
      getClubDocuments: () => throwError(() => new Error('down'))
    });

    expect(link(fixture.nativeElement).getAttribute('href')).toBe('/klub/sf-1/regulamin');
  });

  it('reports the ticked checkbox through the accepted model', async () => {
    const fixture = await render({ getProfile: () => of(null), getClubDocuments: () => of([]) });

    (fixture.nativeElement.querySelector('input') as HTMLInputElement).click();

    expect(fixture.componentInstance.accepted()).toBeTrue();
  });
});
