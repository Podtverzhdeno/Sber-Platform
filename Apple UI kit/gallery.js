"use strict";
(function () {
  const q = (id) => document.getElementById(id);
  const doc = document;
  const theme = q("theme");
  const dialog = q("dialog");
  const menu = q("menu");
  const menuButton = q("menuButton");
  let toastTimeout;
  let dialogOpener = null;
  const toast = (message) => {
    const el = q("toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { el.hidden = true; }, 3200);
  };
  theme.addEventListener("click", () => {
    const dark = doc.body.dataset.mode !== "dark";
    doc.body.dataset.mode = dark ? "dark" : "light";
    theme.setAttribute("aria-pressed", String(dark));
    theme.textContent = dark ? "☾" : "☀";
  });
  doc.querySelectorAll(".segment button").forEach(button => button.addEventListener("click", () => {
    doc.querySelectorAll(".segment button").forEach(other => other.setAttribute("aria-pressed", String(other === button)));
    q("segmentStatus").textContent = "Выбран режим: " + button.textContent;
  }));
  q("range").addEventListener("input", event => {
    const value = event.target.value;
    q("rangeOutput").value = value + "%";
    q("progress").value = Number(value);
  });
  q("apply").addEventListener("click", () => q("buttonStatus").textContent = "Демодействие: продолжить");
  q("secondary").addEventListener("click", () => q("buttonStatus").textContent = "Демодействие: подробнее");
  const openDialog = (opener) => {
    dialogOpener = opener;
    dialog.showModal();
    q("cancelDialog").focus();
  };
  q("showDialog").addEventListener("click", () => openDialog(q("showDialog")));
  q("feedbackDialog").addEventListener("click", () => openDialog(q("feedbackDialog")));
  q("danger").addEventListener("click", () => openDialog(q("danger")));
  q("cancelDialog").addEventListener("click", () => dialog.close());
  q("confirmDialog").addEventListener("click", () => { dialog.close(); toast("Подтверждение показано — данные не изменены"); });
  dialog.addEventListener("close", () => dialogOpener?.focus());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  q("showToast").addEventListener("click", () => toast("Уведомление — демонстрация"));
  const closeMenu = () => { menu.hidden = true; menuButton.setAttribute("aria-expanded", "false"); };
  const openMenu = () => { menu.hidden = false; menuButton.setAttribute("aria-expanded", "true"); menu.querySelector("[role=menuitem]").focus(); };
  menuButton.addEventListener("click", () => menu.hidden ? openMenu() : closeMenu());
  menu.addEventListener("click", event => {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    closeMenu();
    menuButton.focus();
    location.href = action.dataset.action === "sources" ? "sources.md" : "acceptance.md";
  });
  doc.addEventListener("pointerdown", event => { if (!menu.hidden && !event.target.closest(".menuanchor")) closeMenu(); });
  doc.addEventListener("keydown", event => {
    if (event.key === "Escape" && !menu.hidden) { event.preventDefault(); closeMenu(); menuButton.focus(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); q("search").focus(); }
  });
  doc.querySelectorAll(".sideitem").forEach(button => button.addEventListener("click", () => {
    doc.querySelectorAll(".sideitem").forEach(other => other.removeAttribute("aria-current"));
    button.setAttribute("aria-current", "page");
    q(button.dataset.anchor).scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }));
  q("search").addEventListener("input", event => {
    const term = event.target.value.toLocaleLowerCase("ru").trim();
    doc.querySelectorAll("main section[data-keywords]").forEach(section => {
      section.hidden = Boolean(term) && !(section.dataset.keywords + " " + section.textContent).toLocaleLowerCase("ru").includes(term);
    });
    doc.querySelectorAll("main section.section").forEach(section => {
      if (!section.dataset.keywords) section.hidden = Boolean(term) && !(section.textContent).toLocaleLowerCase("ru").includes(term);
    });
  });
}());
