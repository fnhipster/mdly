import { WalkEntry, walk } from 'https://deno.land/std@0.78.0/fs/walk.ts';
import { BUILD_PATH, PAGES_PATH } from './config.ts';

export async function getPagesIndex() {
  const templates: Record<string, string> = {};
  const models: Record<string, string> = {};
  const contents: Record<string, string> = {};
  const scripts: Record<string, string[]> = {};
  const styles: Record<string, string[]> = {};
  const updatedAt: Record<string, number[]> = {};
  const cachedAt: Record<string, number[]> = {};
  const routes: string[] = [];

  for await (const entry of walk(PAGES_PATH, {
    includeFiles: true,
    includeDirs: true,
    skip: [/\/assets$/],
  })) {
    const key = getKey(entry);

    if (entry.isFile && entry.name === 'template.ejs') {
      templates[key] = entry.path;
    }

    if (
      entry.isFile &&
      entry.path.match(new RegExp(`.*\/__scripts\/${entry.name}$`)) &&
      entry.name.endsWith('.js')
    ) {
      if (scripts[key]) {
        scripts[key].push(entry.path);
      } else {
        scripts[key] = [entry.path];
      }
    }

    if (
      entry.isFile &&
      entry.path.match(new RegExp(`.*\/__styles\/${entry.name}$`)) &&
      entry.name.endsWith('.css')
    ) {
      if (styles[key]) {
        styles[key].push(entry.path);
      } else {
        styles[key] = [entry.path];
      }
    }

    if (entry.isFile && entry.name === 'model.ts') {
      models[key] = entry.path;
    }

    if (entry.isFile && entry.name === 'content.md') {
      contents[key] = entry.path;
    }

    if (
      entry.isDirectory &&
      key !== '' &&
      entry.name !== '__scripts' &&
      entry.name !== '__styles'
    ) {
      routes.push(key);
    }

    if (entry.isFile) {
      updatedAt[key] = [
        ...(updatedAt[key] ?? []),
        await getModifiedDate(entry.path),
      ];

      cachedAt[key] = [
        ...(cachedAt[key] ?? []),
        await getModifiedDate(`${BUILD_PATH}/${key}index.html`),
      ];
    }
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

        // get templates
        const _templates: string[] = [];
        const _scripts: string[] = [];
        const _styles: string[] = [];

        // get last updated/cached at
        const _lastUpdatedAt: number[] = [];
        const _lastCachedAt: number[] = [];

        const _routes: string[] = [];

        ['/', ...(route.match(/([^\/]+)/g) || [])].forEach((r) => {
          _routes.push(r);

          const key = (_routes.join('/') + '/').replace('//', '/');

          const t = templates[key];
          const s = scripts[key];
          const c = styles[key];
          const u = updatedAt[key];
          const a = cachedAt[key];

          if (t) _templates.push(t);
          if (s) _scripts.push(...s);
          if (c) _styles.push(...c);
          if (u) _lastUpdatedAt.push(...u);
          if (a) _lastCachedAt.push(...a);
        });

        return {
          route,
          model,
          content,
          templates: _templates,
          scripts: _scripts.sort(sortFilePaths),
          styles: _styles.sort(sortFilePaths),
          lastUpdatedAt: Number(Math.max(..._lastUpdatedAt)),
          lastCachedAt: Number(Math.max(..._lastCachedAt)),
        };
      })
  );
}

// Get file key
function getKey(entry: WalkEntry) {
  return (
    entry.path
      .replace(new RegExp(`^${PAGES_PATH}`), '')
      .replace('/__scripts', '')
      .replace('/__styles', '')
      .replace(entry.isFile ? `/${entry.name}` : '', '') + '/'
  );
}

// Get file modified time stamp
async function getModifiedDate(path: string) {
  return await Deno.stat(path)
    .then((stat) => stat.mtime ?? new Date(0))
    .catch(() => new Date(0))
    .then((date) => date.getTime());
}

// Sort the file paths based on their file names
function sortFilePaths(a: string, b: string) {
  return a.localeCompare(b);
}
