import { WalkEntry, walk } from 'https://deno.land/std@0.78.0/fs/walk.ts';
import { BUILD_PATH, PAGES_PATH } from './config.ts';

export async function getPagesIndex() {
  const templates: Record<string, string> = {};
  const models: Record<string, string> = {};
  const contents: Record<string, string> = {};
  const scripts: Record<string, string> = {};
  const styles: Record<string, string> = {};
  const revalidates: Record<string, boolean> = {};
  const routes: string[] = [];

  for await (const entry of walk(PAGES_PATH, {
    includeFiles: true,
    includeDirs: true,
    skip: [/\/assets$/],
  })) {
    const key = getKey(entry);

    if (entry.isFile && entry.name === 'template.ejs') {
      revalidates[key] = revalidates[key] || (await hasChanged(entry));
      templates[key] = entry.path;
      continue;
    }

    if (entry.isFile && entry.name === 'script.js') {
      revalidates[key] = revalidates[key] || (await hasChanged(entry));
      scripts[key] = entry.path;
      continue;
    }

    if (entry.isFile && entry.name === 'style.css') {
      revalidates[key] = revalidates[key] || (await hasChanged(entry));
      styles[key] = entry.path;
      continue;
    }

    if (entry.isFile && entry.name === 'model.ts') {
      revalidates[key] = revalidates[key] || (await hasChanged(entry));
      models[key] = entry.path;
      continue;
    }

    if (entry.isFile && entry.name === 'content.md') {
      revalidates[key] = revalidates[key] || (await hasChanged(entry));
      contents[key] = entry.path;
      continue;
    }

    if (entry.isDirectory && key !== '') {
      if (key !== '/') routes.push(key);
      continue;
    }

    continue;
  }

  return (
    routes
      // exclude if missing model or content
      .filter((route) => !!(models[route] || contents[route]))
      .map((route) => {
        // get model
        const model = models[route];

        // get content
        const content = contents[route];

        // get revalidation
        const _revalidate = revalidates[route];

        // get templates
        const _templates: string[] = [];
        const _scripts: string[] = [];
        const _styles: string[] = [];

        const _routes: string[] = [];

        route.split('/').forEach((r) => {
          _routes.push(r);
          const key = (_routes.join('/') + '/').replace('//', '/');

          const t = templates[key];
          const s = scripts[key];
          const c = styles[key];

          if (t) _templates.push(t);
          if (s) _scripts.push(s);
          if (c) _styles.push(c);
        });

        return {
          route,
          model,
          content,
          templates: _templates,
          scripts: _scripts,
          styles: _styles,
          revalidate: _revalidate,
        };
      })
  );
}

// Get file key
function getKey(entry: WalkEntry) {
  return (
    entry.path
      .replace(new RegExp(`^${PAGES_PATH}`), '')
      .replace(entry.isFile ? `/${entry.name}` : '', '') + '/'
  );
}

// Check if file has changed
async function hasChanged(entry: WalkEntry) {
  try {
    const key = getKey(entry);

    const cachedAt = await Deno.stat(`${BUILD_PATH}${key}index.html`)
      .then((stat) => stat.mtime ?? new Date(0))
      .catch(() => new Date(0));

    const updatedAt = await Deno.stat(entry.path)
      .then((stat) => stat.mtime ?? new Date())
      .catch(() => new Date());

    return updatedAt.getTime() > cachedAt.getTime();
  } catch {
    return true;
  }
}
