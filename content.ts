import { marked } from 'https://cdn.jsdelivr.net/npm/marked@5.1.1/+esm';
import { markedHighlight } from 'https://cdn.jsdelivr.net/npm/marked-highlight@2.0.1/+esm';
import { markedXhtml } from 'https://cdn.jsdelivr.net/npm/marked-xhtml@1.0.1/+esm';
import hljs from 'https://cdn.jsdelivr.net/npm/highlight.js@11.8.0/+esm';
import { getResizedImageURL, processImage } from './image.ts';

// Marked Extensions
marked.use(markedXhtml());

marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  })
);

// Markdown Renderer Overrides
marked.use({
  renderer: {
    image(href: string, _title: string, _text: string) {
      const alt = _text || '';
      const title = _title || '';
      const url = new URL(href, import.meta.url);
      const width = Number(url.searchParams.get('width')) || undefined;
      const height = Number(url.searchParams.get('height')) || undefined;
      const quality = Number(url.searchParams.get('quality')) || 80;
      const mode = (url.searchParams.get('mode') || 'crop') as 'crop';
      const lazy = url.searchParams.get('lazy') === 'true';

      if (!href.startsWith('/') || !width) {
        return `<img src="${href}" alt="${alt}" title="${title}" />`;
      }

      // Process Original Image
      const src = getResizedImageURL(url.pathname, { width, height });

      processImage(url.pathname, {
        width,
        height,
        quality,
        mode,
      });

      // Process Small Image
      const smWidth = Math.round(width / 2);
      const smHeight = height && Math.round(height / 2);

      const smSrc = getResizedImageURL(url.pathname, {
        width: smWidth,
        height: smHeight,
      });

      processImage(url.pathname, {
        width: smWidth,
        height: smHeight,
        quality,
        mode,
      });

      // Process Medium Image
      const mdWidth = Math.round(width / 1.5);
      const mdHeight = height && Math.round(height / 1.5);

      const mdSrc = getResizedImageURL(url.pathname, {
        width: mdWidth,
        height: mdHeight,
      });

      processImage(url.pathname, {
        width: mdWidth,
        height: mdHeight,
        quality,
        mode,
      });

      let img = '<img';
      img += ` src="${src}"`;
      img += ` srcset="${smSrc} 480w, ${mdSrc} 800w, ${src} 1200w"`;
      img += ` alt="${alt}"`;
      img += ` title="${title}"`;
      img += ` width="${width}"`;
      img += ` height="${height || ''}"`;
      img += lazy ? ' loading="lazy"' : '';
      img += ' />';

      return img;
    },
  },
});

export async function renderContent(markdown: string): Promise<string> {
  const __content = markdown
    ? await marked.parse(
        markdown,
        {
          headerIds: false,
          mangle: false,
        },
        undefined
      )
    : null;

  return __content;
}
