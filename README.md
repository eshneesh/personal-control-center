# Personal Control Center

Личный утренний контроль-центр без npm, Docker и серверной базы. Страница объединяет:

- состояние локальных операций в формате существующего macOS-виджета;
- безопасную краткую ленту деплоев Aigis;
- текущую погоду по Москве;
- ежедневную ленту новостей по МТС, МГТС, телекому и инфраструктуре;
- мини-календарь, задачи в браузере и 25-минутный фокус-таймер;
- светлую и тёмную темы.

Папка `site/` — единственный публичный артефакт. Скрипты, исходные экспорты и секреты в GitHub Pages не попадают.

## Запуск на Mac

```bash
cd personal-control-center
python3 -m http.server 8080 --directory site
```

Откройте <http://localhost:8080>. Остановить сервер: `Control+C` в Терминале.

Важно: не открывайте `site/index.html` двойным кликом. Браузер ограничит чтение JSON по `file://`, и блоки данных останутся пустыми.

## Что хранится где

| Данные | Источник | Где остаются |
|---|---|---|
| Тема и задачи | ввод на странице | `localStorage` текущего браузера |
| Погода | Open-Meteo | загружается в браузере, ключ не нужен |
| Новости | публичный RSS | `site/data/news.json` |
| Операции | существующий локальный коллектор | очищенный `site/data/operations.json` |
| Деплои | экспорт Aigis/Telegram или JSON от пайплайна | очищенный `site/data/deployments.json` |

## Обновить новости вручную

```bash
cd personal-control-center
python3 scripts/update_news.py
```

В GitHub workflow `Refresh Morning News` делает это ежедневно в 07:17 по Москве, коммитит только `site/data/news.json` и сразу публикует обновлённый артефакт Pages. Отдельный шаг публикации нужен потому, что commit от стандартного `GITHUB_TOKEN` не должен использоваться как триггер для цепочки новых workflow.

## Подтянуть операции существующего виджета

```bash
cd personal-control-center
python3 scripts/sync_operations.py \
  --collector /path/to/corporate-PBIVIZ/mgts-news-digest/automation/collect_monitor_status.py
```

Токены использует исходный локальный коллектор. Новый скрипт получает его JSON через stdout, удаляет URL, локальные пути и похожие на секреты значения, затем записывает только безопасный снимок.

Для проверки без сетевых API добавьте `--local-only`.

## Подтянуть последние деплои Aigis

Автоматически читать старые сообщения одного Telegram-бота другим ботом ненадёжно: обычные боты не получают сообщения от других ботов. Для временной реализации есть 2 входа.

### Вариант 1. Экспорт Telegram Desktop

1. Откройте чат или канал с Aigis в Telegram Desktop.
2. Выберите экспорт истории чата.
3. Формат — JSON; медиа можно не экспортировать.
4. Запустите:

```bash
cd personal-control-center
python3 scripts/sync_aigis_export.py ~/Downloads/Telegram\ Desktop/DataExport/result.json
```

Скрипт ищет сообщения о деплоях и сохраняет только проект, контур, статус, версию, время и короткое описание. Исходный текст, отправитель, chat ID, ссылки, email и токены не сохраняются.

Если в сообщениях нет слова `deploy`/`деплой`, добавьте `--include-all` и обязательно просмотрите результат перед публикацией.

### Вариант 2. JSON из пайплайна Aigis

Передайте файл такого вида тому же скрипту:

```json
{
  "items": [
    {
      "project": "digest",
      "environment": "production",
      "status": "success",
      "version": "abc1234",
      "deployed_at": "2026-08-19T07:40:00+03:00",
      "summary": "Обновлена аналитика просмотров"
    }
  ]
}
```

```bash
python3 scripts/sync_aigis_export.py /path/to/aigis-deployments.json
```

Это лучший следующий шаг: Aigis или CI пишет структурированный файл напрямую, а не заставляет разбирать текст Telegram.

## Проверка перед публикацией

```bash
python3 scripts/check_site.py
python3 scripts/validate_public_data.py
node --check site/assets/app.js
```

`validate_public_data.py` блокирует публикацию, если в `site/` обнаружены похожий на токен текст, домашний путь, приватный IP или внутренний URL.

## GitHub Pages

Репозиторий уже содержит `.github/workflows/pages.yml`. Он проверяет данные и публикует только папку `site/`.

1. Создайте отдельный репозиторий на GitHub.
2. Добавьте remote и отправьте `main`.
3. В `Settings → Pages → Build and deployment` выберите `GitHub Actions`.
4. Дождитесь workflow `Publish Control Center`.

Пример команд после первого локального коммита:

```bash
gh repo create eshneesh/personal-control-center --private --source=. --remote=origin
git push -u origin main
```

Даже если репозиторий private, не считайте обычный GitHub Pages приватным корпоративным хостингом. Приватный доступ к Pages — отдельная возможность GitHub Enterprise Cloud. Поэтому в `site/` должны оставаться только данные, которые допустимо показать публично.

## Настройка под себя

Откройте `site/data/config.json`:

- `profile.name` — имя в приветствии; пустое значение оставляет нейтральное приветствие;
- координаты и timezone — город для погоды;
- `quick_links` — безопасные внешние ссылки.

Внутренние корпоративные URL не добавляйте, если страница будет опубликована публично. Для полностью приватного режима запускайте страницу только на Mac или размещайте `site/` во внутреннем контуре.
