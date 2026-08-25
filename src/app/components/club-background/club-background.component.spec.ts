import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { ClubBackgroundComponent } from './club-background.component';
import { StorefrontContextService, ActiveClubBackground } from '../../core/services/storefront-context.service';
import { ThemeService, ThemePreference } from '../../core/services/theme.service';
import { StorefrontImageDto } from '../../core/models/storefront.model';

describe('ClubBackgroundComponent', () => {
  let fixture: ComponentFixture<ClubBackgroundComponent>;
  let activeClubBackground: BehaviorSubject<ActiveClubBackground | null>;
  let preference: BehaviorSubject<ThemePreference>;

  const dark: StorefrontImageDto = { id: 'd1', url: 'https://example.com/dark.png', fileName: 'bg-dark.png' };
  const light: StorefrontImageDto = { id: 'l1', url: 'https://example.com/light.png', fileName: 'bg-light.png' };

  beforeEach(async () => {
    activeClubBackground = new BehaviorSubject<ActiveClubBackground | null>(null);
    preference = new BehaviorSubject<ThemePreference>('light');

    const storefrontContextStub = { activeClubBackground$: activeClubBackground.asObservable() };
    const themeServiceStub = {
      preference$: preference.asObservable(),
      isDarkFor: (p: ThemePreference) => p === 'dark'
    };

    await TestBed.configureTestingModule({
      imports: [ClubBackgroundComponent],
      providers: [
        { provide: StorefrontContextService, useValue: storefrontContextStub },
        { provide: ThemeService, useValue: themeServiceStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ClubBackgroundComponent);
    fixture.detectChanges();
  });

  function backgroundImageStyle(): string {
    const el: HTMLElement = fixture.nativeElement.querySelector('.club-background');
    return el.style.backgroundImage;
  }

  it('renders no background image when there is no active club', () => {
    expect(backgroundImageStyle()).toBe('');
  });

  it('renders the light variant when the theme is light', () => {
    activeClubBackground.next({ dark, light });
    fixture.detectChanges();

    expect(backgroundImageStyle()).toContain(light.url);
  });

  it('renders the dark variant when the theme is dark', () => {
    preference.next('dark');
    activeClubBackground.next({ dark, light });
    fixture.detectChanges();

    expect(backgroundImageStyle()).toContain(dark.url);
  });

  it('falls back to the other variant when only one image exists', () => {
    preference.next('dark');
    activeClubBackground.next({ dark: null, light });
    fixture.detectChanges();

    expect(backgroundImageStyle()).toContain(light.url);
  });

  it('clears the background when the active club changes to one with no images', () => {
    activeClubBackground.next({ dark, light });
    fixture.detectChanges();
    expect(backgroundImageStyle()).toContain(light.url);

    activeClubBackground.next(null);
    fixture.detectChanges();

    expect(backgroundImageStyle()).toBe('');
  });
});
