import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';

const root = new URL('../../docs/api/', import.meta.url);
const source = new URL('../../js/', import.meta.url);

test('the generated reference covers every app module and exported API', async () => {
  const index = await readFile(new URL('index.html', root), 'utf8');
  assert.ok(index.includes('Architecture and data flow'));
  assert.ok(index.includes('Controller example'));

  const modules = (await readdir(source)).filter(file => file.endsWith('.js'));
  assert.ok(modules.length > 0);
  for (const file of modules) {
    const name = file.slice(0, -3);
    const page = await readFile(new URL(`module-${name}.html`, root), 'utf8');
    assert.ok(page.includes(`Module: ${name}`), `${name} needs a module page`);
    assert.ok(page.includes(`href="${file}.html"`), `${name} needs a source link`);

    // The browser-only entry point has no exports and accesses the DOM on import.
    if (file === 'app.js') continue;
    const api = await import(new URL(file, source));
    for (const member of Object.keys(api)) {
      assert.ok(page.includes(`id=".${member}"`), `${name}.${member} is missing`);
    }
  }

  for (const [name, types] of [
    ['model', ['Todo', 'Action', 'Filter']],
    ['controller', ['Controller', 'State']],
    ['storage', ['TodoStorage', 'LoadResult']],
  ]) {
    const page = await readFile(new URL(`module-${name}.html`, root), 'utf8');
    for (const type of types) {
      assert.ok(page.includes(`id="~${type}"`), `${name}.${type} is missing`);
    }
  }
});

test('generated pages have working local navigation, type links, and assets', async () => {
  const pages = (await readdir(root)).filter(file => file.endsWith('.html'));
  assert.ok(pages.length > 0);
  for (const file of pages) {
    const pageURL = new URL(file, root);
    const page = await readFile(pageURL, 'utf8');
    for (const [, value] of page.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (value.startsWith('//')) continue;
      const target = new URL(value, pageURL);
      if (target.protocol !== 'file:') continue;
      const fragment = decodeURIComponent(target.hash.slice(1));
      target.hash = '';
      assert.ok((await stat(target)).isFile(), `${file}: missing ${value}`);
      // Prettify creates source line anchors in the browser rather than in HTML.
      if (!fragment || (target.pathname.endsWith('.js.html') && /^line\d+$/.test(fragment))) continue;
      const destination = await readFile(target, 'utf8');
      assert.ok(destination.includes(`id="${fragment}"`), `${file}: missing anchor ${value}`);
    }
  }
});
