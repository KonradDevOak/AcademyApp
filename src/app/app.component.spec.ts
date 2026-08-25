import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('should create the app', async () => {
    // app-club-background (rendered in app.component.html) pulls in StorefrontContextService ->
    // MembershipsCacheService -> MembersApiService -> HttpClient, even before detectChanges() runs.
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient()]
    }).compileComponents();
    
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
