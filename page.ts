import { render as renderEJS } from 'https://esm.sh/v128/ejs@3.1.9';
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
  const model =
    index.model &&
    (await import(index.model + '?v=' + Date.now()).catch().then((_model) => {
      if (!_model?.default) return {};

      if (typeof _model.default === 'function') {
        return _model.default();
      }

      return _model.default;
    }));

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
        `const initializers = [];`,
        ...index.scripts.map(async (script) => {
          return await Deno.readTextFile(script)
            .then((js) => `initializers.push(${js});`)
            .catch();
        }),
        await Deno.readTextFile('./lib/client.js'),
      ])
    ).join('\n');

  // get styles
  const styles =
    index.styles &&
    (
      await Promise.all(
        index.styles.map(async (style) => {
          return await Deno.readTextFile(style).catch();
        })
      )
    ).join('\n');

  // Render Templates to HTML recursively
  const html = await templates?.reverse().reduce(async (child, template) => {
    const __content = await child;

    return await renderEJS(template, {
      ...data,
      __scripts: scripts,
      __styles: styles,
      __content,
    });
  }, Promise.resolve(markdown ? await renderContent(markdown) : ''));

  return html;
}
