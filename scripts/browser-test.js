import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const desktop = Boolean(process.env.FACTORY_DESKTOP_CDP_PORT && process.env.AGENT_BROWSER_CDP);
const env = {
  ...process.env,
  AGENT_BROWSER_SESSION: process.env.AGENT_BROWSER_SESSION || `todomvc-test-${process.pid}`,
};
const flags = desktop ? ['--cdp', process.env.AGENT_BROWSER_CDP] : [];
let browserStarted = false;
function browser(args, input) {
  browserStarted = true;
  const result = spawnSync('agent-browser', [...flags, ...args], { cwd: root, env, input, encoding: 'utf8', timeout: 90000 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout);
  console.log(result.stdout.trim());
  return result.stdout;
}
const server = spawn(process.execPath, ['scripts/serve.js'], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
const stopped = once(server, 'exit');
try {
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local server did not become ready')), 10000);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Local server exited: ${code}`)); });
    server.stdout.on('data', chunk => {
      const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
  });
  browser(['open', url]);
  browser(['wait', '--fn', "document.querySelector('[data-filter=\"all\"]').getAttribute('aria-current') === 'page'"]);
  browser(['click', '#new-todo']);
  browser(['wait', '--fn', 'document.hasFocus()']);
  browser(['eval', '--stdin'], await readFile(new URL('../tests/browser-checks.js', import.meta.url), 'utf8'));
  browser(['open', url]);
  browser(['wait', '--fn', "document.querySelectorAll('.todo').length === 2"]);
  browser(['eval', '--stdin'], `(() => {
    const rows = [...document.querySelectorAll('.todo')];
    if (rows.length !== 2 || !rows[0].classList.contains('completed') || rows[1].classList.contains('completed')
      || rows[0].querySelector('.todo-title').textContent !== '<img src=x onerror=window.__todoXss=true>') throw new Error('Reload lost todo data');
    return 'PASS: reload preserves titles, order, and completion';
  })()`);
  browser(['open', url + '/#/completed']);
  browser(['wait', '--fn', "document.querySelectorAll('.todo').length === 1 && document.querySelector('[data-filter=\"completed\"]').getAttribute('aria-current') === 'page'"]);
  console.log('PASS: reload restores the filter from the URL hash');
  browser(['open', url]);
  browser(['wait', '--fn', "document.querySelectorAll('.todo').length === 2"]);
  browser(['eval', '--stdin'], `(async () => {
    for (const width of [1280, 320]) {
      const frame = document.createElement('iframe');
      frame.title = width + 'px responsive layout check';
      frame.style.cssText = 'position:fixed;inset:0;width:' + width + 'px;height:900px;border:0;z-index:1000';
      let timer;
      const loaded = new Promise((resolve, reject) => {
        frame.addEventListener('load', resolve, { once: true });
        timer = setTimeout(() => reject(new Error('Responsive frame did not load')), 10000);
      });
      frame.src = location.href;
      document.body.append(frame);
      try {
        await loaded;
        const win = frame.contentWindow;
        const doc = frame.contentDocument;
        if (win.innerWidth !== width || doc.querySelectorAll('.todo').length !== 2 || doc.documentElement.scrollWidth > width) throw new Error(width + 'px layout failed');
        const expectedPanelWidth = width === 320 ? 292 : 550;
        if (doc.querySelector('.todoapp').getBoundingClientRect().width !== expectedPanelWidth) throw new Error('Responsive panel width is wrong');
        if (width === 320 && win.getComputedStyle(doc.querySelector('.row-actions')).opacity !== '1') throw new Error('Mobile actions are not visible');
      } finally { clearTimeout(timer); frame.remove(); }
    }
    return 'PASS: 1280px and 320px real iframe viewports, correct panel widths, long titles without overflow, visible mobile actions';
  })()`);
  browser(['eval', '--stdin'], "localStorage.setItem('vanilla-todomvc:v1', '{broken')");
  browser(['open', url]);
  browser(['wait', '--fn', "!document.querySelector('#storage-notice').hidden"]);
  browser(['eval', '--stdin'], `(() => {
    if (!document.querySelector('#main').hidden || !document.querySelector('#storage-notice').textContent.includes('could not be loaded')) throw new Error('Invalid storage did not recover');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
    document.querySelector('#new-todo').value = 'Still works in memory';
    document.querySelector('#new-todo-form').requestSubmit();
    if (document.querySelectorAll('.todo').length !== 1 || !document.querySelector('#storage-notice').textContent.includes('could not save')) throw new Error('Failed storage stopped the app');
    Storage.prototype.setItem = original;
    document.querySelector('#new-todo').value = 'Storage recovered';
    document.querySelector('#new-todo-form').requestSubmit();
    if (!document.querySelector('#storage-notice').hidden) throw new Error('Storage warning did not clear on recovery');
    localStorage.removeItem('vanilla-todomvc:v1');
    return 'PASS: malformed storage, quota failure, in-memory use, and recovery';
  })()`);
  const errors = JSON.parse(browser(['errors', '--json']));
  if (errors.data.errors.length) throw new Error('Browser reported JavaScript errors');
  console.log('Browser regression checks passed.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (!desktop && browserStarted) {
    try { browser(['close']); } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
  server.kill('SIGTERM');
  await stopped;
}
