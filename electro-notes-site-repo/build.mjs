import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC_NOTES = path.join(ROOT, 'notes');
const SRC_PAGES = path.join(ROOT, 'pages');
const SRC_IMAGES = path.join(ROOT, 'images');
const SRC_STYLES = path.join(ROOT, 'globals.css');
const DIST = path.join(ROOT, 'dist');

const SITE = {
  name: 'Электроснабжение изнутри',
  shortName: 'AN',
  subtitle: 'Заметки по электроснабжению, расчётам, нормативам и практике',
  description: 'Личный сайт заметок по электроснабжению с автоматической публикацией markdown-файлов из папки notes.',
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

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) copyFile(from, to);
  }
}

function walk(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
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
  if (!content.startsWith('---\n')) return { data: {}, body: content };
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) return { data: {}, body: content };
  const raw = content.slice(4, end);
  const body = content.slice(end + 5);
  const data = {};
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, rest] = m;
    data[key] = parseYamlValue(rest);
  }
  return { data, body };
}

function sanitizeHref(url) {
  const u = String(url).trim();
  if (/^(https?:\/\/|\/)/.test(u)) return u;
  return '#';
}

function renderInline(text) {
  const tokens = [];
  let out = String(text);

  out = out.replace(/`([^`]+)`/g, (_, code) => {
    tokens.push(`<code>${escapeHtml(code)}</code>`);
    return `@@CODE${tokens.length - 1}@@`;
  });

  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const safeSrc = escapeHtml(sanitizeHref(src));
    const safeAlt = escapeHtml(alt);
    tokens.push(`<img src="${safeSrc}" alt="${safeAlt}" loading="lazy" />`);
    return `@@IMG${tokens.length - 1}@@`;
  });

  out = escapeHtml(out);

  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safeHref = escapeHtml(sanitizeHref(href));
    return `<a href="${safeHref}"${safeHref.startsWith('http') ? ' target="_blank" rel="noreferrer"' : ''}>${label}</a>`;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, (m, p1, p2) => `${p1}<em>${p2}</em>`);

  out = out.replace(/@@CODE(\d+)@@/g, (_, i) => tokens[Number(i)] || '');
  out = out.replace(/@@IMG(\d+)@@/g, (_, i) => tokens[Number(i)] || '');

  return out;
}

function markdownToHtml(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
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
      html.push(`<p>${renderInline(para.join(' ').trim())}</p>`);
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
      if (trimmed.startsWith('```')) flushCode();
      else codeBuffer.push(line);
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

    const standaloneImage = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (standaloneImage) {
      flushPara();
      closeLists();
      closeQuote();
      const alt = escapeHtml(standaloneImage[1]);
      const src = escapeHtml(sanitizeHref(standaloneImage[2]));
      html.push(`<figure class="article-inline-image"><img src="${src}" alt="${alt}" loading="lazy" />${alt ? `<figcaption>${alt}</figcaption>` : ''}</figure>`);
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      closeLists();
      closeQuote();
      html.push(`<h${heading[1].length}>${renderInline(heading[2].trim())}</h${heading[1].length}>`);
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
      html.push(`<p>${renderInline(line.replace(/^>\s?/, '').trim())}</p>`);
      i++;
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      flushPara();
      closeQuote();
      if (inOl) { html.push('</ol>'); inOl = false; }
      if (!inUl) { html.push('<ul>'); inUl = true; }
      html.push(`<li>${renderInline(ul[1].trim())}</li>`);
      i++;
      continue;
    }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      flushPara();
      closeQuote();
      if (inUl) { html.push('</ul>'); inUl = false; }
      if (!inOl) { html.push('<ol>'); inOl = true; }
      html.push(`<li>${renderInline(ol[1].trim())}</li>`);
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
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

function extractExcerpt(html, max = 220) {
  const text = String(html)
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

function unique(arr) {
  return [...new Set(arr)];
}

let allNotes = [];
let allPages = [];

function collectNotes() {
  const files = walk(SRC_NOTES);
  const notes = [];
  for (const file of files) {
    const rel = path.relative(SRC_NOTES, file);
    const raw = readFile(file);
    const { data, body } = parseFrontmatter(raw);
    const title = data.title || path.basename(file, '.md').replace(/[-_]/g, ' ');
    const nested = rel.replace(/\.md$/, '').split(path.sep).map(s => slugify(s));
    const url = '/notes/' + nested.join('/') + '/';
    const category = String(data.category || (rel.includes(path.sep) ? rel.split(path.sep)[0] : 'Заметки')).trim();
    const date = String(data.date || '2026-01-01');
    const readingTime = Number(data.readingTime || estimateReadingTime(body));
    const html = markdownToHtml(body);
    const excerpt = data.description || extractExcerpt(html);
    const tags = Array.isArray(data.tags)
      ? data.tags.map(String)
      : data.tags
        ? String(data.tags).split(',').map(s => s.trim()).filter(Boolean)
        : [];
    notes.push({
      title,
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
      html,
      cover: String(data.cover || '/images/cover-kz.jpg'),
      coverAlt: String(data.coverAlt || title),
      source: body,
      fullPath: file,
    });
  }
  notes.sort((a, b) => new Date(b.date) - new Date(a.date) || a.title.localeCompare(b.title, 'ru'));
  return notes;
}

function collectPages() {
  const files = walk(SRC_PAGES);
  const pages = [];
  for (const file of files) {
    const raw = readFile(file);
    const { data, body } = parseFrontmatter(raw);
    const title = data.title || path.basename(file, '.md');
    const slug = data.slug || slugify(path.basename(file, '.md'));
    pages.push({
      title,
      slug,
      url: `/${slug}/`,
      description: data.description || '',
      html: markdownToHtml(body),
    });
  }
  return pages;
}

function categoryItems() {
  const cats = unique(allNotes.map(n => n.category)).sort((a, b) => a.localeCompare(b, 'ru'));
  return cats.map(cat => {
    const items = allNotes.filter(n => n.category === cat);
    return {
      category: cat,
      slug: slugify(cat),
      count: items.length,
      items,
    };
  });
}

function tagItems() {
  return unique(allNotes.flatMap(n => n.tags)).sort((a, b) => a.localeCompare(b, 'ru'));
}

function pageShell({ title, description, body, currentPath = '/', extraHead = '' }) {
  const fullTitle = title ? `${title} — ${SITE.shortName}` : SITE.name;
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
      <div class="sidebar-accordion">
        ${categoryItems().map(group => `
          <details class="nav-group">
            <summary>
              <span class="label">${escapeHtml(group.category)}</span>
              <span class="count">${group.count}</span>
            </summary>
            <div class="sublist">
              ${group.items.map(note => `<a href="${note.url}">${escapeHtml(note.title)}</a>`).join('\n')}
            </div>
          </details>
        `).join('\n')}
      </div>
    </section>

    <section class="sidebar-block">
      <h2>Теги</h2>
      <div class="tag-cloud">
        ${tagItems().map(tag => `<a class="chip" href="/tags/${slugify(tag)}/">${escapeHtml(tag)}</a>`).join('\n')}
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

function noteCard(note) {
  const chips = note.tags.map(tag => `<a class="chip" href="/tags/${slugify(tag)}/">${escapeHtml(tag)}</a>`).join('');
  return `<article class="card">
    <a class="card-cover" href="${note.url}">
      <img src="${escapeHtml(note.cover)}" alt="${escapeHtml(note.coverAlt)}" loading="lazy" />
      <span class="badge">${escapeHtml(new Date(note.date + 'T00:00:00').getFullYear())}</span>
    </a>
    <div class="card-body">
      <div class="card-meta">
        <span>${escapeHtml(note.category)}</span>
        <span>${escapeHtml(note.dateHuman)}</span>
      </div>
      <h3><a href="${note.url}">${escapeHtml(note.title)}</a></h3>
      <p>${escapeHtml(note.excerpt)}</p>
      <div class="card-footer">
        <span>${escapeHtml(SITE.author)} · ${note.readingTime} мин чтения</span>
        <span><a href="${note.url}">Читать →</a></span>
      </div>
      <div class="article-nav">${chips}</div>
    </div>
  </article>`;
}

function homePage() {
  const heroStats = [
    { label: 'Публикации', value: allNotes.length },
    { label: 'Категории', value: unique(allNotes.map(n => n.category)).length },
    { label: 'Тегов', value: unique(allNotes.flatMap(n => n.tags)).length },
  ];
  const latest = allNotes.slice(0, 8).map(noteCard).join('\n');
  const groups = categoryItems().map(group => `
    <section class="group">
      <div class="group-head">
        <h2>${escapeHtml(group.category)}</h2>
        <a href="/categories/${group.slug}/">Все →</a>
      </div>
      <div class="group-grid">
        ${group.items.slice(0, 4).map(noteCard).join('\n')}
      </div>
    </section>
  `).join('\n');

  return pageShell({
    title: SITE.name,
    description: SITE.description,
    currentPath: '/',
    body: `
      <header class="hero">
        <div class="hero-flag"><span class="dot"></span><span>БЛОГ ПРОЕКТИРОВЩИКА</span></div>
        <h1>${escapeHtml(SITE.name)}</h1>
        <p class="lead">Расчёты, схемы, нормативы и живая практика. Всё, что стоит за стабильной работой электрических сетей.</p>
        <p class="sublead">Добавьте новый файл в <code>notes/</code> — после сборки он появится на сайте автоматически вместе с категорией, тегами и обложкой.</p>
        <div class="hero-actions">
          <a class="button" href="#articles">Смотреть публикации</a>
          <a class="button secondary" href="/categories/">Категории</a>
        </div>
        <div class="stats">
          ${heroStats.map(s => `<div class="stat"><strong>${s.value}</strong><span>${escapeHtml(s.label)}</span></div>`).join('')}
        </div>
      </header>

      <section class="section">
        <div class="section-head">
          <div class="section-title">Публикации</div>
          <div class="filters">
            <input id="search" type="search" placeholder="Поиск по статьям" aria-label="Поиск по статьям" />
          </div>
        </div>
        <div id="articles" class="cards">
          ${latest}
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div class="section-title">Разделы</div>
        </div>
        ${groups}
      </section>

      <div class="footer">Сайт генерируется из markdown-записей и статических изображений в папке <code>images/</code>.</div>
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
        <div>
          <div class="breadcrumb"><a href="/">Главная</a> / <a href="/categories/">Категории</a></div>
          <h1>${escapeHtml(category)}</h1>
        </div>
        <p>${items.length} публикаций</p>
      </section>
      <section class="section">
        <div class="cards">
          ${items.map(noteCard).join('\n')}
        </div>
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
        <div>
          <div class="breadcrumb"><a href="/">Главная</a> / <a href="/tags/">Теги</a></div>
          <h1># ${escapeHtml(tag)}</h1>
        </div>
        <p>${items.length} публикаций</p>
      </section>
      <section class="section">
        <div class="cards">
          ${items.map(noteCard).join('\n')}
        </div>
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
        <div class="article-cover">
          <img src="${escapeHtml(note.cover)}" alt="${escapeHtml(note.coverAlt)}" loading="eager" />
          <div class="overlay">
            <div class="meta-line">
              <span>${escapeHtml(note.category)}</span>
              <span>${escapeHtml(note.dateHuman)}</span>
              <span>${escapeHtml(note.readingTime)} мин чтения</span>
            </div>
            <h1>${escapeHtml(note.title)}</h1>
          </div>
        </div>
        <div class="article-body">
          <div class="breadcrumb"><a href="/">Главная</a> / <a href="/categories/${slugify(note.category)}/">${escapeHtml(note.category)}</a></div>
          <div class="article-meta">
            <span>${escapeHtml(SITE.author)}</span>
            <span>${escapeHtml(note.dateHuman)}</span>
            <span>${escapeHtml(note.readingTime)} мин</span>
          </div>
          <div class="article-nav">${tags}</div>
          <div class="article-content">${note.html}</div>
        </div>
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
        <div>
          <h1>${escapeHtml(page.title)}</h1>
          <p>${escapeHtml(page.description)}</p>
        </div>
      </section>
      <article class="article">
        <div class="article-body">
          <div class="article-content">${page.html}</div>
        </div>
      </article>
    `
  });
}

function categoriesIndex() {
  const cats = categoryItems();
  return pageShell({
    title: 'Категории',
    description: 'Все категории сайта',
    currentPath: '/categories/',
    body: `
      <section class="page-head">
        <div>
          <div class="breadcrumb"><a href="/">Главная</a></div>
          <h1>Категории</h1>
          <p>Разделы заметок по темам.</p>
        </div>
      </section>
      <section class="section">
        <div class="cards">
          ${cats.map(cat => `<article class="card"><div class="card-body"><div class="card-meta"><span>${escapeHtml(cat.category)}</span><span>${cat.count}</span></div><h3><a href="/categories/${cat.slug}/">${escapeHtml(cat.category)}</a></h3><p>Публикации по теме «${escapeHtml(cat.category)}».</p></div></article>`).join('\n')}
        </div>
      </section>
    `
  });
}

function tagsIndex() {
  const tags = tagItems();
  return pageShell({
    title: 'Теги',
    description: 'Все теги сайта',
    currentPath: '/tags/',
    body: `
      <section class="page-head">
        <div>
          <div class="breadcrumb"><a href="/">Главная</a></div>
          <h1>Теги</h1>
          <p>Быстрый вход в материалы по теме.</p>
        </div>
      </section>
      <section class="section">
        <div class="big-tag-cloud">
          ${tags.map(tag => `<a class="chip" href="/tags/${slugify(tag)}/">${escapeHtml(tag)}</a>`).join('\n')}
        </div>
      </section>
    `
  });
}

function writeAssets() {
  if (fs.existsSync(SRC_STYLES)) {
    copyFile(SRC_STYLES, path.join(DIST, 'assets', 'styles.css'));
  } else {
    throw new Error('globals.css not found');
  }

  const app = `
(function(){
  const input = document.getElementById('search');
  const cards = document.querySelectorAll('#articles .card');
  document.querySelectorAll('.nav-group').forEach((group) => {
    group.open = false;
    group.removeAttribute('open');
  });
  if (!input || !cards.length) return;

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

function writePages() {
  writeFile(path.join(DIST, 'index.html'), homePage());
  writeFile(path.join(DIST, 'categories', 'index.html'), categoriesIndex());
  writeFile(path.join(DIST, 'tags', 'index.html'), tagsIndex());

  for (const note of allNotes) {
    writeFile(path.join(DIST, note.url.replace(/^\//, ''), 'index.html'), notePage(note));
  }

  const cats = categoryItems();
  for (const cat of cats) {
    writeFile(path.join(DIST, 'categories', cat.slug, 'index.html'), categoryPage(cat.category));
  }

  const tags = tagItems();
  for (const tag of tags) {
    writeFile(path.join(DIST, 'tags', slugify(tag), 'index.html'), tagPage(tag));
  }

  for (const page of allPages) {
    writeFile(path.join(DIST, page.url.replace(/^\//, ''), 'index.html'), pagePage(page));
  }

  writeFile(path.join(DIST, 'search.json'), JSON.stringify(allNotes.map(n => ({
    title: n.title,
    url: n.url,
    category: n.category,
    date: n.date,
    excerpt: n.excerpt,
    tags: n.tags,
  })), null, 2));

  // helpful redirects-ish pages
  writeFile(path.join(DIST, 'robots.txt'), 'User-agent: *\nAllow: /\n');
}

function build() {
  cleanDist();
  allNotes = collectNotes();
  allPages = collectPages();
  writeAssets();
  copyDir(SRC_IMAGES, path.join(DIST, 'images'));
  writePages();
  console.log(`Built ${allNotes.length} notes and ${allPages.length} pages into dist/`);
}

build();
