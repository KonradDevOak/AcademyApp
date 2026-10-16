import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { AcademyAthletePhotoApiService } from './academy-athlete-photo-api';
import { AcademyChildPhotoComponent } from './academy-child-photo';

describe('AcademyChildPhotoComponent', () => {
  let fixture: ComponentFixture<AcademyChildPhotoComponent>;
  let api: jasmine.SpyObj<AcademyAthletePhotoApiService>;
  let changed: jasmine.Spy;

  async function pngFile(width: number, height: number, type = 'image/png'): Promise<File> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.fillRect(0, 0, width, height);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
    return new File([blob], 'photo.png', { type });
  }

  function chooseEvent(file: File | null): Event {
    return { target: { files: file ? [file] : [], value: 'x' } } as unknown as Event;
  }

  function create(photoUrl: string | null = null): void {
    fixture = TestBed.createComponent(AcademyChildPhotoComponent);
    fixture.componentRef.setInput('athleteId', 'ath-1');
    fixture.componentRef.setInput('firstName', 'Jaś');
    fixture.componentRef.setInput('lastName', 'Kowalski');
    fixture.componentRef.setInput('photoUrl', photoUrl);
    changed = jasmine.createSpy('changed');
    fixture.componentInstance.changed.subscribe(changed);
    fixture.detectChanges();
  }

  const root = () => fixture.nativeElement as HTMLElement;
  const select = (file: File | null) =>
    (fixture.componentInstance as unknown as { onFileSelected(e: Event): Promise<void> }).onFileSelected(chooseEvent(file));

  beforeEach(async () => {
    api = jasmine.createSpyObj<AcademyAthletePhotoApiService>('AcademyAthletePhotoApiService', ['upload', 'remove']);
    api.upload.and.returnValue(of(undefined));
    api.remove.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [AcademyChildPhotoComponent],
      providers: [
        provideTranslateService({ lang: 'pl', fallbackLang: 'pl' }),
        { provide: AcademyAthletePhotoApiService, useValue: api },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: () => 'sf-1' } }
      ]
    }).compileComponents();
  });

  it('shows the initials when the child has no photo, and no remove button', () => {
    create(null);

    expect(root().querySelector('.child-photo__initials')?.textContent?.trim()).toBe('JK');
    expect(root().querySelector('img')).toBeNull();
    expect(root().querySelector('.btn--ghost')).toBeNull();
  });

  it('shows the photo and offers to remove it when there is one', () => {
    create('https://cdn.example/p.jpg?sig=1');

    expect(root().querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/p.jpg?sig=1');
    expect(root().querySelector('.btn--ghost')).not.toBeNull();
  });

  it('falls back to the initials when the photo link fails to load', () => {
    create('https://cdn.example/expired.jpg');

    root().querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(root().querySelector('img')).toBeNull();
    expect(root().querySelector('.child-photo__initials')).not.toBeNull();
  });

  it('scales the chosen image down to a JPEG and uploads it', async () => {
    create(null);

    await select(await pngFile(1600, 1200));

    expect(api.upload).toHaveBeenCalledTimes(1);
    const [storefrontId, athleteId, photo] = api.upload.calls.mostRecent().args;
    expect(storefrontId).toBe('sf-1');
    expect(athleteId).toBe('ath-1');
    expect(photo.type).toBe('image/jpeg');
    const bitmap = await createImageBitmap(photo);
    expect(Math.max(bitmap.width, bitmap.height)).toBe(512);
    bitmap.close();
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('refuses a file that is not JPEG, PNG or WebP without calling the API', async () => {
    create(null);

    await select(new File(['gif'], 'a.gif', { type: 'image/gif' }));
    fixture.detectChanges();

    expect(api.upload).not.toHaveBeenCalled();
    expect(root().querySelector('.banner--error')).not.toBeNull();
  });

  it('reports an unreadable image without calling the API', async () => {
    create(null);

    await select(new File(['not an image'], 'broken.png', { type: 'image/png' }));
    fixture.detectChanges();

    expect(api.upload).not.toHaveBeenCalled();
    expect(root().querySelector('.banner--error')).not.toBeNull();
  });

  it('does nothing when the file dialog is dismissed without a choice', async () => {
    create(null);

    await select(null);

    expect(api.upload).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });

  it('shows an error and does not signal a change when the upload fails', async () => {
    api.upload.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: [{ code: 'invalid_athlete_photo' }] } })));
    create(null);

    await select(await pngFile(200, 200));
    fixture.detectChanges();

    expect(changed).not.toHaveBeenCalled();
    expect(root().querySelector('.banner--error')).not.toBeNull();
  });

  it('removes the photo through the API and signals the change', async () => {
    create('https://cdn.example/p.jpg');

    await (fixture.componentInstance as unknown as { remove(): Promise<void> }).remove();

    expect(api.remove).toHaveBeenCalledWith('sf-1', 'ath-1');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('keeps the privacy note hidden until the info button is pressed', () => {
    create();
    const info = root().querySelector<HTMLButtonElement>('.child-photo__info')!;

    expect(root().querySelector('.child-photo__note')).toBeNull();
    expect(info.getAttribute('aria-expanded')).toBe('false');

    info.click();
    fixture.detectChanges();

    expect(root().querySelector('.child-photo__note')).not.toBeNull();
    expect(info.getAttribute('aria-expanded')).toBe('true');
  });
});
