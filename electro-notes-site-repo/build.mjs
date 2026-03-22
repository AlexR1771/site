
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const NOTES_DIR = path.join(ROOT, "notes");
const PAGES_DIR = path.join(ROOT, "pages");
const DIST = path.join(ROOT, "dist");

const SITE = {
  name: "Электроснабжение изнутри",
  shortName: "AN",
  subtitle: "Проектирование электроснабжения",
  description:
    "Личный сайт заметок по электроснабжению с публикацией из markdown-файлов прямо из папки notes.",
  author: "AN",
};

const CATEGORY_IMAGES = {
  "РАСЧЁТЫ": "https://ext.same-assets.com/567633590/2036995865.webp",
  "НОРМАТИВЫ": "https://ext.same-assets.com/567633590/184707791.webp",
  "ПРАКТИКА": "https://ext.same-assets.com/567633590/2531552145.webp",
  "ОБЗОРЫ": "https://ext.same-assets.com/567633590/3639795011.webp",
  "ОСВЕЩЕНИЕ": "https://ext.same-assets.com/567633590/3986380470.webp",
  "default": "https://ext.same-assets.com/567633590/246392347.webp",
};

const HERO_IMAGE = "https://ext.same-assets.com/567633590/2531552145.webp";
const YEAR_BADGE = "2026";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDist() {
  fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);
}

function readFile(file) {
  return fs.readFileSync(file, "utf8");
}

function writeFile(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, "utf8");
}

function walk(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else if (entry.isFile() && full.toLowerCase().endsWith(".md")) list.push(full);
  }
  return list;
}

function slugify(input) {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y",
    ь: "", э: "e", ю: "yu", я: "ya",
    А: "a", Б: "b", В: "v", Г: "g", Д: "d", Е: "e", Ё: "e", Ж: "zh", З: "z", И: "i",
    Й: "y", К: "k", Л: "l", М: "m", Н: "n", О: "o", П: "p", Р: "r", С: "s", Т: "t",
    У: "u", Ф: "f", Х: "h", Ц: "ts", Ч: "ch", Ш: "sh", Щ: "shch", Ъ: "", Ы: "y",
    Ь: "", Э: "e", Ю: "yu", Я: "ya",
  };

  return String(input)
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseYamlValue(raw) {
  const v = raw.trim();
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  if (v.startsWith("[") && v.endsWith("]")) {
    const inside = v.slice(1, -1).trim();
    if (!inside) return [];
    return inside
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => parseYamlValue(part));
  }
  return v;
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) {
    return { data: {}, body: content };
  }
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return { data: {}, body: content };

  const raw = content.slice(4, end);
  const body = content.slice(end + 5);
  const data = {};

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, rest] = m;
    data[key] = parseYamlValue(rest);
  }

  return { data, body };
}

function toText(markdown) {
  return String(markdown)
    .replace(/\r\n/g, "\n")
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[#>*_`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inlineMarkdown(text) {
  const codeSpans = [];
  let out = String(text).replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `@@CODE${codeSpans.length - 1}@@`;
  });

  out = escapeHtml(out);
  out = out.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (_m, alt, url) => {
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
  });
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, label, url) => {
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, (_m, p1, p2) => `${p1}<em>${p2}</em>`);
  out = out.replace(/@@CODE(\d+)@@/g, (_m, i) => codeSpans[Number(i)]);
  return out;
}

function markdownToHtml(markdown) {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let i = 0;
  let inUl = false;
  let inOl = false;
  let inCode = false;
  let para = [];
  let codeLang = "";
  let codeBuffer = [];

  const flushPara = () => {
    if (!para.length) return;
    html.push(`<p>${inlineMarkdown(para.join(" ").trim())}</p>`);
    para = [];
  };

  const closeLists = () => {
    if (inUl) {
      html.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      html.push("</ol>");
      inOl = false;
    }
  };

  const flushCode = () => {
    if (!inCode) return;
    html.push(
      `<pre><code${codeLang ? ` data-lang="${escapeHtml(codeLang)}"` : ""}>${escapeHtml(
        codeBuffer.join("\n")
      )}</code></pre>`
    );
    inCode = false;
    codeLang = "";
    codeBuffer = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inCode) {
      if (trimmed.startsWith("```")) {
        flushCode();
      } else {
        codeBuffer.push(line);
      }
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushPara();
      closeLists();
      inCode = true;
      codeLang = trimmed.slice(3).trim();
      i += 1;
      continue;
    }

    if (!trimmed) {
      flushPara();
      closeLists();
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      closeLists();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara();
      closeLists();
      html.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, "").trim())}</blockquote>`);
      i += 1;
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (inOl) {
        html.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        html.push("<ul>");
        inUl = true;
      }
      html.push(`<li>${inlineMarkdown(ul[1].trim())}</li>`);
      i += 1;
      continue;
    }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      flushPara();
      if (inUl) {
        html.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        html.push("<ol>");
        inOl = true;
      }
      html.push(`<li>${inlineMarkdown(ol[1].trim())}</li>`);
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushPara();
      closeLists();
      html.push("<hr />");
      i += 1;
      continue;
    }

    para.push(trimmed);
    i += 1;
  }

  flushPara();
  closeLists();
  flushCode();

  return html.join("\n");
}

function estimateReadingTime(text) {
  const words = toText(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatCardDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(d);
}

function normalizeCategory(cat, fallback = "Без категории") {
  return String(cat || fallback).trim();
}

function asTags(raw) {
  if (Array.isArray(raw)) return raw.map(String).map((item) => item.trim()).filter(Boolean);
  if (raw == null) return [];
  return String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function categoryImage(category, index = 0) {
  const key = String(category || "").toUpperCase();
  const pool = CATEGORY_IMAGES[key] || CATEGORY_IMAGES.default;
  return Array.isArray(pool) ? pool[index % pool.length] : pool;
}

function makeImageForNote(note, index = 0) {
  const candidate = note.image || note.cover || note.hero;
  return candidate || categoryImage(note.category, index);
}

function collectNotes() {
  const files = walk(NOTES_DIR);
  const notes = [];

  for (const file of files) {
    const rel = path.relative(NOTES_DIR, file);
    const raw = readFile(file);
    const { data, body } = parseFrontmatter(raw);

    const title =
      data.title ||
      path.basename(file, ".md").replace(/[-_]+/g, " ").replace(/\b\p{L}/gu, (ch) => ch.toUpperCase());

    const nested = rel.replace(/\.md$/i, "").split(path.sep).map((part) => slugify(part));
    const url = `/notes/${nested.join("/")}/`;
    const category = normalizeCategory(
      data.category || (rel.includes(path.sep) ? rel.split(path.sep)[0] : "Заметки")
    );
    const date = String(data.date || "2026-01-01");
    const readingTime = Number(data.readingTime || estimateReadingTime(body));
    const contentHtml = markdownToHtml(body);
    const description = data.description || toText(body).slice(0, 220);
    const tags = asTags(data.tags);

    notes.push({
      title,
      slug: path.basename(file, ".md"),
      url,
      rel,
      nested,
      category,
      categorySlug: slugify(category) || "category",
      date,
      dateHuman: formatDate(date),
      dateCard: formatCardDate(date),
      readingTime,
      description,
      excerpt: description,
      tags,
      html: contentHtml,
      source: body,
      fullPath: file,
      image: makeImageForNote({ ...data, category }, notes.length),
    });
  }

  notes.sort((a, b) => new Date(b.date) - new Date(a.date) || a.title.localeCompare(b.title, "ru"));
  return notes;
}

function collectPages() {
  const files = walk(PAGES_DIR);
  const pages = [];

  for (const file of files) {
    const raw = readFile(file);
    const { data, body } = parseFrontmatter(raw);
    const title = data.title || path.basename(file, ".md");
    const slug = data.slug || slugify(path.basename(file, ".md"));
    pages.push({
      title,
      slug,
      url: `/${slug}/`,
      description: data.description || "",
      html: markdownToHtml(body),
    });
  }

  return pages;
}

function unique(arr) {
  return [...new Set(arr)];
}

function groupByCategory(notes) {
  const categories = unique(notes.map((n) => n.category))
    .sort((a, b) => {
      const diff = notes.filter((n) => n.category === b).length - notes.filter((n) => n.category === a).length;
      return diff || a.localeCompare(b, "ru");
    });

  return categories.map((category, index) => {
    const items = notes.filter((n) => n.category === category);
    return {
      category,
      slug: slugify(category) || `cat-${index + 1}`,
      count: items.length,
      items,
      open: index === 0,
    };
  });
}

function buildTagIndex(notes) {
  return unique(notes.flatMap((n) => n.tags)).sort((a, b) => a.localeCompare(b, "ru"));
}

function navLink(label, href, currentPath) {
  const active = currentPath === href || (href !== "/" && currentPath.startsWith(href));
  return `<a href="${href}" class="top-link${active ? " is-active" : ""}"${active ? ' aria-current="page"' : ""}>${escapeHtml(label)}</a>`;
}

function renderSidebar(notes, currentPath) {
  const categories = groupByCategory(notes);
  const tags = buildTagIndex(notes);

  const categoryBlocks = categories
    .map((group) => {
      const items = group.items.slice(0, 5);
      const itemsHtml = items
        .map(
          (item) =>
            `<a href="${item.url}" class="sidebar-item${currentPath === item.url ? " is-active" : ""}">${escapeHtml(item.title)}</a>`
        )
        .join("");
      return `
        <details class="sidebar-group"${group.open ? " open" : ""}>
          <summary class="sidebar-summary">
            <span class="sidebar-summary-left">
              <svg viewBox="0 0 16 16" aria-hidden="true" class="icon-chevron"><path d="M5 3.5 10 8l-5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <svg viewBox="0 0 16 16" aria-hidden="true" class="icon-folder"><path d="M1.5 4.5A2 2 0 0 1 3.5 2.5h3l1.5 1.5h4.5A2 2 0 0 1 14.5 6v6.5a2 2 0 0 1-2 2H3.5a2 2 0 0 1-2-2v-8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
              <span>${escapeHtml(group.category)}</span>
            </span>
            <span class="sidebar-count">${group.count}</span>
          </summary>
          ${itemsHtml ? `<div class="sidebar-items">${itemsHtml}</div>` : ""}
        </details>
      `;
    })
    .join("");

  const tagHtml = tags
    .map((tag) => {
      const tagSlug = slugify(tag);
      return `<a href="/tags/${tagSlug}/" class="tag-chip">${escapeHtml(tag)}</a>`;
    })
    .join("");

  return `
    <aside class="sidebar">
      <div class="section-label">
        <span class="section-label-bar"></span>
        <span>Навигация</span>
      </div>
      <div class="sidebar-categories">${categoryBlocks}</div>

      <div class="section-label" style="margin-top: 2rem;">
        <span class="section-label-bar"></span>
        <span>Теги</span>
      </div>
      <div class="tag-cloud">${tagHtml}</div>
    </aside>
  `;
}

function articleCard(note, { featured = false } = {}) {
  return `
    <article class="article-card${featured ? " is-featured" : ""}" data-category="${escapeHtml(note.categorySlug)}">
      <div class="article-media${featured ? " is-featured-media" : ""}">
        <img src="${escapeHtml(note.image)}" alt="${escapeHtml(note.title)}" loading="lazy" />
      </div>
      <div class="article-body">
        <div class="article-meta-row">
          <span class="meta-pill">${escapeHtml(note.category)}</span>
          <span class="meta-date">${escapeHtml(note.dateCard)}</span>
        </div>
        <h${featured ? "2" : "3"} class="article-title">${escapeHtml(note.title)}</h${featured ? "2" : "3"}>
        <p class="article-excerpt">${escapeHtml(note.excerpt)}</p>
        <div class="article-footer">
          <div class="article-meta">
            <span>${escapeHtml(SITE.author)}</span>
            <span>·</span>
            <span>${note.readingTime} мин</span>
          </div>
          <a class="read-more" href="${note.url}">Читать <span>→</span></a>
        </div>
      </div>
    </article>
  `;
}

function homePage(notes) {
  const featured = notes[0];
  const regular = notes.slice(1, 9);
  const categories = groupByCategory(notes);

  const tabs = ["Все", ...categories.map((c) => c.category)]
    .map((tab, idx) => {
      const slug = idx === 0 ? "all" : slugify(tab);
      return `<button type="button" class="filter-tab${idx === 0 ? " is-active" : ""}" data-filter="${escapeHtml(slug)}">${escapeHtml(tab)}</button>`;
    })
    .join("");

  const featuredHtml = featured
    ? articleCard(featured, { featured: true })
    : `<div class="empty-state">Пока нет заметок. Добавьте первый файл в <code>notes/</code>.</div>`;

  return renderShell({
    title: SITE.name,
    description: SITE.description,
    currentPath: "/",
    body: `
      <div class="page-grid">
        ${renderSidebar(notes, "/")}
        <main class="content">
          <section class="hero">
            <div class="hero-media">
              <img src="${HERO_IMAGE}" alt="${escapeHtml(SITE.name)}" loading="eager" />
              <div class="hero-overlay"></div>
              <div class="hero-content">
                <div class="hero-kicker">
                  <span class="hero-dot"></span>
                  <span>Блог проектировщика</span>
                </div>
                <h1>${escapeHtml(SITE.name)}</h1>
                <p>Расчёты, схемы, нормативы и живой опыт. Всё, что стоит за стабильной работой электрических сетей.</p>
              </div>
              <div class="hero-badge">${YEAR_BADGE}</div>
            </div>
          </section>

          <section class="section-heading">
            <div class="section-label">
              <span class="section-label-bar"></span>
              <span>Публикации</span>
            </div>
            <div class="tabs">${tabs}</div>
          </section>

          <section class="article-collection" data-article-collection>
            ${featuredHtml}
            <div class="article-grid">
              ${regular.map((note) => articleCard(note)).join("")}
            </div>
          </section>
        </main>
      </div>

      <script>
        (() => {
          const tabs = Array.from(document.querySelectorAll("[data-filter]"));
          const collection = document.querySelector("[data-article-collection]");
          if (!tabs.length || !collection) return;

          const cards = Array.from(collection.querySelectorAll("[data-category]"));
          function applyFilter(filter) {
            tabs.forEach((btn) => {
              btn.classList.toggle("is-active", btn.dataset.filter === filter);
            });

            cards.forEach((card) => {
              const visible = filter === "all" || card.dataset.category === filter;
              card.style.display = visible ? "" : "none";
            });
          }

          tabs.forEach((btn) => {
            btn.addEventListener("click", () => applyFilter(btn.dataset.filter || "all"));
          });
        })();
      </script>
    `,
  });
}

function renderShell({ title, description, currentPath, body }) {
  const fullTitle = title ? `${title} — ${SITE.shortName}` : SITE.name;
  const nav = [
    { label: "Статьи", href: "/" },
    
    { label: "Об авторе", href: "/about/" },
    { label: "Инструменты", href: "/tools/" },
    { label: "Контакт", href: "/contact/" },
  ]
    .map((item) => navLink(item.label, item.href, currentPath))
    .join("");

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description || SITE.description)}" />
  <meta name="theme-color" content="#101010" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="site">
    <header class="site-header">
      <div class="site-inner header-inner">
        <a class="brand" href="/">
          <span class="brand-mark">AN</span>
          <span class="brand-dot"></span>
          <span class="brand-subtitle">${escapeHtml(SITE.subtitle)}</span>
        </a>
        <nav class="top-nav" aria-label="Основная навигация">
          ${nav}
        </nav>
      </div>
    </header>

    <div class="site-inner page-body">
      ${body}
    </div>

    <footer class="site-footer">
      <div class="site-inner footer-inner">
        <div class="footer-brand">
          <span class="brand-mark">AN.</span>
          <span class="footer-copy">© 2026 AN. Все материалы являются авторскими.</span>
        </div>
        <nav class="footer-nav" aria-label="Навигация в подвале">
          ${navLink("Об авторе", "/about/", currentPath)}
          ${navLink("Инструменты", "/tools/", currentPath)}
          ${navLink("Контакт", "/contact/", currentPath)}
        </nav>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

function notePage(note, notes) {
  const related = notes
    .filter((item) => item.url !== note.url)
    .slice(0, 4)
    .map((item) => articleCard(item))
    .join("");

  return renderShell({
    title: note.title,
    description: note.description,
    currentPath: note.url,
    body: `
      <div class="page-grid">
        ${renderSidebar(notes, note.url)}
        <main class="content">
          <nav class="breadcrumbs">
            <a href="/">Главная</a>
            <span>/</span>
            <a href="/categories/${note.categorySlug}/">${escapeHtml(note.category)}</a>
          </nav>

          <article class="note-page">
            <div class="note-hero">
              <img src="${escapeHtml(note.image)}" alt="${escapeHtml(note.title)}" loading="eager" />
              <div class="note-hero-overlay"></div>
              <div class="note-hero-meta">
                <span class="meta-pill">${escapeHtml(note.category)}</span>
                <span class="meta-date">${escapeHtml(note.dateHuman)} · ${note.readingTime} мин чтения</span>
              </div>
              <h1>${escapeHtml(note.title)}</h1>
            </div>

            <div class="note-meta-row">
              <span>${escapeHtml(note.category)}</span>
              <span>${escapeHtml(note.dateHuman)}</span>
              <span>${escapeHtml(SITE.author)}</span>
            </div>

            <div class="note-tags">
              ${note.tags.map((tag) => `<a href="/tags/${slugify(tag)}/" class="article-tag">${escapeHtml(tag)}</a>`).join("")}
            </div>

            <div class="note-content">
              ${note.html}
            </div>
          </article>

          <section class="related-section">
            <div class="section-heading compact">
              <div class="section-label">
                <span class="section-label-bar"></span>
                <span>Похожие материалы</span>
              </div>
            </div>
            <div class="article-grid">
              ${related || `<div class="empty-state">Пока нет похожих материалов.</div>`}
            </div>
          </section>
        </main>
      </div>
    `,
  });
}

function categoryPage(category, notes) {
  const items = notes.filter((n) => n.category === category);
  const slug = slugify(category) || "category";
  return renderShell({
    title: category,
    description: `Публикации в категории ${category}`,
    currentPath: `/categories/${slug}/`,
    body: `
      <div class="page-grid">
        ${renderSidebar(notes, "/categories/")}
        <main class="content">
          <nav class="breadcrumbs">
            <a href="/">Главная</a>
            <span>/</span>
            <a href="/categories/">Категории</a>
          </nav>

          <section class="archive-page">
            <div class="section-heading compact">
              <div class="section-label">
                <span class="section-label-bar"></span>
                <span>${escapeHtml(category)}</span>
              </div>
              <div class="archive-count">${items.length} публикаций</div>
            </div>
            <div class="article-grid">
              ${items.map((note) => articleCard(note)).join("") || `<div class="empty-state">В этой категории пока нет заметок.</div>`}
            </div>
          </section>
        </main>
      </div>
    `,
  });
}

function tagPage(tag, notes) {
  const items = notes.filter((n) => n.tags.includes(tag));
  const slug = slugify(tag) || "tag";
  return renderShell({
    title: `Тег: ${tag}`,
    description: `Публикации с тегом ${tag}`,
    currentPath: `/tags/${slug}/`,
    body: `
      <div class="page-grid">
        ${renderSidebar(notes, "/tags/")}
        <main class="content">
          <nav class="breadcrumbs">
            <a href="/">Главная</a>
            <span>/</span>
            <a href="/tags/">Теги</a>
          </nav>

          <section class="archive-page">
            <div class="section-heading compact">
              <div class="section-label">
                <span class="section-label-bar"></span>
                <span># ${escapeHtml(tag)}</span>
              </div>
              <div class="archive-count">${items.length} публикаций</div>
            </div>
            <div class="article-grid">
              ${items.map((note) => articleCard(note)).join("") || `<div class="empty-state">По этому тегу пока нет заметок.</div>`}
            </div>
          </section>
        </main>
      </div>
    `,
  });
}

function listPage(title, items, currentPath, notes) {
  return renderShell({
    title,
    description: `${title} сайта`,
    currentPath,
    body: `
      <div class="page-grid">
        ${renderSidebar(notes, currentPath)}
        <main class="content">
          <nav class="breadcrumbs"><a href="/">Главная</a><span>/</span><span>${escapeHtml(title)}</span></nav>
          <section class="static-card">
            <div class="section-label">
              <span class="section-label-bar"></span>
              <span>${escapeHtml(title)}</span>
            </div>
            <div class="static-text">
              ${items}
            </div>
          </section>
        </main>
      </div>
    `,
  });
}

function categoriesIndex(notes) {
  const categories = groupByCategory(notes);
  const blocks = categories
    .map(
      (cat) => `
        <a class="index-link" href="/categories/${cat.slug}/">
          <span>${escapeHtml(cat.category)}</span>
          <strong>${cat.count}</strong>
        </a>
      `
    )
    .join("");

  return listPage("Категории", `
    <p>Разделы заметок по темам.</p>
    <div class="index-list">${blocks}</div>
  `, "/categories/", notes);
}

function tagsIndex(notes) {
  const tags = buildTagIndex(notes);
  const blocks = tags
    .map(
      (tag) => `
        <a class="tag-chip large" href="/tags/${slugify(tag)}/">${escapeHtml(tag)}</a>
      `
    )
    .join("");

  return listPage("Теги", `
    <p>Быстрый вход в материалы по теме.</p>
    <div class="tag-cloud">${blocks}</div>
  `, "/tags/", notes);
}

function staticPage(title, body, currentPath, notes) {
  return renderShell({
    title,
    description: title,
    currentPath,
    body: `
      <div class="page-grid">
        ${renderSidebar(notes, currentPath)}
        <main class="content">
          <nav class="breadcrumbs"><a href="/">Главная</a><span>/</span><span>${escapeHtml(title)}</span></nav>
          <section class="static-card">
            <div class="section-label">
              <span class="section-label-bar"></span>
              <span>${escapeHtml(title)}</span>
            </div>
            <div class="static-text">${body}</div>
          </section>
        </main>
      </div>
    `,
  });
}

function buildStyles() {
  return `
:root {
  --bg: #101010;
  --bg-2: #171717;
  --bg-3: #0d0d0d;
  --text: #d2d3d2;
  --muted: #6b6b6b;
  --muted-2: #4a4a4a;
  --border: #2a2a2a;
  --border-2: #3a3a3a;
  --accent: #c8d904;
  --accent-2: #d4e50a;
  --max: 1400px;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  min-height: 100%;
  background: var(--bg);
  color: var(--text);
}

body {
  font-family: "Space Grotesk", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a { color: inherit; text-decoration: none; }
img { display: block; max-width: 100%; }
button, summary { font: inherit; }
code, pre, .mono, .brand-subtitle, .section-label, .meta-date, .meta-pill, .tabs, .sidebar-count, .footer-copy {
  font-family: "JetBrains Mono", monospace;
}

.site { min-height: 100vh; display: flex; flex-direction: column; }

.site-inner {
  width: min(var(--max), calc(100% - 3rem));
  margin: 0 auto;
}

.site-header {
  border-bottom: 1px solid var(--border);
  background: rgba(16,16,16,0.92);
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(12px);
}

.header-inner,
.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1rem 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: .75rem;
  min-width: 0;
}

.brand-mark {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -.04em;
}

.brand-dot, .hero-dot {
  width: .5rem;
  height: .5rem;
  border-radius: 999px;
  background: var(--accent);
  flex: 0 0 auto;
}

.brand-subtitle {
  color: var(--muted);
  font-size: .78rem;
  letter-spacing: .08em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-nav, .footer-nav {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.top-link, .footer-nav a {
  color: var(--muted);
  font-size: .92rem;
  transition: color .2s ease, border-color .2s ease, background .2s ease;
}

.top-link:hover, .footer-nav a:hover { color: var(--text); }
.top-link.is-active {
  color: var(--accent);
  border: 1px solid var(--accent);
  padding: .45rem .9rem;
  background: rgba(200,217,4,0.08);
}

.page-body { flex: 1; }

.page-grid {
  display: grid;
  grid-template-columns: 16rem minmax(0, 1fr);
  gap: 0;
  min-height: calc(100vh - 74px);
}

.sidebar {
  border-right: 1px solid var(--border);
  padding: 1.5rem 1.5rem 2rem;
}

.content {
  padding: 1.5rem;
}

.section-label {
  display: flex;
  align-items: center;
  gap: .55rem;
  color: var(--muted);
  font-size: .72rem;
  text-transform: uppercase;
  letter-spacing: .12em;
  margin-bottom: 1rem;
}

.section-label-bar {
  width: 1rem;
  height: .125rem;
  background: var(--accent);
  flex: 0 0 auto;
}

.sidebar-group {
  border-bottom: 1px solid rgba(255,255,255,.02);
  margin-bottom: .3rem;
}

.sidebar-summary {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  cursor: pointer;
  padding: .7rem 0;
  user-select: none;
  transition: color .2s ease;
}
.sidebar-summary::-webkit-details-marker { display: none; }

.sidebar-summary:hover,
.sidebar-group[open] .sidebar-summary {
  color: var(--accent);
}

.sidebar-summary-left {
  display: flex;
  align-items: center;
  gap: .55rem;
  min-width: 0;
}

.icon-chevron,
.icon-folder {
  width: 1rem;
  height: 1rem;
  color: var(--muted);
  flex: 0 0 auto;
}

.sidebar-count {
  font-size: .72rem;
  color: var(--muted-2);
}

.sidebar-items {
  margin-left: 1.7rem;
  padding-left: .9rem;
  border-left: 1px solid var(--border);
  display: grid;
  gap: .15rem;
  padding-bottom: .45rem;
}

.sidebar-item {
  color: var(--muted);
  font-size: .9rem;
  padding: .42rem .55rem;
  border-radius: 0;
}
.sidebar-item:hover { color: var(--text); }
.sidebar-item.is-active {
  color: var(--accent);
  background: rgba(200,217,4,0.08);
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
}

.tag-chip {
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: .76rem;
  padding: .45rem .7rem;
  transition: .2s ease;
}
.tag-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.tag-chip.large { padding: .55rem .85rem; }

.hero {
  margin-bottom: 2rem;
}

.hero-media,
.note-hero {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg-3);
}

.hero-media {
  min-height: 280px;
}

.hero-media img,
.note-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-overlay,
.note-hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(16,16,16,.92) 0%, rgba(16,16,16,.78) 50%, rgba(16,16,16,0) 100%);
}

.hero-content,
.note-hero-meta,
.note-hero h1 {
  position: absolute;
  z-index: 2;
}

.hero-content {
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 2rem;
  max-width: 42rem;
}

.hero-kicker {
  display: flex;
  align-items: center;
  gap: .5rem;
  color: var(--muted);
  font-size: .72rem;
  text-transform: uppercase;
  letter-spacing: .12em;
  margin-bottom: .9rem;
}

.hero-content h1 {
  margin: 0;
  color: var(--accent);
  font-size: clamp(2.3rem, 4vw, 4rem);
  line-height: 1.05;
  letter-spacing: -.05em;
  max-width: 12ch;
}

.hero-content p {
  margin: .9rem 0 0;
  max-width: 42rem;
  color: var(--muted);
  line-height: 1.7;
  font-size: .98rem;
}

.hero-badge {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 2;
  border: 1px solid var(--accent);
  padding: .65rem .85rem;
  color: var(--text);
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -.03em;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  border: 1px solid var(--border);
  padding: 1rem 1.1rem;
  background: rgba(255,255,255,.015);
}
.stat-value {
  display: block;
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--accent);
  line-height: 1.1;
}
.stat-label {
  display: block;
  margin-top: .25rem;
  color: var(--muted);
  font-size: .82rem;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 1rem;
}
.section-heading.compact { margin-bottom: 1rem; }

.tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: .5rem;
}

.filter-tab {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  padding: .5rem .9rem;
  cursor: pointer;
  transition: .2s ease;
}
.filter-tab:hover { border-color: var(--border-2); }
.filter-tab.is-active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
}

.article-collection {
  display: grid;
  gap: 1.5rem;
}

.article-card {
  border: 1px solid var(--border);
  background: rgba(255,255,255,.01);
  transition: border-color .2s ease, transform .2s ease;
  overflow: hidden;
}
.article-card:hover {
  border-color: var(--border-2);
}
.article-card.is-featured {
  margin-bottom: .5rem;
}
.article-media {
  height: 180px;
  background: #111;
  overflow: hidden;
}
.article-card.is-featured .article-media {
  height: 300px;
}
.article-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.article-body { padding: 1.15rem 1.2rem 1.2rem; }

.article-meta-row {
  display: flex;
  align-items: center;
  gap: .7rem;
  margin-bottom: .7rem;
  flex-wrap: wrap;
}
.meta-pill {
  display: inline-flex;
  border: 1px solid var(--accent);
  color: var(--accent);
  font-size: .68rem;
  padding: .25rem .45rem;
  letter-spacing: .08em;
}
.meta-date {
  color: var(--muted-2);
  font-size: .72rem;
}

.article-title {
  margin: 0;
  color: var(--text);
  font-size: clamp(1.02rem, 1.2vw, 1.3rem);
  line-height: 1.35;
  letter-spacing: -.03em;
}
.article-title:hover { color: var(--accent); }

.article-excerpt {
  margin: .8rem 0 1rem;
  color: var(--muted);
  font-size: .92rem;
  line-height: 1.7;
}

.article-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  flex-wrap: wrap;
}

.article-meta {
  display: flex;
  align-items: center;
  gap: .45rem;
  color: var(--muted-2);
  font-size: .72rem;
}

.read-more {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  color: var(--muted);
  font-size: .92rem;
}
.read-more:hover { color: var(--accent); }

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
  margin-top: .9rem;
}
.article-tag {
  color: var(--muted);
  font-size: .72rem;
  border: 1px solid var(--border);
  padding: .28rem .45rem;
}
.article-tag:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.article-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 1.25rem;
}

.category-index {
  margin-top: 2.25rem;
  display: grid;
  gap: 1.25rem;
}
.category-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: .9rem;
}
.category-all, .archive-count {
  color: var(--muted);
  font-size: .82rem;
}
.category-all:hover { color: var(--accent); }
.category-block-items {
  display: grid;
  gap: 1.25rem;
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: .6rem;
  color: var(--muted);
  font-size: .82rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.breadcrumbs a:hover { color: var(--accent); }

.note-page,
.static-card {
  border: 1px solid var(--border);
  background: rgba(255,255,255,.01);
  overflow: hidden;
}

.note-hero {
  min-height: 320px;
  margin-bottom: 1rem;
}
.note-hero-meta {
  left: 1.4rem;
  bottom: 1.2rem;
  display: flex;
  align-items: center;
  gap: .75rem;
  flex-wrap: wrap;
}
.note-hero h1 {
  left: 1.4rem;
  right: 1.4rem;
  bottom: 3.8rem;
  margin: 0;
  color: var(--accent);
  font-size: clamp(2rem, 4vw, 3.5rem);
  line-height: 1.05;
  letter-spacing: -.05em;
  max-width: 15ch;
}

.note-meta-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: .82rem;
  margin: 0 0 1rem;
}

.note-tags {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
  margin-bottom: 1rem;
}

.note-content,
.static-text {
  padding: 1.35rem 1.4rem 1.5rem;
}

.note-content h1,
.note-content h2,
.note-content h3,
.note-content h4,
.note-content h5,
.note-content h6,
.static-text h1,
.static-text h2,
.static-text h3,
.static-text h4,
.static-text h5,
.static-text h6 {
  margin: 1.2rem 0 .7rem;
  line-height: 1.2;
  letter-spacing: -.03em;
}

.note-content h2,
.static-text h2 { font-size: 1.5rem; }
.note-content h3,
.static-text h3 { font-size: 1.2rem; }

.note-content p,
.static-text p {
  margin: 0 0 1rem;
  line-height: 1.8;
  color: var(--text);
}

.note-content ul,
.note-content ol,
.static-text ul,
.static-text ol {
  margin: .5rem 0 1rem 1.2rem;
  padding: 0;
  color: var(--text);
}

.note-content li,
.static-text li { margin: .35rem 0; }

.note-content blockquote,
.static-text blockquote {
  margin: 1rem 0;
  padding: 1rem 1rem 1rem 1.1rem;
  border-left: 2px solid var(--accent);
  background: rgba(200,217,4,.06);
  color: var(--text);
}

.note-content code,
.static-text code {
  background: rgba(255,255,255,.06);
  padding: .12rem .3rem;
  border: 1px solid rgba(255,255,255,.05);
}

.note-content pre,
.static-text pre {
  overflow-x: auto;
  background: #0c0c0c;
  border: 1px solid var(--border);
  padding: 1rem;
  margin: 1rem 0;
}
.note-content pre code,
.static-text pre code {
  background: transparent;
  border: 0;
  padding: 0;
  white-space: pre;
}

.note-content img,
.static-text img {
  margin: 1rem 0;
  border: 1px solid var(--border);
}

.related-section,
.archive-page {
  margin-top: 2rem;
}

.empty-state {
  border: 1px dashed var(--border-2);
  padding: 1rem 1.2rem;
  color: var(--muted);
  background: rgba(255,255,255,.01);
}

.index-list {
  display: grid;
  gap: .65rem;
  margin-top: 1rem;
}
.index-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--border);
  padding: .8rem .95rem;
}
.index-link:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.site-footer {
  border-top: 1px solid var(--border);
  margin-top: auto;
}
.footer-brand {
  display: flex;
  align-items: center;
  gap: .9rem;
  min-width: 0;
}
.footer-copy {
  color: var(--muted);
  font-size: .78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 1080px) {
  .page-grid {
    grid-template-columns: 1fr;
  }
  .sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
  .article-grid {
    grid-template-columns: 1fr;
  }
  .stats-row {
    grid-template-columns: 1fr;
  }
  .section-heading {
    flex-direction: column;
  }
  .tabs {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .site-inner {
    width: min(var(--max), calc(100% - 1.25rem));
  }

  .header-inner,
  .footer-inner {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-content {
    padding: 1.35rem;
  }

  .hero-media {
    min-height: 200px;
  }
  .note-hero {
    min-height: 240px;
  }

  .article-card.is-featured .article-media {
    height: 220px;
  }

  .content,
  .sidebar {
    padding: 1rem;
  }

  .brand-subtitle {
    white-space: normal;
  }

  .footer-brand {
    flex-direction: column;
    align-items: flex-start;
  }
}
`;
}

function buildStaticFiles() {
  const notes = collectNotes();
  const pages = collectPages();

  cleanDist();
  writeFile(path.join(DIST, "styles.css"), buildStyles());

  writeFile(path.join(DIST, "index.html"), homePage(notes));

  const categories = unique(notes.map((n) => n.category));
  for (const category of categories) {
    const slug = slugify(category) || "category";
    writeFile(path.join(DIST, "categories", slug, "index.html"), categoryPage(category, notes));
  }
  writeFile(path.join(DIST, "categories", "index.html"), categoriesIndex(notes));

  const tags = buildTagIndex(notes);
  for (const tag of tags) {
    const slug = slugify(tag) || "tag";
    writeFile(path.join(DIST, "tags", slug, "index.html"), tagPage(tag, notes));
  }
  writeFile(path.join(DIST, "tags", "index.html"), tagsIndex(notes));

  for (const note of notes) {
    writeFile(path.join(DIST, note.url.replace(/^\//, ""), "index.html"), notePage(note, notes));
  }

  for (const page of pages) {
    writeFile(
      path.join(DIST, page.url.replace(/^\//, ""), "index.html"),
      staticPage(page.title, page.html || "<p>Страница в разработке.</p>", page.url, notes)
    );
  }

  const aboutBody = `
    <p>Здесь можно разместить короткую информацию об авторе и о том, как устроен сайт.</p>
    <p>Страница уже подключена к навигации и готова к замене на ваш текст.</p>
  `;
  const toolsBody = `
    <p>Раздел для калькуляторов, шаблонов и рабочих инструментов проектировщика.</p>
    <p>Содержимое можно заменить на любое количество заметок или виджетов.</p>
  `;
  const contactBody = `
    <p>Раздел для контактов, ссылок на Telegram, email или форму обратной связи.</p>
    <p>Никакой жёсткой привязки к данным нет — только структура и оформление.</p>
  `;

  writeFile(path.join(DIST, "about", "index.html"), staticPage("Об авторе", aboutBody, "/about/", notes));
  writeFile(path.join(DIST, "tools", "index.html"), staticPage("Инструменты", toolsBody, "/tools/", notes));
  writeFile(path.join(DIST, "contact", "index.html"), staticPage("Контакт", contactBody, "/contact/", notes));

  const totalPages = 1 + categories.length + tags.length + notes.length + pages.length + 3;
  console.log(`Built ${notes.length} notes and ${totalPages} HTML pages in dist/`);
}

buildStaticFiles();
