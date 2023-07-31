import { ensureDir } from 'https://deno.land/std@0.78.0/fs/mod.ts';
import { getPagesIndex } from './index.ts';
import { getPageHTML } from './page.ts';
import { BUILD_PATH } from './config.ts';

// Create build directory
await ensureDir(BUILD_PATH);

// Get all the pages
console.log('Building pages...');

const index = await getPagesIndex();

index.forEach(async (page) => {
  const revalidate = page.lastUpdatedAt > page.lastCachedAt;

  if (revalidate) {
    await ensureDir(`${BUILD_PATH}/${page.route}`);

    const html = await getPageHTML(page);

    if (html) {
      await Deno.writeTextFile(`${BUILD_PATH}/${page.route}index.html`, html, {
        create: true,
      });
    }
  }

  console.log(revalidate ? '🟢' : '⚪️', `${page.route}`);
});
