import { serve } from 'https://deno.land/std@0.193.0/http/server.ts';
import { serveDir } from 'https://deno.land/std@0.193.0/http/file_server.ts';
import { getPagesIndex } from './index.ts';
import { BUILD_PATH, PAGES_PATH, PORT } from './config.ts';
import { exists } from 'https://deno.land/std@0.78.0/fs/exists.ts';
import { getPageHTML } from './page.ts';
import { ensureDir } from 'https://deno.land/std@0.78.0/fs/mod.ts';
import {
  basename,
  fromFileUrl,
  dirname,
} from 'https://deno.land/std@0.194.0/path/mod.ts';

// Create build directory
await ensureDir(BUILD_PATH);

// Initial Index
let index = await getPagesIndex();

// Watch for changes in pages (dev mode only)
if (Deno.env.get('DEVELOPMENT')) {
  setTimeout(async () => {
    let timeout: number | undefined;

    function debounce(fn: () => void, delay: number) {
      clearTimeout(timeout);
      timeout = setTimeout(fn, delay);
    }

    const watcher = Deno.watchFs(PAGES_PATH, { recursive: true });

    for await (const _event of watcher) {
      debounce(async () => {
        // Re-index Pages
        index = await getPagesIndex();
        console.log('🔄 Pages re-indexed');
      }, 500);
    }
  }, 0);
}

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  const pathname = url.pathname === '/' ? '/index/' : url.pathname;

  try {
    // Return assets from ./static directory
    if (/(.*\/\.mdly\/.*)/.test(pathname)) {
      const staticPath = `${fromFileUrl(dirname(import.meta.url))}/static`;

      // override request url
      request = new Request(request.url.replace('/.mdly', ''), request);

      return await serveDir(request, {
        fsRoot: staticPath,
      });
    }

    // Return static assets
    if (/(.*\/assets\/.*)/.test(pathname)) {
      // check if file is in build directory
      if (await exists(BUILD_PATH + pathname)) {
        return await serveDir(request, {
          fsRoot: BUILD_PATH,
        });
      }

      // fallback to source files
      return await serveDir(request, { fsRoot: PAGES_PATH });
    }

    // Redirect to trailing slash
    if (
      !/\.[a-zA-Z0-9]{1,4}$/.test(url.pathname) &&
      !url.pathname.endsWith('/')
    ) {
      url.pathname += '/';

      // redirect to trailing slash
      return new Response(null, {
        status: 301,
        headers: {
          location: url.toString(),
        },
      });
    }

    const page = index.find((existing) => pathname === existing.route);

    // Not found
    if (!page) throw new Deno.errors.NotFound();

    const revalidate = page.lastUpdatedAt > page.lastCachedAt;

    // Rebuild page if revalidate is true on on development
    if (Deno.env.get('DEVELOPMENT') && revalidate) {
      const html = await getPageHTML(page);

      if (html) {
        console.log(`🔄 Rebuilding ${page.route}...`);

        await ensureDir(`${BUILD_PATH}/${page.route}`);

        await Deno.writeTextFile(`${BUILD_PATH}${page.route}index.html`, html, {
          create: true,
        }).catch(console.error);

        // Update Pages Index
        index = await getPagesIndex();
      }
    }

    // Index
    const _request =
      page.route === '/index/'
        ? new Request(request.url + 'index/index.html', request)
        : request;

    return await serveDir(_request, { fsRoot: BUILD_PATH });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      serverLog(request, 404);

      return new Response('404', {
        status: 404,
      });
    }

    serverLog(request, 500);

    return new Response(error.message, {
      status: 500,
    });
  }
}

await serve(handler, { port: PORT });

function serverLog(req: Request, status: number) {
  const d = new Date().toISOString();
  const dateFmt = `[${d.slice(0, 10)} ${d.slice(11, 19)}]`;
  const url = new URL(req.url);
  const s = `${dateFmt} [${req.method}] ${url.pathname}${url.search} ${status}`;
  // using console.debug instead of console.log so chrome inspect users can hide request logs
  console.debug(s);
}
