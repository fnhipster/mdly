import { exists, ensureDir } from 'https://deno.land/std@0.78.0/fs/mod.ts';
import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
  MagickGeometry,
} from 'https://deno.land/x/imagemagick_deno@0.0.14/mod.ts';
import { BUILD_PATH, PAGES_PATH } from './config.ts';

// Initialize ImageMagick
await initializeImageMagick();

export function getResizedImageURL(
  path: string,
  options: {
    width?: number;
    height?: number;
  }
) {
  const { width, height } = options;

  // skip if width is not defined
  if (!width) return path;

  const filename = path.split('/').pop() as string;
  const ext = filename.split('.').pop() as string;

  return path.replace(ext, `${width}${height ? 'x' + height : ''}.webp`);
}

export async function processImage(
  filepath: string,
  options: {
    width: number;
    height?: number;
    mode?: 'resize' | 'crop';
    quality?: number;
  }
) {
  const { width = 0, height = 0, mode = 'crop', quality = 80 } = options;

  const origin = `${PAGES_PATH}${filepath}`;

  const destination = `${BUILD_PATH}${getResizedImageURL(filepath, {
    width,
    height,
  })}`;

  // skip if the destination already exists
  if (await exists(destination)) return;

  // skip if origin doesn't exist
  if (!(await exists(origin))) return;

  const filename = filepath.match(/\/([^\/]+)$/)?.[1];

  if (!filename) throw new Error('Filename not found');

  // ensure dist directory
  await ensureDir(destination.replace(/\/([^\/]+)$/, ''));

  // get the original image
  const image = await Deno.readFile(origin);

  // optimized image
  const sizingData = new MagickGeometry(width, height);

  sizingData.ignoreAspectRatio = height > 0 && width > 0;
  sizingData.fillArea = mode === 'crop';

  ImageMagick.read(image, (mod) => {
    mod.quality = quality;
    mod.format = MagickFormat.Webp;

    if (mode === 'resize') {
      mod.resize(sizingData);
    } else {
      // Resize the image
      sizingData.ignoreAspectRatio = false;
      mod.resize(sizingData);
      // Adjust geometry offset to center of image
      sizingData.y = mod.height / 2 - height / 2;
      sizingData.x = mod.width / 2 - width / 2;

      // Crop the image
      mod.crop(sizingData);
    }

    // write the processed images
    mod.write((resized) => Deno.writeFile(destination, resized));
  });
}
