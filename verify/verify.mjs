#!/usr/bin/env node
/**
 * Verify-VisuMax — независимая проверка того, что залито на боевые страницы mikof.md.
 *
 * Эталон берётся не из головы, а из локальных файлов export/visumax-{ru,en,ro}-body.html
 * (у них вырезается блок <style>, чтобы считать только разметку — CMS его всё равно удаляет).
 * Живые страницы тянутся по HTTP и сравниваются с эталоном класс в класс.
 *
 *   node verify/verify.mjs            все три языка
 *   node verify/verify.mjs --only ru  только указанные
 *
 * Требуется Node 18+ (встроенный fetch).
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ORIGIN = 'https://mikof.md';
const UA = 'Mozilla/5.0 (compatible; VisuMaxVerify/1.0)';

const PAGES = [
  { lang: 'ru', url: `${ORIGIN}/ru/visumax.shtml`, body: 'export/visumax-ru-body.html' },
  { lang: 'en', url: `${ORIGIN}/en/visumax.shtml`, body: 'export/visumax-en-body.html' },
  { lang: 'ro', url: `${ORIGIN}/visumax.shtml`, body: 'export/visumax-ro-body.html' },
];

// Классы, по которым видно, доехала ли разметка целиком.
// journey__* и price-note исчезают первыми, когда Body заливают визуальным редактором.
const KEY_CLASSES = [
  'journey__slide', 'journey__day', 'journey__num', 'journey__icon',
  'intro-nav', 'smile-explain', 'compare-table', 'price-note',
  'advantages', 'indications', 'faq-item',
];

const CSS_HREF = '/css/visumax.css';
const JS_SRC = 'visumax-carousel';
const PREVIEW_HOST = 'landing-visumax.vercel.app';

const argv = process.argv.slice(2);
const ONLY = (() => {
  const i = argv.indexOf('--only');
  return i >= 0 && argv[i + 1] ? argv[i + 1].split(',').map(s => s.trim().toLowerCase()) : null;
})();

const count = (haystack, needle) => haystack.split(needle).length - 1;
const stripStyle = html => html.replace(/<style[\s\S]*?<\/style>/gi, '');

async function get(url) {
  const out = { status: 0, body: '', error: null };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: ctrl.signal });
    clearTimeout(timer);
    out.status = res.status;
    out.body = await res.text();
  } catch (e) {
    out.error = e.name === 'AbortError' ? 'таймаут 30 с' : e.message;
  }
  return out;
}

/* ─── проверки одной страницы ──────────────────────────────────────────── */

function checkPage({ lang, url, body }, live) {
  const rows = [];
  const add = (name, status, detail) => rows.push({ name, status, detail });

  if (live.error || live.status !== 200) {
    add('доступность', 'FAIL', `${url} -> ${live.error || live.status}`);
    return rows;
  }
  add('доступность', 'PASS', `200, ${Math.round(live.body.length / 1024)} КБ`);

  const headEnd = live.body.search(/<\/head>/i);
  const head = headEnd > 0 ? live.body.slice(0, headEnd) : live.body;
  const hasCss = head.includes(CSS_HREF);
  add('CSS в head', hasCss ? 'PASS' : 'FAIL',
    hasCss ? `${CSS_HREF} подключён` : `${CSS_HREF} не подключён — страница без оформления лендинга`);

  const hasJs = live.body.includes(JS_SRC);
  add('карусель JS', hasJs ? 'PASS' : 'FAIL',
    hasJs ? 'visumax-carousel.js подключён' : 'visumax-carousel.js не подключён — карусель не листается');

  const src = join(ROOT, body);
  if (!existsSync(src)) {
    add('разметка', 'WARN', `эталон ${body} не найден — сравнить не с чем`);
  } else {
    const ref = stripStyle(readFileSync(src, 'utf8'));
    const expected = KEY_CLASSES.filter(c => count(ref, c) > 0);
    const diff = [];
    for (const cls of expected) {
      const want = count(ref, cls);
      const got = count(live.body, cls);
      if (got < want) diff.push(`${cls}: ${got}/${want}`);
    }
    add('разметка', diff.length ? 'FAIL' : 'PASS',
      diff.length
        ? `потеряно при заливке — ${diff.join(', ')} (перезалить Body через режим «Источник»)`
        : `все ${expected.length} ключевых классов на месте`);
  }

  const hotlinks = count(live.body, PREVIEW_HOST);
  add('картинки', hotlinks === 0 ? 'PASS' : 'WARN',
    hotlinks === 0 ? 'все ресурсы со своего домена' : `${hotlinks} ссылок на превью-домен ${PREVIEW_HOST}`);

  const canonical = live.body.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0] ?? '';
  add('canonical', canonical.includes(url) ? 'PASS' : 'FAIL',
    canonical ? canonical.replace(/\s+/g, ' ') : 'тега нет');

  const hreflangs = [...live.body.matchAll(/hreflang=["']([^"']+)["']/gi)].map(m => m[1].toLowerCase());
  const missing = ['x-default', lang].filter(h => !hreflangs.includes(h));
  add('hreflang', missing.length ? 'WARN' : 'PASS',
    `объявлено: ${hreflangs.join(', ') || 'ничего'}${missing.length ? ` · нет ${missing.join(', ')} (задача A4 SEO-техдолга)` : ''}`);

  return rows;
}

/* ─── прогон ───────────────────────────────────────────────────────────── */

async function main() {
  const started = Date.now();
  const pages = PAGES.filter(p => !ONLY || ONLY.includes(p.lang));

  const results = [];
  for (const page of pages) {
    process.stderr.write(`Тяну ${page.url}\n`);
    const live = await get(page.url);
    results.push({ page, rows: checkPage(page, live) });
  }

  // файлы у разработчика общие для всех языков — проверяются один раз
  const assets = [];
  for (const path of [CSS_HREF, '/assets/js/visumax-carousel.js']) {
    const r = await get(ORIGIN + path);
    assets.push({
      name: path,
      status: r.status === 200 ? 'PASS' : 'FAIL',
      detail: r.status === 200 ? `200, ${Math.round(r.body.length / 1024)} КБ` : `${r.error || r.status}`,
    });
  }

  const mark = { PASS: '[v]', FAIL: '[x]', WARN: '[!]' };
  const pad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, n);
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const counts = { PASS: 0, FAIL: 0, WARN: 0 };

  console.log('');
  console.log(`VisuMax на mikof.md — прогон ${stamp} UTC`);
  console.log('-'.repeat(104));
  console.log('Файлы у разработчика:');
  for (const a of assets) {
    counts[a.status]++;
    console.log(`${mark[a.status]} ${pad(a.name, 32)}${a.detail}`);
  }
  for (const { page, rows } of results) {
    console.log('');
    console.log(`${page.lang.toUpperCase()} — ${page.url}`);
    for (const r of rows) {
      counts[r.status]++;
      console.log(`${mark[r.status]} ${pad(r.name, 32)}${r.detail}`);
    }
  }
  console.log('-'.repeat(104));
  console.log(`Пройдено ${counts.PASS}   ·   не сделано ${counts.FAIL}   ·   требует внимания ${counts.WARN}`);

  const date = new Date().toISOString().slice(0, 10);
  const md = [
    `# Отчёт проверки VisuMax — ${date}`,
    '',
    `Сайт: ${ORIGIN} · языков: ${results.length} · прогон ${Math.round((Date.now() - started) / 1000)} с.`,
    '',
    `**Пройдено ${counts.PASS}, не сделано ${counts.FAIL}, требует внимания ${counts.WARN}.**`,
    '',
    '| Область | Проверка | Статус | Что показала проверка |',
    '|---|---|---|---|',
    ...assets.map(a => `| файлы | ${a.name} | ${a.status} | ${a.detail} |`),
    ...results.flatMap(({ page, rows }) =>
      rows.map(r => `| ${page.lang.toUpperCase()} | ${r.name} | ${r.status} | ${r.detail.replace(/\|/g, '\\|')} |`)),
    '',
    'Эталон разметки — локальные `export/visumax-{ru,en,ro}-body.html` без блока `<style>`.',
    'Визуальная сверка — https://landing-visumax.vercel.app/ru/',
    '',
  ].join('\n');

  mkdirSync(join(HERE, 'reports'), { recursive: true });
  const out = join(HERE, 'reports', `${date}.md`);
  writeFileSync(out, md, 'utf8');
  console.log(`Отчёт сохранён: verify/reports/${date}.md`);
}

main();
