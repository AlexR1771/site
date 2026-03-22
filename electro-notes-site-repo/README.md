# Electro Notes

Статический сайт заметок по электроснабжению, готовый для GitHub → Vercel.

## Как работает
- Пишите заметки в `notes/**.md`
- Добавляйте `title`, `date`, `category`, `tags`, `description` в frontmatter
- Выполняйте `npm run build`
- Vercel собирает сайт в `dist/`

## Структура
- `notes/` — заметки
- `pages/` — служебные страницы (`about`, `tools`, `contact`)
- `build.mjs` — генератор сайта без внешних зависимостей

## Локальная проверка
```bash
npm run build
python3 -m http.server -d dist 8000
```

Откройте `http://localhost:8000`.
