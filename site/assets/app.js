const DATA_PATHS = {
  config: "data/config.json",
  operations: "data/operations.json",
  deployments: "data/deployments.json",
  news: "data/news.json",
};

const STATUS_LABELS = {
  ok: "Готово",
  success: "Успешно",
  warning: "Внимание",
  pending: "Ожидает",
  error: "Ошибка",
  failed: "Ошибка",
  checking: "Проверка",
};

const WEATHER_CODES = {
  0: ["Ясно", "☀"],
  1: ["Преимущественно ясно", "◒"],
  2: ["Переменная облачность", "◑"],
  3: ["Пасмурно", "☁"],
  45: ["Туман", "≋"],
  48: ["Изморозь", "≋"],
  51: ["Лёгкая морось", "⌁"],
  53: ["Морось", "⌁"],
  55: ["Сильная морось", "⌁"],
  61: ["Небольшой дождь", "☂"],
  63: ["Дождь", "☂"],
  65: ["Сильный дождь", "☂"],
  71: ["Небольшой снег", "✣"],
  73: ["Снег", "✣"],
  75: ["Сильный снег", "✣"],
  80: ["Ливень", "☂"],
  81: ["Ливень", "☂"],
  82: ["Сильный ливень", "☂"],
  95: ["Гроза", "ϟ"],
  96: ["Гроза с градом", "ϟ"],
  99: ["Сильная гроза", "ϟ"],
};

const app = {
  config: null,
  operations: null,
  deployments: null,
  news: null,
  selectedDate: dateKey(new Date()),
  calendarDate: startOfMonth(new Date()),
  newsFilter: new URLSearchParams(location.search).get("news") || "all",
  tasks: loadTasks(),
  deletedTask: null,
  toastTimer: null,
  focusSeconds: 25 * 60,
  focusDeadline: null,
  focusTimer: null,
};

const elements = {
  themeToggle: document.querySelector("#theme-toggle"),
  themeColor: document.querySelector("#theme-color"),
  refreshButton: document.querySelector("#refresh-button"),
  todayLabel: document.querySelector("#today-label"),
  clock: document.querySelector("#clock"),
  briefTitle: document.querySelector("#brief-title"),
  briefSubtitle: document.querySelector("#brief-subtitle"),
  dataAge: document.querySelector("#data-age"),
  overallChip: document.querySelector("#overall-chip"),
  overallLabel: document.querySelector("#overall-label"),
  operationsList: document.querySelector("#operations-list"),
  operationsUpdated: document.querySelector("#operations-updated"),
  deploymentsList: document.querySelector("#deployments-list"),
  deploymentCount: document.querySelector("#deployment-count"),
  weatherSymbol: document.querySelector("#weather-symbol"),
  weatherTemperature: document.querySelector("#weather-temperature"),
  weatherSummary: document.querySelector("#weather-summary"),
  weatherPlace: document.querySelector("#weather-place"),
  daylightValue: document.querySelector("#daylight-value"),
  daylightDetail: document.querySelector("#daylight-detail"),
  newsList: document.querySelector("#news-list"),
  sourceFreshness: document.querySelector("#source-freshness"),
  quickLinksList: document.querySelector("#quick-links-list"),
  calendarGrid: document.querySelector("#calendar-grid"),
  calendarMonth: document.querySelector("#calendar-month"),
  calendarPrev: document.querySelector("#calendar-prev"),
  calendarNext: document.querySelector("#calendar-next"),
  selectedDateLabel: document.querySelector("#selected-date-label"),
  taskForm: document.querySelector("#task-form"),
  taskInput: document.querySelector("#task-input"),
  taskPriority: document.querySelector("#task-priority"),
  taskList: document.querySelector("#task-list"),
  taskProgressLabel: document.querySelector("#task-progress-label"),
  taskProgressBar: document.querySelector("#task-progress-bar"),
  nextActionText: document.querySelector("#next-action-text"),
  signalOperations: document.querySelector("#signal-operations"),
  signalDeployments: document.querySelector("#signal-deployments"),
  signalTasks: document.querySelector("#signal-tasks"),
  signalWeather: document.querySelector("#signal-weather"),
  focusTime: document.querySelector("#focus-time"),
  focusToggle: document.querySelector("#focus-toggle"),
  focusReset: document.querySelector("#focus-reset"),
  toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toast-message"),
  toastAction: document.querySelector("#toast-action"),
};

function createElement(tag, options = {}) {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([name, value]) => element.setAttribute(name, value));
  }
  return element;
}

function safeStatus(status) {
  return ["ok", "success", "warning", "pending", "error", "failed", "checking"].includes(status)
    ? status
    : "checking";
}

function statusFamily(status) {
  const value = safeStatus(status);
  if (value === "success") return "ok";
  if (value === "failed") return "error";
  if (value === "pending") return "warning";
  return value;
}

function safeUrl(value) {
  try {
    const parsed = new URL(value);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function loadTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem("control-center-tasks") || "[]");
    return Array.isArray(stored) ? stored.filter((task) => task && typeof task.text === "string") : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem("control-center-tasks", JSON.stringify(app.tasks));
}

function formatRelativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "время не указано";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
  if (absolute < 90) return formatter.format(Math.round(seconds / 60), "minute");
  if (absolute < 5400) return formatter.format(Math.round(seconds / 3600), "hour");
  if (absolute < 172800) return formatter.format(Math.round(seconds / 86400), "day");
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem("control-center-theme", theme);
  const isDark = theme === "dark";
  elements.themeToggle.setAttribute("aria-label", isDark ? "Включить светлую тему" : "Включить тёмную тему");
  elements.themeColor.setAttribute("content", isDark ? "#151616" : "#f2f2ee");
}

function updateClock() {
  const now = new Date();
  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(now);
  const date = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(now);
  elements.clock.textContent = time;
  elements.clock.dateTime = now.toISOString();
  elements.todayLabel.textContent = date.charAt(0).toUpperCase() + date.slice(1);

  const hour = now.getHours();
  const greeting = hour < 6 ? "Спокойной ночи." : hour < 12 ? "Доброе утро." : hour < 18 ? "Добрый день." : "Добрый вечер.";
  const name = app.config?.profile?.name?.trim();
  elements.briefTitle.textContent = name ? `${greeting.slice(0, -1)}, ${name}.` : greeting;
}

async function fetchJson(path) {
  const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadDashboardData({ announce = false } = {}) {
  elements.refreshButton.disabled = true;
  elements.refreshButton.setAttribute("aria-label", "Обновляю данные…");

  const entries = Object.entries(DATA_PATHS);
  const results = await Promise.allSettled(entries.map(([, path]) => fetchJson(path)));
  results.forEach((result, index) => {
    const key = entries[index][0];
    if (result.status === "fulfilled") app[key] = result.value;
  });

  renderConfig();
  renderOperations();
  renderDeployments();
  renderNews();
  updateFreshness();

  if (app.config) await loadWeather();

  elements.refreshButton.disabled = false;
  elements.refreshButton.setAttribute("aria-label", "Обновить данные");
  if (announce) showToast("Сводка обновлена");
}

function renderConfig() {
  if (!app.config) return;
  elements.weatherPlace.textContent = app.config.profile?.location_name || "Москва";
  const links = Array.isArray(app.config.quick_links) ? app.config.quick_links : [];
  elements.quickLinksList.replaceChildren();
  links.forEach((item) => {
    const url = safeUrl(item.url);
    if (!url) return;
    const link = createElement("a", {
      className: "quick-link",
      text: item.label || "Ссылка",
      attrs: { href: url, target: "_blank", rel: "noopener noreferrer" },
    });
    elements.quickLinksList.append(link);
  });
  updateClock();
}

function updateOverallChip(overall) {
  const state = statusFamily(overall?.state || "checking");
  const dot = elements.overallChip.querySelector(".status-dot");
  dot.className = `status-dot status-dot--${state}`;
  elements.overallLabel.textContent = overall?.title || "Нет свежего снимка";
}

function renderOperations() {
  const items = Array.isArray(app.operations?.items) ? app.operations.items.slice(0, 8) : [];
  elements.operationsList.replaceChildren();
  updateOverallChip(app.operations?.overall);

  if (!items.length) {
    elements.operationsList.append(createElement("p", { className: "operation-empty", text: "Операционные данные пока не загружены" }));
  }

  items.forEach((item) => {
    const state = statusFamily(item.state);
    const row = createElement("article", { className: "operation-row" });
    const dot = createElement("span", { className: `status-dot status-dot--${state}`, attrs: { "aria-hidden": "true" } });
    const copy = createElement("div", { className: "operation-copy" });
    copy.append(
      createElement("p", { className: "operation-title", text: item.title || "Операция" }),
      createElement("p", { className: "operation-detail", text: item.detail || STATUS_LABELS[item.state] || "Нет деталей" }),
    );
    const meta = createElement("p", { className: "operation-meta", text: item.meta || STATUS_LABELS[item.state] || "Проверка" });
    row.append(dot, copy, meta);
    elements.operationsList.append(row);
  });

  const checkedAt = app.operations?.checked_at;
  elements.operationsUpdated.textContent = checkedAt ? `Снимок ${formatRelativeTime(checkedAt)}` : "Нет свежего снимка";
  const okCount = items.filter((item) => statusFamily(item.state) === "ok").length;
  elements.signalOperations.textContent = items.length ? `${okCount} / ${items.length} в норме` : "Нет данных";
  updateSignal("operations", items.length ? okCount / items.length : 0.15, app.operations?.overall?.state);
}

function renderDeployments() {
  const items = Array.isArray(app.deployments?.items) ? app.deployments.items.slice(0, 6) : [];
  elements.deploymentsList.replaceChildren();
  elements.deploymentCount.textContent = String(items.length);

  if (!items.length) {
    const empty = createElement("li", { className: "deployment-empty", text: "Импорт Aigis ещё не запускался" });
    elements.deploymentsList.append(empty);
  }

  items.forEach((item) => {
    const status = safeStatus(item.status);
    const family = statusFamily(status);
    const row = createElement("li", { className: "deployment-item" });
    row.append(createElement("span", { className: `deployment-node deployment-node--${status}`, attrs: { "aria-hidden": "true" } }));
    const body = createElement("div");
    const top = createElement("div", { className: "deployment-topline" });
    top.append(
      createElement("p", { className: "deployment-project", text: item.project || "Без названия" }),
      createElement("time", {
        className: "deployment-time",
        text: formatRelativeTime(item.deployed_at),
        attrs: { datetime: item.deployed_at || "" },
      }),
    );
    body.append(top, createElement("p", { className: "deployment-summary", text: item.summary || STATUS_LABELS[status] || "Без описания" }));
    const meta = createElement("p", { className: "deployment-meta-line" });
    meta.append(
      createElement("span", { className: "environment-label", text: item.environment || "env" }),
      createElement("span", { text: `${STATUS_LABELS[status] || "Статус"} · ${item.version || "без версии"}` }),
    );
    body.append(meta);
    row.append(body);
    elements.deploymentsList.append(row);
  });

  const successful = items.filter((item) => statusFamily(item.status) === "ok").length;
  const failed = items.filter((item) => statusFamily(item.status) === "error").length;
  elements.signalDeployments.textContent = failed ? `${failed} требует внимания` : items.length ? `${successful} успешно` : "Нет данных";
  updateSignal("deployments", items.length ? successful / items.length : 0.15, failed ? "error" : successful === items.length ? "ok" : "warning");
}

function updateSignal(name, progress, status) {
  const element = document.querySelector(`[data-signal="${name}"]`);
  if (!element) return;
  const family = statusFamily(status || "checking");
  const colors = { ok: "var(--ok)", warning: "var(--warning)", error: "var(--error)", checking: "var(--checking)" };
  element.style.setProperty("--progress", `${Math.max(8, Math.min(100, Math.round(progress * 100)))}%`);
  element.style.setProperty("--signal-color", colors[family]);
}

async function loadWeather() {
  const profile = app.config.profile || {};
  const params = new URLSearchParams({
    latitude: String(profile.latitude || 55.7558),
    longitude: String(profile.longitude || 37.6173),
    current: "temperature_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    daily: "sunrise,sunset,precipitation_probability_max",
    timezone: profile.timezone || "Europe/Moscow",
    forecast_days: "1",
  });

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const current = data.current || {};
    const [summary, symbol] = WEATHER_CODES[current.weather_code] || ["Погода без описания", "◌"];
    const temperature = Math.round(current.temperature_2m);
    const apparent = Math.round(current.apparent_temperature);
    const precipitation = Math.round(data.daily?.precipitation_probability_max?.[0] || 0);
    elements.weatherSymbol.textContent = symbol;
    elements.weatherTemperature.textContent = `${temperature}°`;
    elements.weatherSummary.textContent = `${summary} · ощущается как ${apparent}°`;
    elements.signalWeather.textContent = `${precipitation}%`;
    updateSignal("weather", 1 - precipitation / 100, precipitation > 65 ? "warning" : "ok");

    const sunrise = data.daily?.sunrise?.[0];
    const sunset = data.daily?.sunset?.[0];
    if (sunrise && sunset) {
      const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
      const duration = new Date(sunset) - new Date(sunrise);
      const hours = Math.floor(duration / 3600000);
      const minutes = Math.round((duration % 3600000) / 60000);
      elements.daylightValue.textContent = `${hours} ч ${minutes} мин`;
      elements.daylightDetail.textContent = `${timeFormat.format(new Date(sunrise))} → ${timeFormat.format(new Date(sunset))}`;
    }
  } catch {
    elements.weatherSymbol.textContent = "◌";
    elements.weatherTemperature.textContent = "--°";
    elements.weatherSummary.textContent = "Погода временно недоступна · попробуйте обновить";
    elements.signalWeather.textContent = "Нет данных";
    updateSignal("weather", 0.15, "checking");
  }
}

function renderNews() {
  const validFilters = ["all", "mts", "telecom", "infrastructure"];
  if (!validFilters.includes(app.newsFilter)) app.newsFilter = "all";
  document.querySelectorAll("[data-news-filter]").forEach((button) => {
    const active = button.dataset.newsFilter === app.newsFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const items = Array.isArray(app.news?.items) ? app.news.items : [];
  const filtered = items.filter((item) => app.newsFilter === "all" || item.category === app.newsFilter).slice(0, 9);
  elements.newsList.replaceChildren();

  if (!filtered.length) {
    elements.newsList.append(createElement("p", {
      className: "news-empty",
      text: items.length ? "В этой категории пока нет свежих материалов" : "Новости появятся после первого запуска update_news.py",
    }));
    return;
  }

  const categoryLabels = { mts: "МТС / МГТС", telecom: "Телеком", infrastructure: "Инфраструктура" };
  filtered.forEach((item) => {
    const article = createElement("article", { className: "news-item" });
    const meta = createElement("div", { className: "news-meta" });
    meta.append(
      createElement("span", { className: "news-category", text: categoryLabels[item.category] || "Телеком" }),
      createElement("time", { text: formatRelativeTime(item.published_at), attrs: { datetime: item.published_at || "" } }),
    );
    article.append(meta, createElement("h3", { className: "news-title", text: item.title || "Без заголовка" }));
    const source = createElement("p", { className: "news-source" });
    source.append(createElement("span", { text: item.source || "Источник" }));
    const url = safeUrl(item.url);
    if (url) {
      source.append(createElement("a", {
        text: "Открыть ↗",
        attrs: { href: url, target: "_blank", rel: "noopener noreferrer", "aria-label": `Открыть новость: ${item.title}` },
      }));
    }
    article.append(source);
    elements.newsList.append(article);
  });
}

function updateFreshness() {
  const candidates = [app.operations?.checked_at, app.deployments?.generated_at, app.news?.generated_at]
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));
  if (!candidates.length) {
    elements.sourceFreshness.textContent = "Нет снимка";
    elements.dataAge.textContent = "БЕЗ ДАННЫХ";
    return;
  }
  const newest = new Date(Math.max(...candidates.map((date) => date.getTime())));
  elements.sourceFreshness.textContent = formatRelativeTime(newest);
  elements.dataAge.textContent = formatRelativeTime(newest).toUpperCase();
}

function renderCalendar() {
  const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
  elements.calendarMonth.textContent = monthFormat.format(app.calendarDate);
  elements.calendarGrid.replaceChildren();

  ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach((day) => {
    elements.calendarGrid.append(createElement("span", { className: "calendar-weekday", text: day, attrs: { role: "columnheader" } }));
  });

  const first = startOfMonth(app.calendarDate);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
  const today = dateKey(new Date());
  const fullDate = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const key = dateKey(date);
    const button = createElement("button", {
      className: "calendar-day",
      text: String(date.getDate()),
      attrs: { type: "button", role: "gridcell", "aria-label": fullDate.format(date), "data-date": key },
    });
    if (date.getMonth() !== app.calendarDate.getMonth()) button.classList.add("is-outside");
    if (key === today) button.classList.add("is-today");
    if (key === app.selectedDate) {
      button.classList.add("is-selected");
      button.setAttribute("aria-selected", "true");
    }
    if (app.tasks.some((task) => task.date === key && !task.done)) button.classList.add("has-tasks");
    elements.calendarGrid.append(button);
  }

  const selected = dateFromKey(app.selectedDate);
  const selectedFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
  elements.selectedDateLabel.textContent = app.selectedDate === today ? "Сегодня" : selectedFormat.format(selected);
}

function renderTasks() {
  const tasks = app.tasks
    .filter((task) => task.date === app.selectedDate)
    .sort((a, b) => Number(a.done) - Number(b.done) || Number(b.priority === "high") - Number(a.priority === "high") || a.createdAt - b.createdAt);
  elements.taskList.replaceChildren();

  if (!tasks.length) {
    elements.taskList.append(createElement("li", { className: "task-empty", text: "На эту дату задач нет" }));
  }

  tasks.forEach((task) => {
    const item = createElement("li", { className: "task-item" });
    if (task.done) item.classList.add("is-complete");
    if (task.priority === "high") item.classList.add("is-high");
    const label = createElement("label", { className: "task-check" });
    const checkbox = createElement("input", { attrs: { type: "checkbox", "data-task-toggle": task.id } });
    checkbox.checked = Boolean(task.done);
    label.append(checkbox, createElement("span", { text: task.text }));
    const deleteButton = createElement("button", {
      className: "task-delete",
      attrs: { type: "button", "data-task-delete": task.id, "aria-label": `Удалить задачу: ${task.text}`, title: "Удалить задачу" },
    });
    deleteButton.append(createElement("span", { text: "×", attrs: { "aria-hidden": "true" } }));
    item.append(label, deleteButton);
    elements.taskList.append(item);
  });

  const complete = tasks.filter((task) => task.done).length;
  const progress = tasks.length ? (complete / tasks.length) * 100 : 0;
  elements.taskProgressLabel.textContent = `${complete} из ${tasks.length}`;
  elements.taskProgressBar.style.width = `${progress}%`;

  const todayKey = dateKey(new Date());
  const todayTasks = app.tasks.filter((task) => task.date === todayKey);
  const todayComplete = todayTasks.filter((task) => task.done).length;
  const next = todayTasks.find((task) => !task.done);
  elements.nextActionText.textContent = next?.text || (todayTasks.length ? "Все задачи на сегодня выполнены" : "Добавьте первую задачу на сегодня");
  elements.signalTasks.textContent = `${todayComplete} / ${todayTasks.length}`;
  updateSignal("tasks", todayTasks.length ? todayComplete / todayTasks.length : 0.12, todayTasks.length && todayComplete === todayTasks.length ? "ok" : "warning");
  renderCalendar();
}

function addTask(text, priority) {
  const task = {
    id: globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: text.trim(),
    priority: priority === "high" ? "high" : "normal",
    date: app.selectedDate,
    done: false,
    createdAt: Date.now(),
  };
  app.tasks.push(task);
  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  const index = app.tasks.findIndex((task) => task.id === id);
  if (index < 0) return;
  const [task] = app.tasks.splice(index, 1);
  app.deletedTask = { task, index };
  saveTasks();
  renderTasks();
  showToast("Задача удалена", "Отменить", () => {
    if (!app.deletedTask) return;
    app.tasks.splice(app.deletedTask.index, 0, app.deletedTask.task);
    app.deletedTask = null;
    saveTasks();
    renderTasks();
    showToast("Удаление отменено");
  });
}

function showToast(message, actionLabel = "", action = null) {
  clearTimeout(app.toastTimer);
  elements.toastMessage.textContent = message;
  elements.toastAction.hidden = !action;
  elements.toastAction.textContent = actionLabel;
  elements.toastAction.onclick = action;
  elements.toast.hidden = false;
  app.toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
    elements.toastAction.onclick = null;
    if (action) app.deletedTask = null;
  }, action ? 7000 : 3000);
}

function renderFocusTimer() {
  const minutes = Math.floor(app.focusSeconds / 60);
  const seconds = app.focusSeconds % 60;
  elements.focusTime.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  elements.focusToggle.textContent = app.focusTimer ? "Пауза" : app.focusSeconds === 25 * 60 ? "Начать" : "Продолжить";
}

function toggleFocusTimer() {
  if (app.focusTimer) {
    clearInterval(app.focusTimer);
    app.focusTimer = null;
    app.focusSeconds = Math.max(0, Math.ceil((app.focusDeadline - Date.now()) / 1000));
    renderFocusTimer();
    return;
  }
  if (app.focusSeconds <= 0) app.focusSeconds = 25 * 60;
  app.focusDeadline = Date.now() + app.focusSeconds * 1000;
  app.focusTimer = setInterval(() => {
    app.focusSeconds = Math.max(0, Math.ceil((app.focusDeadline - Date.now()) / 1000));
    renderFocusTimer();
    if (app.focusSeconds === 0) {
      clearInterval(app.focusTimer);
      app.focusTimer = null;
      showToast("Фокус-сессия завершена — сделайте короткую паузу");
    }
  }, 250);
  renderFocusTimer();
}

function resetFocusTimer() {
  clearInterval(app.focusTimer);
  app.focusTimer = null;
  app.focusSeconds = 25 * 60;
  renderFocusTimer();
}

elements.themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

elements.refreshButton.addEventListener("click", () => loadDashboardData({ announce: true }));
elements.calendarPrev.addEventListener("click", () => {
  app.calendarDate = new Date(app.calendarDate.getFullYear(), app.calendarDate.getMonth() - 1, 1);
  renderCalendar();
});
elements.calendarNext.addEventListener("click", () => {
  app.calendarDate = new Date(app.calendarDate.getFullYear(), app.calendarDate.getMonth() + 1, 1);
  renderCalendar();
});
elements.calendarGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  app.selectedDate = button.dataset.date;
  app.calendarDate = startOfMonth(dateFromKey(app.selectedDate));
  renderTasks();
});
elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!elements.taskInput.value.trim()) return;
  addTask(elements.taskInput.value, elements.taskPriority.value);
  elements.taskForm.reset();
  elements.taskInput.focus();
});
elements.taskList.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-task-toggle]");
  if (!checkbox) return;
  const task = app.tasks.find((item) => item.id === checkbox.dataset.taskToggle);
  if (!task) return;
  task.done = checkbox.checked;
  saveTasks();
  renderTasks();
});
elements.taskList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-task-delete]");
  if (button) deleteTask(button.dataset.taskDelete);
});
document.querySelectorAll("[data-news-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    app.newsFilter = button.dataset.newsFilter;
    const url = new URL(location.href);
    if (app.newsFilter === "all") url.searchParams.delete("news");
    else url.searchParams.set("news", app.newsFilter);
    history.replaceState(null, "", url);
    renderNews();
  });
});
elements.focusToggle.addEventListener("click", toggleFocusTimer);
elements.focusReset.addEventListener("click", resetFocusTimer);

setTheme(document.documentElement.dataset.theme || "light");
updateClock();
setInterval(updateClock, 1000);
renderTasks();
renderFocusTimer();
loadDashboardData();
