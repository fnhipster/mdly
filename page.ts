import { render as renderEJS } from 'https://esm.sh/v128/ejs@3.1.9';
import { renderContent } from './content.ts';
import { PAGES_PATH } from './config.ts';

export async function getPageHTML(index: {
  route: string;
  model?: string;
  content?: string;
  templates?: string[];
  scripts?: string[];
  styles?: string[];
  revalidate?: boolean;
}) {
  // scope
  const __SCOPE__ = {
    script: index.scripts?.map(getScope),
    style: index.styles?.map(getScope),
    template: index.templates?.map(getScope),
  };

  // get data
  const model = await getModel(index.model);

  const data = {
    ...model,
    meta: {
      ...model?.meta,
    },
  };

  // prepare page data

  // get content
  const markdown =
    index.content && (await Deno.readTextFile(index.content).catch());

  // get templates
  const templates =
    index.templates &&
    (await Promise.all(
      index.templates.map(async (template) => {
        return await Deno.readTextFile(template).catch();
      })
    ));

  // get scripts
  const scripts =
    index.scripts &&
    (
      await Promise.all([
        ...index.scripts.map(async (script, index) => {
          const scope = __SCOPE__.script?.[index];

          return await Deno.readTextFile(script)
            .then((s) => {
              return `
              <script type="module" data-scope="${scope}">
                ${s}

                if (typeof mount === 'function') {
                  if (!window.__MOUNTED__) window.__MOUNTED__ = {};
                  window.__MOUNTED__['${scope}'] = mount();
                }
              </script>`;
            })
            .catch();
        }),
      ])
    ).join('\n');

  // get styles
  const styles =
    index.styles &&
    (
      await Promise.all(
        index.styles.map(async (style, index) => {
          const scope = __SCOPE__.style?.[index];

          return await Deno.readTextFile(style)
            .then((s) => {
              return `<style data-scope="${scope}">${s}</style>`;
            })
            .catch();
        })
      )
    ).join('\n');

  // Render Templates to HTML recursively
  const html = await templates
    ?.reverse()
    .reduce(async (child, template, index) => {
      const scope =
        __SCOPE__.template?.[__SCOPE__.template?.length - 1 - index];
      const __content = `<div data-scope="${scope}">${await child}</div>`;
      const __scripts = `
        ${scripts}

        <script data-scopes='${JSON.stringify({
          scripts: [...new Set(__SCOPE__.script)],
          styles: [...new Set(__SCOPE__.style)],
          templates: [...new Set(__SCOPE__.template)],
        })}'></script>

        <script type="module">
        ${await fetch(new URL('client.js', import.meta.url).href)
          .then((res) => res.text())
          .catch(console.log)}

        </script>
      `;
      const __styles = styles;

      return await renderEJS(template, {
        ...data,
        __scripts,
        __styles,
        __content,
      });
    }, Promise.resolve(markdown ? `${await renderContent(markdown, data)}` : ''));

  return html;
}

async function getModel(path?: string) {
  if (!path) return {};

  return await import('file://' + path + '?v=' + Date.now())
    .catch()
    .then((_model) => {
      if (!_model?.default) return {};

      if (typeof _model.default === 'function') {
        return _model.default();
      }

      return _model.default;
    });
}

function getScope(path: string) {
  const scope = path
    .replace(PAGES_PATH, '')
    .match(/(.*)(__scripts\/.*|__styles\/.*|template\.ejs$|content.md$)/)?.[1];
  return scope;
}
