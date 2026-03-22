import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC_NOTES = path.join(ROOT, 'notes');
const SRC_PAGES = path.join(ROOT, 'pages');
const DIST = path.join(ROOT, 'dist');

const SITE = {
  name: 'Электроснабжение изнутри',
  shortName: 'AN',
  subtitle: 'Заметки по электроснабжению, расчётам, нормативам и практике',
  description: 'Личный сайт заметок по электроснабжению с публикацией из markdown-файлов прямо из папки notes.',
  author: 'AN',
  year: new Date().getFullYear(),
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDist() {
  fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);
}

function readFile(file) {
  return fs.readFileSync(file, 'utf8');
}

function writeFile(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, 'utf8');
}

function walk(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else if (entry.isFile() && full.endsWith('.md')) list.push(full);
  }
  return list;
}

function slugify(input) {
  const map = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
    'А':'a','Б':'b','В':'v','Г':'g','Д':'d','Е':'e','Ё':'e','Ж':'zh','З':'z','И':'i','Й':'y','К':'k','Л':'l','М':'m','Н':'n','О':'o','П':'p','Р':'r','С':'s','Т':'t','У':'u','Ф':'f','Х':'h','Ц':'ts','Ч':'ch','Ш':'sh','Щ':'shch','Ъ':'','Ы':'y','Ь':'','Э':'e','Ю':'yu','Я':'ya'
  };
  return String(input)
    .split('')
    .map(ch => map[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseYamlValue(raw) {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  if (v.startsWith('[') && v.endsWith(']')) {
    const inside = v.slice(1, -1).trim();
    if (!inside) return [];
    return inside.split(',').map(s => s.trim()).filter(Boolean).map(s => parseYamlValue(s));
  }
  return v;
}

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) {
    return { data: {}, body: content };
  }
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) return { data: {}, body: content };
  const raw = content.slice(4, end);
  const body = content.slice(end + 5);
  const data = {};
  let currentKey = null;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, rest] = m;
    currentKey = key;
    data[key] = parseYamlValue(rest);
  }
  return { data, body };
}

function inlineMarkdown(text) {
  const codeSpans = [];
  let out = text.replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `@@CODE${codeSpans.length - 1}@@`;
  });
  out = escapeHtml(out);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, (m, p1, p2) => `${p1}<em>${p2}</em>`);
  out = out.replace(/@@CODE(\d+)@@/g, (_, i) => codeSpans[Number(i)]);
  return out;
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;
  let inCode = false;
  let codeLang = '';
  let codeBuffer = [];
  let para = [];

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inlineMarkdown(para.join(' ').trim())}</p>`);
      para = [];
    }
  };
  const closeLists = () => {
    if (inUl) { html.push('</ul>'); inUl = false; }
    if (inOl) { html.push('</ol>'); inOl = false; }
  };
  const closeQuote = () => {
    if (inBlockquote) { html.push('</blockquote>'); inBlockquote = false; }
  };
  const flushCode = () => {
    if (inCode) {
      html.push(`<pre><code${codeLang ? ` class="language-${escapeHtml(codeLang)}"` : ''}>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
      inCode = false;
      codeLang = '';
      codeBuffer = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inCode) {
      if (trimmed.startsWith('```')) {
        flushCode();
      } else {
        codeBuffer.push(line);
      }
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      flushPara();
      closeLists();
      closeQuote();
      inCode = true;
      codeLang = trimmed.slice(3).trim();
      i++;
      continue;
    }

    if (!trimmed) {
      flushPara();
      closeLists();
      closeQuote();
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      closeLists();
      closeQuote();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara();
      closeLists();
      if (!inBlockquote) {
        html.push('<blockquote>');
        inBlockquote = true;
      }
      html.push(`<p>${inlineMarkdown(line.replace(/^>\s?/, '').trim())}</p>`);
      i++;
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      flushPara();
      closeQuote();
      if (inOl) { html.push('</ol>'); inOl = false; }
      if (!inUl) { html.push('<ul>'); inUl = true; }
      html.push(`<li>${inlineMarkdown(ul[1].trim())}</li>`);
      i++;
      continue;
    }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      flushPara();
      closeQuote();
      if (inUl) { html.push('</ul>'); inUl = false; }
      if (!inOl) { html.push('<ol>'); inOl = true; }
      html.push(`<li>${inlineMarkdown(ol[1].trim())}</li>`);
      i++;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushPara();
      closeLists();
      closeQuote();
      html.push('<hr />');
      i++;
      continue;
    }

    if (inUl && !ul) { html.push('</ul>'); inUl = false; }
    if (inOl && !ol) { html.push('</ol>'); inOl = false; }
    if (inBlockquote && !/^>\s?/.test(line)) { html.push('</blockquote>'); inBlockquote = false; }

    para.push(trimmed);
    i++;
  }

  flushPara();
  closeLists();
  closeQuote();
  flushCode();

  return html.join('\n');
}

function estimateReadingTime(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

function extractExcerpt(html, max = 220) {
  const text = html
    .replace(/<pre[\s\S]*?<\/pre>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…';
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

function pageShell({ title, description, body, currentPath = '/', extraHead = '' }) {
  const fullTitle = title ? `${title} — ${SITE.shortName}` : `${SITE.name}`;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(description || SITE.description)}" />
<link rel="stylesheet" href="/assets/styles.css" />
${extraHead}
</head>
<body data-path="${escapeHtml(currentPath)}">
<div class="page">
  <aside class="sidebar">
    <a class="brand" href="/">
      <span class="brand-mark">${SITE.shortName}</span>
      <span class="brand-text">
        <span class="brand-title">${SITE.name}</span>
        <span class="brand-subtitle">Проектирование электроснабжения</span>
      </span>
    </a>
    <nav class="sidebar-nav">
      <a href="/#articles">Публикации</a>
      <a href="/categories/">Категории</a>
      <a href="/tags/">Теги</a>
      <a href="/about/">Об авторе</a>
      <a href="/tools/">Инструменты</a>
      <a href="/contact/">Контакт</a>
    </nav>
    <section class="sidebar-block">
      <h2>Навигация</h2>
      <div class="sidebar-list">
        ${categoryLinks()}
      </div>
    </section>
    <section class="sidebar-block">
      <h2>Теги</h2>
      <div class="tag-cloud">
        ${tagLinks()}
      </div>
    </section>
  </aside>
  <main class="main">
    ${body}
  </main>
</div>
<script src="/assets/app.js" defer></script>
</body>
</html>`;
}

let allNotes = [];
let pages = [];

function normalizeCategory(cat, fallback = 'Без категории') {
  return String(cat || fallback).trim();
}

function getTopFolder(relPath) {
  const parts = relPath.split(path.sep);
  return parts.length > 1 ? parts[0] : 'general';
}

function collectNotes() {
  const files = fs.existsSync(SRC_NOTES) ? walk(SRC_NOTES) : [];
  const notes = [];
  for (const file of files) {
    const rel = path.relative(SRC_NOTES, file);
    const raw = readFile(file);
    const { data, body } = parseFrontmatter(raw);
    const title = data.title || path.basename(file, '.md').replace(/[-_]/g, ' ');
    const slug = data.slug || slugify(path.basename(file, '.md'));
    const nested = rel.replace(/\.md$/, '').split(path.sep).map(s => slugify(s));
    const url = '/notes/' + nested.join('/') + '/';
    const category = normalizeCategory(data.category || (rel.includes(path.sep) ? rel.split(path.sep)[0] : 'Заметки'));
    const date = data.date || '2026-01-01';
    const readingTime = Number(data.readingTime || estimateReadingTime(body));
    const contentHtml = markdownToHtml(body);
    const excerpt = data.description || extractExcerpt(contentHtml);
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : (data.tags ? String(data.tags).split(',').map(s => s.trim()).filter(Boolean) : []);
    notes.push({
      title,
      slug,
      url,
      rel,
      nested,
      category,
      date,
      dateHuman: formatDate(date),
      readingTime,
      description: data.description || excerpt,
      excerpt,
      tags,
      html: contentHtml,
      source: body,
      fullPath: file,
      dir: path.dirname(rel),
    });
  }
  notes.sort((a, b) => new Date(b.date) - new Date(a.date) || a.title.localeCompare(b.title, 'ru'));
  return notes;
}

function collectPages() {
  const files = fs.existsSync(SRC_PAGES) ? walk(SRC_PAGES) : [];
  const result = [];
  for (const file of files) {
    const rel = path.relative(SRC_PAGES, file);
    const raw = readFile(file);
    const { data, body } = parseFrontmatter(raw);
    const title = data.title || path.basename(file, '.md');
    const slug = data.slug || slugify(path.basename(file, '.md'));
    const url = `/${slug}/`;
    result.push({
      title, slug, url, description: data.description || '', html: markdownToHtml(body)
    });
  }
  return result;
}

function unique(arr) {
  return [...new Set(arr)];
}

function categoryLinks() {
  const cats = unique(allNotes.map(n => n.category)).sort((a,b) => a.localeCompare(b, 'ru'));
  return cats.map(cat => `<a href="/categories/${slugify(cat)}/">${escapeHtml(cat)}</a>`).join('');
}

function tagLinks() {
  const tags = unique(allNotes.flatMap(n => n.tags)).sort((a,b) => a.localeCompare(b, 'ru'));
  return tags.map(tag => `<a href="/tags/${slugify(tag)}/">${escapeHtml(tag)}</a>`).join('');
}

function noteCard(note) {
  const tags = note.tags.map(tag => `<a class="chip" href="/tags/${slugify(tag)}/">${escapeHtml(tag)}</a>`).join('');
  return `<article class="card">
    <div class="card-meta">
      <span>${escapeHtml(note.category)}</span>
      <span>${escapeHtml(note.dateHuman)}</span>
    </div>
    <h3><a href="${note.url}">${escapeHtml(note.title)}</a></h3>
    <p>${escapeHtml(note.description)}</p>
    <div class="card-bottom">
      <span>${escapeHtml(SITE.author)} · ${note.readingTime} мин</span>
      <span class="reading-link"><a href="${note.url}">Читать →</a></span>
    </div>
    <div class="chip-row">${tags}</div>
  </article>`;
}

function latestNotes(limit = 8) {
  return allNotes.slice(0, limit);
}

function homePage() {
  const heroStats = [
    { label: 'Публикации', value: allNotes.length },
    { label: 'Категории', value: unique(allNotes.map(n => n.category)).length },
    { label: 'Тегов', value: unique(allNotes.flatMap(n => n.tags)).length },
  ];
  const articleCards = latestNotes().map(noteCard).join('\n');
  const categories = unique(allNotes.map(n => n.category)).sort((a,b)=>a.localeCompare(b,'ru')).map(cat => {
    const items = allNotes.filter(n => n.category === cat).slice(0, 4);
    return `<section class="group">
      <div class="group-head">
        <h2>${escapeHtml(cat)}</h2>
        <a href="/categories/${slugify(cat)}/">Все →</a>
      </div>
      <div class="group-grid">${items.map(noteCard).join('')}</div>
    </section>`;
  }).join('\n');

  return pageShell({
    title: SITE.name,
    description: SITE.description,
    currentPath: '/',
    body: `
      <header class="hero">
        <div class="hero-eyebrow">2026 · ${escapeHtml(SITE.shortName)}</div>
        <h1>${escapeHtml(SITE.name)}</h1>
        <p class="hero-copy">${escapeHtml(SITE.subtitle)}</p>
        <p class="hero-text">Расчёты, схемы, нормативы и заметки для ежедневной инженерной работы. Добавьте новый файл в <code>notes/</code> — и он появится на сайте после сборки.</p>
        <div class="hero-actions">
          <a class="button" href="#articles">Смотреть публикации</a>
          <a class="button secondary" href="/about/">О проекте</a>
        </div>
        <div class="stats">${heroStats.map(s => `<div class="stat"><strong>${s.value}</strong><span>${escapeHtml(s.label)}</span></div>`).join('')}</div>
      </header>

      <section class="section">
        <div class="section-head">
          <h2>Публикации</h2>
          <div class="filters">
            <input id="search" type="search" placeholder="Поиск по статьям" aria-label="Поиск по статьям" />
          </div>
        </div>
        <div id="articles" class="cards">${articleCards}</div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Категории</h2>
        </div>
        ${categories}
      </section>
    `
  });
}

function categoryPage(category) {
  const items = allNotes.filter(n => n.category === category);
  return pageShell({
    title: category,
    description: `Публикации в категории ${category}`,
    currentPath: `/categories/${slugify(category)}/`,
    body: `
      <section class="page-head">
        <div class="breadcrumb"><a href="/">Главная</a> / <a href="/categories/">Категории</a></div>
        <h1>${escapeHtml(category)}</h1>
        <p>${items.length} публикаций</p>
      </section>
      <section class="section">
        <div class="cards">${items.map(noteCard).join('')}</div>
      </section>
    `
  });
}

function tagPage(tag) {
  const items = allNotes.filter(n => n.tags.includes(tag));
  return pageShell({
    title: `Тег: ${tag}`,
    description: `Публикации с тегом ${tag}`,
    currentPath: `/tags/${slugify(tag)}/`,
    body: `
      <section class="page-head">
        <div class="breadcrumb"><a href="/">Главная</a> / <a href="/tags/">Теги</a></div>
        <h1># ${escapeHtml(tag)}</h1>
        <p>${items.length} публикаций</p>
      </section>
      <section class="section">
        <div class="cards">${items.map(noteCard).join('')}</div>
      </section>
    `
  });
}

function notePage(note) {
  const tags = note.tags.map(tag => `<a class="chip" href="/tags/${slugify(tag)}/">${escapeHtml(tag)}</a>`).join('');
  return pageShell({
    title: note.title,
    description: note.description,
    currentPath: note.url,
    body: `
      <article class="article">
        <div class="page-head">
          <div class="breadcrumb"><a href="/">Главная</a> / <a href="/categories/${slugify(note.category)}/">${escapeHtml(note.category)}</a></div>
          <h1>${escapeHtml(note.title)}</h1>
          <p>${escapeHtml(note.dateHuman)} · ${note.readingTime} мин чтения</p>
        </div>
        <div class="article-meta">
          <span>${escapeHtml(note.category)}</span>
          <span>${escapeHtml(note.dateHuman)}</span>
          <span>${escapeHtml(SITE.author)}</span>
        </div>
        <div class="chip-row">${tags}</div>
        <div class="article-content">${note.html}</div>
      </article>
    `
  });
}

function pagePage(page) {
  return pageShell({
    title: page.title,
    description: page.description,
    currentPath: page.url,
    body: `
      <section class="page-head">
        <div class="breadcrumb"><a href="/">Главная</a> / ${escapeHtml(page.title)}</div>
        <h1>${escapeHtml(page.title)}</h1>
      </section>
      <article class="article">
        <div class="article-content">${page.html}</div>
      </article>
    `
  });
}

function categoriesIndex() {
  const cats = unique(allNotes.map(n => n.category)).sort((a,b)=>a.localeCompare(b,'ru'));
  return pageShell({
    title: 'Категории',
    description: 'Все категории сайта',
    currentPath: '/categories/',
    body: `
      <section class="page-head">
        <div class="breadcrumb"><a href="/">Главная</a></div>
        <h1>Категории</h1>
        <p>Разделы заметок по темам.</p>
      </section>
      <section class="section">
        <div class="cards">
          ${cats.map(cat => `<article class="card"><div class="card-meta"><span>${escapeHtml(cat)}</span><span>${allNotes.filter(n => n.category===cat).length}</span></div><h3><a href="/categories/${slugify(cat)}/">${escapeHtml(cat)}</a></h3><p>Публикации по теме «${escapeHtml(cat)}».</p></article>`).join('')}
        </div>
      </section>
    `
  });
}

function tagsIndex() {
  const tags = unique(allNotes.flatMap(n => n.tags)).sort((a,b)=>a.localeCompare(b,'ru'));
  return pageShell({
    title: 'Теги',
    description: 'Все теги сайта',
    currentPath: '/tags/',
    body: `
      <section class="page-head">
        <div class="breadcrumb"><a href="/">Главная</a></div>
        <h1>Теги</h1>
        <p>Быстрый вход в материалы по теме.</p>
      </section>
      <section class="section">
        <div class="tag-cloud big">
          ${tags.map(tag => `<a class="chip" href="/tags/${slugify(tag)}/">${escapeHtml(tag)}</a>`).join('')}
        </div>
      </section>
    `
  });
}

function articleIndexData() {
  return allNotes.map(n => ({
    title: n.title,
    url: n.url,
    category: n.category,
    date: n.date,
    excerpt: n.excerpt,
    tags: n.tags,
  }));
}

function writeAssets() {
  const css = `
:root{
  --bg:#0c1017;
  --panel:#111826;
  --panel-2:#161f2f;
  --text:#e8edf7;
  --muted:#98a4ba;
  --line:#263246;
  --accent:#7cb8ff;
  --accent-2:#9d7cff;
  --shadow: 0 20px 50px rgba(0,0,0,.28);
  --radius: 22px;
  --radius-sm: 16px;
  --max: 1280px;
}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{
  background:
    radial-gradient(circle at top left, rgba(124,184,255,.12), transparent 30%),
    radial-gradient(circle at top right, rgba(157,124,255,.10), transparent 28%),
    linear-gradient(180deg, #0b0f16 0%, #0c1017 42%, #090d13 100%);
  color:var(--text);
  font: 16px/1.6 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
a{color:inherit;text-decoration:none}
a:hover{color:var(--accent)}
.page{
  display:grid;
  grid-template-columns: 290px minmax(0,1fr);
  min-height:100vh;
}
.sidebar{
  position:sticky; top:0; height:100vh;
  padding:28px 22px;
  border-right:1px solid var(--line);
  background: rgba(10,14,20,.74);
  backdrop-filter: blur(16px);
  overflow:auto;
}
.brand{
  display:flex; gap:14px; align-items:center;
  padding:14px 14px 18px;
  border:1px solid var(--line);
  border-radius: var(--radius);
  background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
  box-shadow: var(--shadow);
}
.brand-mark{
  display:grid; place-items:center;
  width:52px; height:52px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(124,184,255,.28), rgba(157,124,255,.26));
  border:1px solid rgba(124,184,255,.24);
  font-weight:800;
  letter-spacing:.08em;
}
.brand-title{display:block;font-size:1rem;font-weight:800}
.brand-subtitle{display:block;color:var(--muted);font-size:.88rem}
.sidebar-nav, .sidebar-list, .tag-cloud{display:flex;flex-wrap:wrap;gap:10px}
.sidebar-nav{padding:18px 2px 0}
.sidebar-nav a{
  display:block; width:100%;
  padding:10px 14px;
  border-radius:14px;
  color:var(--muted);
}
.sidebar-nav a:hover{background:rgba(255,255,255,.03);color:var(--text)}
.sidebar-block{margin-top:24px}
.sidebar-block h2{margin:0 0 12px;font-size:.82rem;text-transform:uppercase;letter-spacing:.16em;color:var(--muted)}
.sidebar-list a, .chip{
  display:inline-flex; align-items:center; gap:8px;
  padding:8px 12px;
  border:1px solid var(--line);
  border-radius:999px;
  background: rgba(255,255,255,.03);
  color:var(--text);
  font-size:.9rem;
}
.main{padding:28px 30px 56px; max-width: var(--max); width:100%}
.hero{
  padding:34px 34px 28px;
  border:1px solid var(--line);
  border-radius: calc(var(--radius) + 4px);
  background:
    linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02)),
    rgba(15,21,32,.8);
  box-shadow: var(--shadow);
}
.hero-eyebrow,.breadcrumb,.card-meta,.article-meta,.section-head .filters label,.group-head a,.reading-link{color:var(--muted);font-size:.92rem}
.hero h1{margin:.15rem 0 .55rem;font-size:clamp(2.4rem, 4vw, 4.8rem);line-height:1.02}
.hero-copy{margin:0;color:#d8e2f3;font-size:1.18rem;max-width:52rem}
.hero-text{max-width:54rem;color:var(--muted);margin:16px 0 0}
.hero-text code{background:rgba(255,255,255,.06);padding:.15rem .4rem;border-radius:8px}
.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}
.button{
  display:inline-flex;align-items:center;justify-content:center;
  padding:12px 18px;border-radius:14px;
  background:linear-gradient(135deg, var(--accent), var(--accent-2));
  color:#07111f;font-weight:800;
  box-shadow:0 12px 28px rgba(124,184,255,.18);
}
.button.secondary{background:transparent;color:var(--text);border:1px solid var(--line);box-shadow:none}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:26px}
.stat{
  padding:16px;border-radius:18px;border:1px solid var(--line);
  background:rgba(255,255,255,.03)
}
.stat strong{display:block;font-size:1.4rem}
.stat span{color:var(--muted);font-size:.92rem}
.section{margin-top:26px}
.section-head, .group-head{
  display:flex;align-items:end;justify-content:space-between;gap:16px;
  margin-bottom:14px
}
.section-head h2, .group-head h2, .page-head h1{margin:0}
.filters input{
  width:min(100%, 320px); padding:12px 14px;
  background:rgba(255,255,255,.03); color:var(--text);
  border:1px solid var(--line); border-radius:14px; outline:none;
}
.cards, .group-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:14px;
}
.card, .article{
  border:1px solid var(--line);
  border-radius: var(--radius);
  background:rgba(15,21,32,.78);
  box-shadow: var(--shadow);
}
.card{padding:18px}
.card h3{margin:10px 0 10px;font-size:1.2rem;line-height:1.28}
.card p{margin:0;color:var(--muted)}
.card-bottom{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:14px;color:var(--muted);font-size:.92rem}
.chip-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.article{padding:28px}
.page-head{margin-bottom:18px}
.page-head .breadcrumb{margin-bottom:10px}
.page-head h1{font-size:clamp(2rem, 3.4vw, 3.4rem);line-height:1.08}
.page-head p{color:var(--muted);margin:.6rem 0 0}
.article-meta{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0 14px}
.article-content{max-width:72ch}
.article-content h2{margin-top:2rem;font-size:1.5rem}
.article-content h3{margin-top:1.5rem;font-size:1.2rem}
.article-content p, .article-content li{color:#d8e2f3}
.article-content p{margin:0 0 1rem}
.article-content ul, .article-content ol{padding-left:1.4rem}
.article-content li{margin:.35rem 0}
.article-content blockquote{
  margin:1.2rem 0;padding:10px 16px;
  border-left:4px solid var(--accent);
  background:rgba(124,184,255,.06);
  border-radius:12px
}
.article-content pre{
  overflow:auto;padding:18px;border-radius:18px;
  background:#0a0f17;border:1px solid var(--line)
}
.article-content code{
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background:rgba(255,255,255,.06); padding:.16rem .38rem; border-radius:8px
}
.article-content pre code{background:none;padding:0;display:block;white-space:pre}
.article-content hr{border:none;border-top:1px solid var(--line);margin:1.6rem 0}
.group{margin-top:18px}
.tag-cloud.big{padding:12px 0 0}
@media (max-width: 1100px){
  .page{grid-template-columns:1fr}
  .sidebar{position:relative;height:auto}
}
@media (max-width: 760px){
  .main{padding:18px}
  .hero{padding:22px}
  .stats{grid-template-columns:1fr}
  .cards,.group-grid{grid-template-columns:1fr}
  .section-head,.group-head{align-items:flex-start;flex-direction:column}
}
`;
  writeFile(path.join(DIST, 'assets', 'styles.css'), css.trim() + '\n');
  const app = `
(function(){
  const input = document.getElementById('search');
  const cards = document.querySelectorAll('#articles .card');
  if(!input || !cards.length) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(q) ? '' : 'none';
    });
  });
})();
`;
  writeFile(path.join(DIST, 'assets', 'app.js'), app.trim() + '\n');
}

function build() {
  cleanDist();
  allNotes = collectNotes();
  pages = collectPages();
  writeAssets();

  // landing and indexes
  writeFile(path.join(DIST, 'index.html'), homePage());
  writeFile(path.join(DIST, 'categories', 'index.html'), categoriesIndex());
  writeFile(path.join(DIST, 'tags', 'index.html'), tagsIndex());

  // notes and category/tag pages
  const cats = unique(allNotes.map(n => n.category));
  const tags = unique(allNotes.flatMap(n => n.tags));
  for (const note of allNotes) {
    writeFile(path.join(DIST, note.url.replace(/^\//, ''), 'index.html'), notePage(note));
  }
  for (const cat of cats) {
    writeFile(path.join(DIST, 'categories', slugify(cat), 'index.html'), categoryPage(cat));
  }
  for (const tag of tags) {
    writeFile(path.join(DIST, 'tags', slugify(tag), 'index.html'), tagPage(tag));
  }

  for (const page of pages) {
    writeFile(path.join(DIST, page.url.replace(/^\//, ''), 'index.html'), pagePage(page));
  }

  // data file for easy extension
  writeFile(path.join(DIST, 'search.json'), JSON.stringify(articleIndexData(), null, 2));

  console.log(`Built ${allNotes.length} notes and ${pages.length} pages into dist/`);
}

build();
