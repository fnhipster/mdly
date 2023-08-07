import { render as renderEJS } from 'https://esm.sh/v128/ejs@3.1.9';
import { dirname } from 'https://deno.land/std@0.194.0/path/mod.ts';
import { renderContent } from './content.ts';

export async function getPageHTML(index: {
  route: string;
  model?: string;
  content?: string;
  templates?: string[];
  scripts?: string[];
  styles?: string[];
  revalidate?: boolean;
}) {
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
        ...index.scripts.map(async (script) => {
          return await Deno.readTextFile(script)
            .then((s) => {
              return `<script type="module">${s}</script>`;
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
        index.styles.map(async (style) => {
          return await Deno.readTextFile(style)
            .then((s) => {
              return `<style>${s}</style>`;
            })
            .catch();
        })
      )
    ).join('\n');

  // Render Templates to HTML recursively
  const html = await templates?.reverse().reduce(async (child, template) => {
    const __content = `<div data-scope="content">${await child}</div>`;

    const __scripts = scripts;

    const __styles = styles;

    return await renderEJS(template, {
      ...data,
      __scripts,
      __styles,
      __content,
    });
  }, Promise.resolve(markdown ? await renderContent(markdown, data) : ''));

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
