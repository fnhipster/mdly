export const PORT = Number(Deno.env.get('PORT')) || 8080;
export const PAGES_PATH = Deno.cwd() + '/pages';
export const BUILD_PATH = Deno.cwd() + '/.mdly';
