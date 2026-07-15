const DATA = window.BIOMET_DATA;
const PAGE = document.body.dataset.page || "home";

const UPDATE_STYLE = {
  announcement: { icon: "fa-solid fa-bullhorn", colour: "#0d3b66" },
  schedule: { icon: "fa-solid fa-calendar-check", colour: "#7c3aed" },
  venue: { icon: "fa-solid fa-location-dot", colour: "#00b4d8" },
  urgent: { icon: "fa-solid fa-triangle-exclamation", colour: "#ef476f" },
  transport: { icon: "fa-solid fa-bus", colour: "#d18b00" },
  general: { icon: "fa-solid fa-circle-info", colour: "#3f7d00" }
};

const TRACK_PALETTE = [
  "#0d3b66", "#7c3aed", "#00a6c7", "#d18b00", "#3f7d00",
  "#ef476f", "#2563eb", "#0f766e", "#9a3412", "#6d28d9",
  "#047857", "#b45309", "#be123c", "#0369a1", "#4d7c0f"
];

const ALERT_STORAGE_KEY = "biomet-talk-alerts-enabled";
const WELCOME_NOTIFICATION_KEY = `biomet-welcome-notification-${DATA.conference.scheduleVersion || "latest"}`;
const ALERT_SENT_KEY = `biomet-alerts-sent-${DATA.conference.scheduleVersion || "latest"}`;

let activeDay = "";
let selectedTrack = "all";
let scheduleQuery = "";
let mapInstance = null;
let deferredInstallPrompt = null;
let alertWatcher = null;

document.addEventListener("DOMContentLoaded", () => {
  populateShared();
  setActiveNav();
  initDrawer();
  initTheme();
  initInstallButton();
  initTalkNotifications();
  initPWA();

  if (PAGE === "home") initHome();
  if (PAGE === "schedule") initSchedule();
  if (PAGE === "venue") initVenue();
  if (PAGE === "contact") initContact();
});

function populateShared() {
  document.querySelectorAll("[data-conference-name]").forEach((el) => {
    el.textContent = DATA.conference.fullName;
  });
  document.querySelectorAll("[data-conference-dates]").forEach((el) => {
    el.textContent = DATA.conference.dates;
  });
  document.querySelectorAll("[data-programme-dates]").forEach((el) => {
    el.textContent = DATA.conference.programmeDates || DATA.conference.dates;
  });
  document.querySelectorAll("[data-conference-location]").forEach((el) => {
    el.textContent = DATA.conference.location;
  });
  document.querySelectorAll("[data-event-status]").forEach((el) => {
    el.textContent = DATA.conference.eventStatus;
  });
  document.querySelectorAll("[data-last-updated]").forEach((el) => {
    el.textContent = DATA.conference.lastUpdated;
  });
  document.querySelectorAll("[data-current-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

function setActiveNav() {
  document.querySelectorAll(`[data-nav="${PAGE}"]`).forEach((el) => {
    el.classList.add("active");
    el.setAttribute("aria-current", "page");
  });
}

function initDrawer() {
  const drawer = document.getElementById("drawer");
  const openButton = document.getElementById("menuButton");
  const closeButton = document.getElementById("drawerClose");
  const backdrop = document.getElementById("drawerBackdrop");
  if (!drawer || !openButton) return;

  const show = () => {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    openButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("no-scroll");
  };

  const hide = () => {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    openButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("no-scroll");
  };

  openButton.addEventListener("click", show);
  closeButton?.addEventListener("click", hide);
  backdrop?.addEventListener("click", hide);
  drawer.querySelectorAll("a").forEach((link) => link.addEventListener("click", hide));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });
}

function initTheme() {
  const saved = localStorage.getItem("biomet-theme");
  applyTheme(saved || "light");

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem("biomet-theme", theme);
      applyTheme(theme);
    });
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-toggle] i").forEach((icon) => {
    icon.className = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
  });

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", theme === "dark" ? "#06233f" : "#f8faff");
  if (mapInstance) setTimeout(() => mapInstance.invalidateSize(), 80);
}

function initHome() {
  renderUpdates();
  setText("updateCount", DATA.updates.length);
  setText("scheduleCount", DATA.schedule.length);
  setText("conferenceDayCount", new Set(DATA.schedule.map((item) => item.day)).size);
  initCountdown();

  document.getElementById("refreshUpdates")?.addEventListener("click", () => {
    const icon = document.querySelector("#refreshUpdates i");
    icon?.classList.add("fa-spin");
    setTimeout(() => {
      icon?.classList.remove("fa-spin");
      renderUpdates();
      toast("Live updates refreshed");
    }, 500);
  });
}

function initCountdown() {
  const panel = document.getElementById("conferenceCountdown");
  if (!panel || !DATA.conference.startAt) return;

  setText("countdownStartLabel", DATA.conference.startLabel || "BioMET ’26");
  const startTime = new Date(DATA.conference.startAt).getTime();

  const tick = () => {
    const remaining = startTime - Date.now();
    const grid = document.getElementById("countdownGrid");

    if (!Number.isFinite(startTime)) {
      panel.hidden = true;
      return;
    }

    if (remaining <= 0) {
      panel.hidden = true;
      return;
    }

    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    setText("countdownDays", String(days).padStart(2, "0"));
    setText("countdownHours", String(hours).padStart(2, "0"));
    setText("countdownMinutes", String(minutes).padStart(2, "0"));
    setText("countdownSeconds", String(seconds).padStart(2, "0"));
    window.setTimeout(tick, 1000);
  };

  tick();
}

function renderUpdates() {
  const target = document.getElementById("updatesFeed");
  if (!target) return;

  target.innerHTML = DATA.updates.map((update) => {
    const style = UPDATE_STYLE[update.type] || UPDATE_STYLE.general;
    return `
      <article class="update-card" style="--accent:${style.colour}">
        <span class="update-icon" aria-hidden="true"><i class="${style.icon}"></i></span>
        <div>
          <div class="update-head">
            <h3>${esc(update.title)}</h3>
            <time>${esc(update.time)}</time>
          </div>
          <p>${esc(update.message)}</p>
          <span class="update-label">${esc(update.label)}</span>
        </div>
      </article>
    `;
  }).join("");
}

function initSchedule() {
  const days = [...new Set(DATA.schedule.map((item) => item.day))];
  const tracks = [...new Set(DATA.schedule.map((item) => item.track))]
    .sort((a, b) => a.localeCompare(b));

  activeDay = days[0] || "";

  const tabs = document.getElementById("dayTabs");
  if (tabs) {
    tabs.innerHTML = days.map((day, index) => {
      const date = DATA.schedule.find((item) => item.day === day)?.date || "";
      return `
        <button class="day-tab ${index === 0 ? "active" : ""}" type="button"
          data-day="${esc(day)}" aria-selected="${index === 0}">
          <span>${esc(day)}</span>
          <small>${esc(date)}</small>
        </button>
      `;
    }).join("");

    tabs.addEventListener("click", (event) => {
      const button = event.target.closest(".day-tab");
      if (!button) return;
      activeDay = button.dataset.day;
      tabs.querySelectorAll(".day-tab").forEach((tab) => {
        const isActive = tab === button;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
      });
      renderSchedule();
    });
  }

  const filter = document.getElementById("trackFilter");
  if (filter) {
    filter.innerHTML = `
      <option value="all">All sessions and themes</option>
      ${tracks.map((track) => `<option value="${esc(track)}">${esc(track)}</option>`).join("")}
    `;
    filter.addEventListener("change", (event) => {
      selectedTrack = event.target.value;
      renderSchedule();
    });
  }

  document.getElementById("scheduleSearch")?.addEventListener("input", (event) => {
    scheduleQuery = event.target.value.trim().toLowerCase();
    renderSchedule();
  });

  renderSchedule();
}

function renderSchedule() {
  const list = document.getElementById("scheduleList");
  const empty = document.getElementById("scheduleEmpty");
  const summary = document.getElementById("scheduleResultCount");
  if (!list || !empty) return;

  const sessions = DATA.schedule
    .filter((item) => item.day === activeDay)
    .filter((item) => selectedTrack === "all" || item.track === selectedTrack)
    .filter((item) => {
      if (!scheduleQuery) return true;
      return [
        item.title, item.description, item.speaker, item.room,
        item.track, item.notes, item.date, item.start, item.end
      ].join(" ").toLowerCase().includes(scheduleQuery);
    })
    .sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999) || a.id - b.id);

  if (summary) {
    const dayDate = DATA.schedule.find((item) => item.day === activeDay)?.date || "";
    summary.textContent = `${sessions.length} programme item${sessions.length === 1 ? "" : "s"} · ${dayDate}`;
  }

  const groups = [];
  for (const session of sessions) {
    const key = `${session.start}|${session.end}`;
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, start: session.start, end: session.end, sort: session.sort, sessions: [] };
      groups.push(group);
    }
    group.sessions.push(session);
  }

  list.innerHTML = groups.map((group) => {
    const cards = group.sessions.map((session) => {
      const colour = colourForTrack(session.track);
      const speaker = session.speaker
        ? `<div class="session-detail"><i class="fa-solid fa-user-tie"></i><span>${esc(session.speaker)}</span></div>`
        : "";
      const room = session.room
        ? `<div class="session-detail"><i class="fa-solid fa-location-dot"></i><span>${esc(session.room)}</span></div>`
        : "";
      const notes = session.notes
        ? `<div class="session-note">${esc(session.notes)}</div>`
        : "";
      const alert = session.notify
        ? `<span class="talk-alert-chip"><i class="fa-regular fa-bell"></i>5-min alert</span>`
        : "";

      return `
        <article class="programme-card" style="--accent:${colour}">
          <div class="programme-card-top">
            <span class="track-pill">${esc(session.track)}</span>
            <span class="programme-date">${esc(session.date)}</span>
          </div>
          <div class="programme-title-row">
            <h3>${esc(session.title)}</h3>
            ${alert}
          </div>
          ${session.description ? `<p>${esc(session.description)}</p>` : ""}
          <div class="session-details">
            ${speaker}
            ${room}
          </div>
          ${notes}
        </article>
      `;
    }).join("");

    return `
      <section class="time-block">
        <div class="time-block-heading">
          <span class="time-icon"><i class="fa-regular fa-clock"></i></span>
          <div>
            <strong>${esc(group.start)}</strong>
            <span>${esc(group.end)}</span>
          </div>
          ${group.sessions.length > 1 ? `<small>${group.sessions.length} parallel sessions</small>` : ""}
        </div>
        <div class="parallel-grid ${group.sessions.length === 1 ? "single" : ""}">
          ${cards}
        </div>
      </section>
    `;
  }).join("");

  list.hidden = sessions.length === 0;
  empty.hidden = sessions.length > 0;
}

function colourForTrack(track) {
  let hash = 0;
  for (let i = 0; i < track.length; i += 1) {
    hash = ((hash << 5) - hash) + track.charCodeAt(i);
    hash |= 0;
  }
  return TRACK_PALETTE[Math.abs(hash) % TRACK_PALETTE.length];
}

function initVenue() {
  const venue = DATA.venue;
  setText("venueName", venue.name);
  setText("venueAddress", venue.address);
  setText("travelInfo", venue.travel);
  setText("accessibilityInfo", venue.accessibility);

  optionalLink(document.getElementById("directionsButton"), venue.directionsUrl,
    "Directions will be enabled after venue confirmation");
  optionalLink(document.getElementById("venueWebsiteButton"), venue.websiteUrl,
    "Venue website will be enabled after confirmation");

  const roomGrid = document.getElementById("roomGrid");
  if (roomGrid) {
    roomGrid.innerHTML = venue.rooms.map((room) => `
      <article class="room-card">
        <i class="${room.icon}"></i>
        <strong>${esc(room.name)}</strong>
        <span>${esc(room.detail)}</span>
      </article>
    `).join("");
  }

  const hasCoordinates =
    Number.isFinite(venue.latitude) &&
    Number.isFinite(venue.longitude);

  const placeholder = document.getElementById("mapPlaceholder");
  if (!hasCoordinates || typeof L === "undefined") {
    if (placeholder) placeholder.hidden = false;
    return;
  }

  if (placeholder) placeholder.hidden = true;
  mapInstance = L.map("venueMap", { scrollWheelZoom: false })
    .setView([venue.latitude, venue.longitude], venue.zoom || 16);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(mapInstance);

  L.marker([venue.latitude, venue.longitude])
    .addTo(mapInstance)
    .bindPopup(`<strong>${esc(venue.name)}</strong><br>${esc(venue.address)}`)
    .openPopup();

  setTimeout(() => mapInstance.invalidateSize(), 200);
}

function initContact() {
  const primary = DATA.primaryContact || {};
  const primaryEmail = primary.email || "biomet2026@gmail.com";

  setText("primaryEmailHero", primaryEmail);

  const primaryEmailLink = document.getElementById("primaryEmailLink");
  if (primaryEmailLink) {
    primaryEmailLink.textContent = primaryEmail;
    primaryEmailLink.href = `mailto:${encodeURIComponent(primaryEmail)}`;
  }

  const linkedin = document.getElementById("linkedinLink");
  const instagram = document.getElementById("instagramLink");
  if (linkedin && primary.linkedin) linkedin.href = primary.linkedin;
  if (instagram && primary.instagram) instagram.href = primary.instagram;

  const groupsTarget = document.getElementById("contactGroups");
  const categories = DATA.contactCategories || {};

  if (groupsTarget) {
    groupsTarget.innerHTML = Object.entries(categories).map(([category, meta]) => {
      const people = DATA.contacts.filter((contact) => contact.category === category);
      if (!people.length) return "";

      const personCards = people.map((contact) => {
        const phoneHref = `tel:+91${contact.phone.replace(/\D/g, "")}`;
        return `
          <article class="contact-person">
            <div class="contact-person-name">
              <span class="person-avatar"><i class="fa-solid fa-user"></i></span>
              <strong>${esc(contact.name)}</strong>
            </div>
            <a class="contact-person-link" href="${phoneHref}">
              <i class="fa-solid fa-phone"></i>
              <span>+91 ${esc(contact.phone)}</span>
            </a>
            <a class="contact-person-link" href="mailto:${encodeURIComponent(contact.email)}">
              <i class="fa-regular fa-envelope"></i>
              <span>${esc(contact.email)}</span>
            </a>
          </article>
        `;
      }).join("");

      return `
        <section class="contact-group" style="--accent:${esc(meta.colour)}">
          <div class="contact-group-head">
            <span class="contact-group-icon"><i class="${esc(meta.icon)}"></i></span>
            <div>
              <h3>${esc(category)}</h3>
              <p>${esc(meta.description)}</p>
            </div>
          </div>
          <div class="contact-person-list">${personCards}</div>
        </section>
      `;
    }).join("");
  }

  const faq = document.getElementById("faqList");
  if (faq) {
    faq.innerHTML = DATA.faq.map((item) => `
      <details>
        <summary>${esc(item.question)}</summary>
        <p>${esc(item.answer)}</p>
      </details>
    `).join("");
  }
}

/* ----------------------------------------------------------------------
   Install button
   ---------------------------------------------------------------------- */
function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    navigator.standalone === true;
}

function initInstallButton() {
  const tools = document.querySelector(".header-tools");
  if (!tools || isStandaloneMode()) return;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "installAppButton";
  button.className = "install-app-button";
  button.setAttribute("aria-label", "Install BioMET on this device");
  button.innerHTML = '<i class="fa-solid fa-download"></i><span>Install</span>';
  tools.insertBefore(button, tools.firstChild);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    button.classList.add("install-ready");
    button.title = "Install BioMET ’26";
  });

  button.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast("Installing BioMET ’26…");
      }
      deferredInstallPrompt = null;
      button.classList.remove("install-ready");
      return;
    }
    showInstallGuide();
  });

  window.addEventListener("appinstalled", () => {
    button.remove();
    toast("BioMET ’26 has been installed.");
  });

  window.matchMedia("(display-mode: standalone)").addEventListener?.("change", (event) => {
    if (event.matches) button.remove();
  });
}

function showInstallGuide() {
  const existing = document.getElementById("installGuideModal");
  if (existing) {
    existing.classList.add("open");
    return;
  }

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isChrome = /Chrome|CriOS/i.test(ua) && !/Edg|OPR/i.test(ua);

  let steps = `
    <li>Open your browser menu.</li>
    <li>Choose <strong>Install app</strong>, <strong>Install page as app</strong> or <strong>Add to Home screen</strong>.</li>
    <li>Confirm the installation.</li>
  `;

  if (isIOS) {
    steps = `
      <li>Open this page in <strong>Safari</strong>.</li>
      <li>Tap the <strong>Share</strong> button.</li>
      <li>Select <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
    `;
  } else if (isAndroid && isChrome) {
    steps = `
      <li>Tap the Chrome <strong>⋮</strong> menu.</li>
      <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
      <li>Confirm.</li>
    `;
  } else if (isChrome) {
    steps = `
      <li>Look for the Install icon in the address bar.</li>
      <li>Or open <strong>⋮ → Cast, save and share → Install page as app</strong>.</li>
      <li>Select <strong>Install</strong>.</li>
    `;
  }

  const modal = document.createElement("div");
  modal.className = "install-modal open";
  modal.id = "installGuideModal";
  modal.innerHTML = `
    <button class="install-modal-backdrop" type="button" data-close-install aria-label="Close installation instructions"></button>
    <section class="install-modal-card" role="dialog" aria-modal="true" aria-labelledby="installModalTitle">
      <button class="install-modal-close" type="button" data-close-install aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      <span class="install-modal-icon"><i class="fa-solid fa-mobile-screen-button"></i></span>
      <h2 id="installModalTitle">Install BioMET ’26</h2>
      <p>Your browser has not exposed the direct installation prompt. Use these steps:</p>
      <ol>${steps}</ol>
      <button class="button button-primary button-block" type="button" data-close-install>Got it</button>
    </section>
  `;
  document.body.appendChild(modal);

  const close = () => modal.classList.remove("open");
  modal.querySelectorAll("[data-close-install]").forEach((el) => el.addEventListener("click", close));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  }, { once: true });
}

/* ----------------------------------------------------------------------
   Five-minute talk notifications
   ---------------------------------------------------------------------- */
function initTalkNotifications() {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    activateTalkNotifications();
    return;
  }

  if (Notification.permission === "denied") {
    localStorage.setItem(ALERT_STORAGE_KEY, "false");
    return;
  }

  // Browsers require a real user gesture before showing the permission prompt.
  // The first tap, click or keyboard interaction triggers it automatically.
  const requestOnFirstInteraction = async () => {
    removePermissionListeners();

    let permission = Notification.permission;
    if (permission === "default") {
      try {
        permission = await Notification.requestPermission();
      } catch (error) {
        console.warn("Notification permission request failed:", error);
        return;
      }
    }

    if (permission === "granted") {
      activateTalkNotifications();
      toast("Talk reminders are active.");
    } else {
      localStorage.setItem(ALERT_STORAGE_KEY, "false");
      toast("Notifications are blocked. Enable them in your browser settings to receive reminders.");
    }
  };

  const removePermissionListeners = () => {
    document.removeEventListener("pointerdown", requestOnFirstInteraction, true);
    document.removeEventListener("keydown", requestOnFirstInteraction, true);
    document.removeEventListener("touchstart", requestOnFirstInteraction, true);
  };

  document.addEventListener("pointerdown", requestOnFirstInteraction, { once: true, capture: true });
  document.addEventListener("keydown", requestOnFirstInteraction, { once: true, capture: true });
  document.addEventListener("touchstart", requestOnFirstInteraction, { once: true, capture: true });
}

function activateTalkNotifications() {
  if (Notification.permission !== "granted") return;

  localStorage.setItem(ALERT_STORAGE_KEY, "true");
  showWelcomeNotificationOnce();
  startAlertWatcherIfEnabled();
}

async function showWelcomeNotificationOnce() {
  if (localStorage.getItem(WELCOME_NOTIFICATION_KEY) === "true") return;

  const title = "Welcome to BioMET ’26";
  const options = {
    body: "Stay updated with upcoming talks, programme changes, venues and important conference information.",
    icon: "./assets/icons/pwa-192.png",
    badge: "./assets/icons/favicon-64.png",
    tag: "biomet-welcome",
    renotify: false,
    data: { url: "./index.html" }
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 1500))
      ]);

      if (registration) {
        await registration.showNotification(title, options);
        localStorage.setItem(WELCOME_NOTIFICATION_KEY, "true");
        return;
      }
    }

    new Notification(title, options);
    localStorage.setItem(WELCOME_NOTIFICATION_KEY, "true");
  } catch (error) {
    console.warn("Welcome notification could not be shown:", error);
  }
}

function startAlertWatcherIfEnabled() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  localStorage.setItem(ALERT_STORAGE_KEY, "true");
  stopAlertWatcher();
  checkTalkAlerts();
  alertWatcher = window.setInterval(checkTalkAlerts, 20000);
}

function stopAlertWatcher() {
  if (alertWatcher) {
    clearInterval(alertWatcher);
    alertWatcher = null;
  }
}

function buildAlertGroups() {
  const groups = new Map();

  DATA.schedule
    .filter((event) => event.notify && event.startAt)
    .forEach((event) => {
      if (!groups.has(event.startAt)) groups.set(event.startAt, []);
      groups.get(event.startAt).push(event);
    });

  return [...groups.entries()]
    .map(([startAt, events]) => ({ startAt, events }))
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}

async function checkTalkAlerts() {
  if (Notification.permission !== "granted") return;

  const now = Date.now();
  const leadMs = (DATA.conference.alertLeadMinutes || 5) * 60000;
  const sent = readSentAlerts();

  for (const group of buildAlertGroups()) {
    const start = new Date(group.startAt).getTime();
    const remaining = start - now;
    const key = group.startAt;

    // A 75-second grace range avoids missed reminders when a background timer is throttled.
    if (remaining > 0 && remaining <= leadMs && !sent[key]) {
      await showTalkNotification(group);
      sent[key] = Date.now();
      localStorage.setItem(ALERT_SENT_KEY, JSON.stringify(sent));
    }
  }
}

function readSentAlerts() {
  try {
    return JSON.parse(localStorage.getItem(ALERT_SENT_KEY) || "{}");
  } catch {
    return {};
  }
}

async function showTalkNotification(group) {
  const events = group.events;
  const time = events[0]?.start || "";
  const uniqueTracks = [...new Set(events.map((event) => event.track))];
  const uniqueRooms = [...new Set(events.map((event) => event.room).filter(Boolean))];

  let title;
  let body;

  if (events.length === 1) {
    const event = events[0];
    title = `${event.title} starts in 5 minutes`;
    const speaker = event.speaker ? compactSpeaker(event.speaker) : event.track;
    body = [speaker, event.room].filter(Boolean).join(" · ");
  } else {
    title = `${events.length} parallel talks start in 5 minutes`;
    const trackText = uniqueTracks.slice(0, 3).join(", ");
    const more = uniqueTracks.length > 3 ? ` +${uniqueTracks.length - 3} more` : "";
    body = `${time} · ${trackText}${more}`;
    if (uniqueRooms.length === 1) body += ` · ${uniqueRooms[0]}`;
  }

  const options = {
    body,
    icon: "./assets/icons/pwa-192.png",
    badge: "./assets/icons/favicon-64.png",
    tag: `biomet-${group.startAt}`,
    renotify: false,
    timestamp: new Date(group.startAt).getTime(),
    data: { url: "./schedule.html" }
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 1200))
      ]);
      if (registration) {
        await registration.showNotification(title, options);
        return;
      }
    }
  } catch (error) {
    console.warn("Service-worker notification unavailable:", error);
  }

  new Notification(title, options);
}

function compactSpeaker(value) {
  return String(value).split(" — ")[0].trim();
}

/* ----------------------------------------------------------------------
   Service worker and connectivity
   ---------------------------------------------------------------------- */
function initPWA() {
  if (!("serviceWorker" in navigator)) return;

  if (location.protocol !== "https:" &&
      location.hostname !== "localhost" &&
      location.hostname !== "127.0.0.1") {
    console.info("BioMET PWA: service worker registration requires HTTPS.");
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      registration.update().catch(() => {});

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            toast("A new BioMET version is available. Refresh to update.");
          }
        });
      });
    } catch (error) {
      console.warn("BioMET PWA service worker registration failed:", error);
    }
  });

  window.addEventListener("offline", () => {
    toast("You are offline. Previously loaded conference information is still available.");
  });

  window.addEventListener("online", () => {
    toast("You are back online. Live conference information can now refresh.");
  });
}

function optionalLink(element, url, message) {
  if (!element) return;
  if (url) {
    element.href = url;
    return;
  }
  element.href = "#";
  element.setAttribute("aria-disabled", "true");
  element.addEventListener("click", (event) => {
    event.preventDefault();
    toast(message);
  });
}

function toast(message) {
  const element = document.getElementById("toast");
  const text = document.getElementById("toastText");
  if (!element || !text) return;

  text.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 3000);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
