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

let activeDay = "";
let selectedTrack = "all";
let scheduleQuery = "";
let mapInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  populateShared();
  setActiveNav();
  initDrawer();
  initTheme();
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

      return `
        <article class="programme-card" style="--accent:${colour}">
          <div class="programme-card-top">
            <span class="track-pill">${esc(session.track)}</span>
            <span class="programme-date">${esc(session.date)}</span>
          </div>
          <h3>${esc(session.title)}</h3>
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

  optionalLink(
    document.getElementById("directionsButton"),
    venue.directionsUrl,
    "Directions will be enabled after venue confirmation"
  );
  optionalLink(
    document.getElementById("venueWebsiteButton"),
    venue.websiteUrl,
    "Venue website will be enabled after confirmation"
  );

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
function initPWA() {
  if (!("serviceWorker" in navigator)) return;

  // Service workers require HTTPS in production. localhost is also accepted for testing.
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
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
            toast("A new BioMET website version is available. Reopen or refresh to update.");
          }
        });
      });
    } catch (error) {
      console.warn("BioMET PWA service worker registration failed:", error);
    }
  });

  window.addEventListener("appinstalled", () => {
    toast("BioMET ’26 has been installed.");
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
  toast.timer = setTimeout(() => element.classList.remove("show"), 2500);
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
