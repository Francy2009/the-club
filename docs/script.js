/* Progressive enhancement: downloads, anchors and FAQ also work without JS. */
(() => {
  const menuToggle = document.querySelector(".menu-toggle");
  const navLinks = document.getElementById("nav-links");
  const mobile = window.matchMedia("(max-width: 680px)");
  const closeMenu = (restoreFocus = false) => {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Apri menu");
    navLinks.classList.remove("is-open");
    if (restoreFocus) menuToggle.focus();
  };
  menuToggle.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") !== "true";
    menuToggle.setAttribute("aria-expanded", String(expanded));
    menuToggle.setAttribute(
      "aria-label",
      expanded ? "Chiudi menu" : "Apri menu",
    );
    navLinks.classList.toggle("is-open", expanded);
  });
  navLinks.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link || !mobile.matches) return;
    closeMenu();
    // Move focus to the destination so closing the menu cannot hide focus.
    if (
      link.hash &&
      link.origin === location.origin &&
      link.pathname === location.pathname
    ) {
      const target = document.getElementById(link.hash.slice(1));
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    } else {
      menuToggle.focus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      menuToggle.getAttribute("aria-expanded") === "true"
    )
      closeMenu(true);
  });
  document.addEventListener("click", (event) => {
    if (
      menuToggle.getAttribute("aria-expanded") === "true" &&
      !event.target.closest(".nav")
    )
      closeMenu();
  });
  mobile.addEventListener("change", () => {
    const shouldRestore =
      mobile.matches && navLinks.contains(document.activeElement);
    closeMenu(shouldRestore);
  });

  const tabList = document.querySelector(".demo-tabs");
  const tabs = [...tabList.querySelectorAll("[data-tab]")];
  const panels = [...document.querySelectorAll(".demo-panel")];
  tabList.setAttribute("role", "tablist");
  tabs.forEach((tab) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `demo-${tab.dataset.tab}`);
  });
  panels.forEach((panel) => {
    panel.setAttribute("role", "tabpanel");
    panel.tabIndex = 0;
  });
  const selectTab = (selected, focus = false) => {
    tabs.forEach((tab) => {
      const active = tab === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(`demo-${tab.dataset.tab}`).hidden = !active;
    });
    if (focus) selected.focus();
  };
  const syncHash = () => {
    const selected = tabs.find((tab) => tab.hash === location.hash);
    if (selected) selectTab(selected);
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      selectTab(tab);
    });
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft")
        next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (event.key === " ") {
        event.preventDefault();
        selectTab(tab);
        return;
      }
      if (next !== undefined) {
        event.preventDefault();
        selectTab(tabs[next], true);
      }
    });
  });
  selectTab(tabs[0]);
  syncHash();
  window.addEventListener("hashchange", syncHash);
  document.documentElement.dataset.enhanced = "";
})();
