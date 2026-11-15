/* Self-contained interactions for the demonstration only. No API, storage, tracking or network calls. */
(function () {
  "use strict";

  const root = document.documentElement;
  const theme = document.getElementById("theme-mode");
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("nav-toggle");
  const headings = {
    overview: "Обзор компонентов",
    navigation: "Навигация",
    messaging: "Сообщения",
    controls: "Элементы управления",
    materials: "Liquid Glass",
  };
  let previousDialogFocus = null;
  let toastTimeout = null;

  function applyTheme() {
    const choice = theme.value;
    const resolved = choice === "system" ? (media.matches ? "dark" : "light") : choice;
    root.dataset.theme = resolved;
  }
  theme.addEventListener("change", applyTheme);
  if (media.addEventListener) media.addEventListener("change", function () {
    if (theme.value === "system") applyTheme();
  });
  applyTheme();

  function closeNav(restoreFocus) {
    if (!sidebar.classList.contains("mobile-open")) return;
    sidebar.classList.remove("mobile-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Открыть навигацию");
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener("click", function () {
    const next = !sidebar.classList.contains("mobile-open");
    sidebar.classList.toggle("mobile-open", next);
    toggle.setAttribute("aria-expanded", String(next));
    toggle.setAttribute("aria-label", next ? "Закрыть навигацию" : "Открыть навигацию");
    if (next) sidebar.querySelector(".case-nav-link")?.focus();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeNav(true);
  });
  document.addEventListener("click", function (event) {
    if (sidebar.classList.contains("mobile-open") && !sidebar.contains(event.target) && !toggle.contains(event.target)) closeNav(false);
  });

  function showView(view) {
    if (!Object.hasOwn(headings, view)) return;
    document.querySelectorAll(".case-view").forEach(function (section) {
      section.hidden = section.dataset.section !== view;
    });
    document.querySelectorAll(".case-nav-link").forEach(function (item) {
      const active = item.dataset.view === view;
      item.classList.toggle("selected", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    document.getElementById("view-heading").textContent = headings[view];
    closeNav(false);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  document.querySelectorAll("[data-view], [data-go]").forEach(function (item) {
    item.addEventListener("click", function () {
      const view = item.dataset.go || item.dataset.view;
      showView(view);
    });
  });

  function toast(message) {
    const el = document.getElementById("toast");
    clearTimeout(toastTimeout);
    el.textContent = message;
    el.hidden = false;
    toastTimeout = setTimeout(function () { el.hidden = true; }, 3500);
  }
  document.getElementById("toast-show").addEventListener("click", function () {
    toast("Готово — это демонстрационное уведомление.");
  });
  document.getElementById("nav-new").addEventListener("click", function () {
    toast("Создание проекта недоступно в референсной галерее.");
  });

  const dlg = document.getElementById("sample-dialog");
  function openDialog() {
    previousDialogFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dlg.open) dlg.showModal();
  }
  function closeDialog() {
    if (dlg.open) dlg.close();
    if (previousDialogFocus?.isConnected) previousDialogFocus.focus();
  }
  document.getElementById("open-dialog").addEventListener("click", openDialog);
  document.getElementById("show-dialog-secondary").addEventListener("click", openDialog);
  document.getElementById("dialog-cancel").addEventListener("click", closeDialog);
  document.getElementById("dialog-confirm").addEventListener("click", function () {
    closeDialog();
    toast("Подтверждено в демонстрации.");
  });
  dlg.addEventListener("click", function (event) {
    if (event.target === dlg) closeDialog();
  });
  dlg.addEventListener("close", function () {
    if (previousDialogFocus?.isConnected) previousDialogFocus.focus();
  });

  const segments = { cards: "Карточки", list: "Список", compact: "Компактно" };
  document.querySelectorAll("[data-segment]").forEach(function (item) {
    item.addEventListener("click", function () {
      document.querySelectorAll("[data-segment]").forEach(function (button) {
        const active = item === button;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      document.getElementById("segment-result").textContent = "Сейчас выбрано: " + segments[item.dataset.segment];
    });
  });
  const components = ["Кнопка", "Поле ввода", "Поиск", "Чекбокс", "Переключатель", "Сегменты", "Диалог", "Навигация", "Liquid Glass"];
  const input = document.getElementById("component-filter");
  const results = document.getElementById("component-results");
  function renderResults() {
    const value = input.value.trim().toLocaleLowerCase("ru");
    results.replaceChildren();
    if (!value) return;
    const filtered = components.filter(function (name) { return name.toLocaleLowerCase("ru").includes(value); });
    if (filtered.length === 0) { results.textContent = "Ничего не найдено"; return; }
    filtered.forEach(function (name) {
      const span = document.createElement("span");
      span.textContent = name;
      results.appendChild(span);
    });
  }
  input.addEventListener("input", renderResults);

  document.querySelectorAll(".case-inner-link:not(:disabled)").forEach(function (item) {
    item.addEventListener("click", function () {
      document.querySelectorAll(".case-inner-link").forEach(function (button) {
        button.classList.remove("active");
        button.removeAttribute("aria-current");
      });
      item.classList.add("active");
      item.setAttribute("aria-current", "page");
    });
  });

  const chats = [
    { name: "Команда проекта", initials: "К", messages: [
      ["Привет! Посмотрим новую визуальную концепцию?", false],
      ["Да, соберём все состояния в единой библиотеке.", true],
      ["Отлично, начнём с навигации и форм.", false]
    ] },
    { name: "Ментор", initials: "М", messages: [
      ["Можем обсудить результаты проекта?", false],
      ["Да, подготовлю материалы к встрече.", true]
    ] },
    { name: "Импульс", initials: "И", messages: [
      ["Ваши достижения доступны в личном кабинете.", false]
    ] }
  ];
  let currentChat = 0;
  const thread = document.getElementById("message-thread");
  function renderChat() {
    const chat = chats[currentChat];
    document.getElementById("conversation-title").textContent = chat.name;
    thread.replaceChildren();
    const date = document.createElement("div");
    date.className = "case-date";
    date.textContent = "Сегодня";
    thread.appendChild(date);
    chat.messages.forEach(function (entry) {
      const message = document.createElement("div");
      message.className = "case-message" + (entry[1] ? " sent" : "");
      message.textContent = entry[0];
      thread.appendChild(message);
    });
    document.querySelectorAll("[data-conversation]").forEach(function (row) {
      row.classList.toggle("active", Number(row.dataset.conversation) === currentChat);
      row.setAttribute("aria-pressed", String(Number(row.dataset.conversation) === currentChat));
    });
    thread.scrollTop = thread.scrollHeight;
  }
  document.querySelectorAll("[data-conversation]").forEach(function (row) {
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-pressed", String(Number(row.dataset.conversation) === currentChat));
    function activate() { currentChat = Number(row.dataset.conversation); renderChat(); }
    row.addEventListener("click", activate);
    row.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } });
  });
  document.getElementById("conversation-search").addEventListener("input", function (event) {
    const value = event.target.value.trim().toLocaleLowerCase("ru");
    let visible = 0;
    document.querySelectorAll("[data-conversation]").forEach(function (row) {
      const match = chats[Number(row.dataset.conversation)].name.toLocaleLowerCase("ru").includes(value);
      row.hidden = !match;
      if (match) visible += 1;
    });
    document.getElementById("conversation-none").hidden = visible > 0;
  });
  document.getElementById("message-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const composer = document.getElementById("message-text");
    const value = composer.value.trim();
    if (!value) return;
    chats[currentChat].messages.push([value, true]);
    composer.value = "";
    renderChat();
    composer.focus();
    toast("Сообщение добавлено только в локальную демонстрацию.");
  });
})();
