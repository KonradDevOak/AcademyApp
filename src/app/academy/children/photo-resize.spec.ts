import { MAX_PHOTO_EDGE, computeTargetSize, resizeToJpeg } from './photo-resize';

describe('photo resize', () => {
  describe('computeTargetSize', () => {
    it('scales a landscape image so its width becomes the max edge', () => {
      expect(computeTargetSize(2048, 1024, 512)).toEqual({ width: 512, height: 256 });
    });

    it('scales a portrait image so its height becomes the max edge', () => {
      expect(computeTargetSize(1000, 2000, 512)).toEqual({ width: 256, height: 512 });
    });

    it('never upscales an image that is already small enough', () => {
      expect(computeTargetSize(300, 200, 512)).toEqual({ width: 300, height: 200 });
    });

    it('keeps an image exactly at the limit untouched', () => {
      expect(computeTargetSize(512, 512, 512)).toEqual({ width: 512, height: 512 });
    });

    it('never collapses an extreme aspect ratio to a zero-pixel side', () => {
      const size = computeTargetSize(10000, 1, 512);
      expect(size.width).toBe(512);
      expect(size.height).toBeGreaterThanOrEqual(1);
    });
  });

  describe('resizeToJpeg', () => {
    async function pngOf(width: number, height: number): Promise<Blob> {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#c33';
      context.fillRect(0, 0, width, height);
      return new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
    }

    it('re-encodes a large image as a JPEG no bigger than the max edge', async () => {
      const result = await resizeToJpeg(await pngOf(1600, 800));

      expect(result.type).toBe('image/jpeg');
      const bitmap = await createImageBitmap(result);
      expect(bitmap.width).toBe(MAX_PHOTO_EDGE);
      expect(bitmap.height).toBe(MAX_PHOTO_EDGE / 2);
      bitmap.close();
    });

    it('keeps the dimensions of a small image', async () => {
      const bitmap = await createImageBitmap(await resizeToJpeg(await pngOf(120, 80)));

      expect(bitmap.width).toBe(120);
      expect(bitmap.height).toBe(80);
      bitmap.close();
    });

    it('rejects something that is not an image', async () => {
      await expectAsync(resizeToJpeg(new Blob(['not an image'], { type: 'image/png' }))).toBeRejected();
    });
  });
});
