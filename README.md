# BioMET ’26 Progressive Web App

This package converts the four-page BioMET live-information website into an installable Progressive Web App (PWA) while preserving the existing responsive website design.

## Pages

- `index.html` — Live Updates
- `schedule.html` — Conference Schedule
- `venue.html` — Venue Map
- `contact.html` — Contact Directory and FAQs
- `offline.html` — Offline fallback page

## PWA files

- `manifest.json` — app name, icon, display mode and shortcuts
- `sw.js` — service worker for installation and offline caching
- `assets/icons/pwa-192.png` — standard install icon
- `assets/icons/pwa-512.png` — large install icon
- `assets/icons/pwa-maskable-512.png` — Android maskable icon
- `assets/icons/apple-touch-icon.png` — iPhone/iPad home-screen icon

## How the PWA behaves

- Chrome and compatible browsers can show an Install icon in the address bar.
- Android Chrome can show **Install app** or **Add to Home screen**.
- iPhone Safari can add the website through **Share → Add to Home Screen**.
- Installed pages open in a standalone window without the normal browser interface.
- The main pages, schedule, contacts, styling and conference data remain available after they have been cached.
- HTML pages and `assets/js/data.js` use a network-first strategy so current live information is preferred whenever internet access is available.
- OpenStreetMap map tiles still require internet access unless they were already loaded by the browser.

## Required deployment condition

The PWA must be hosted over **HTTPS**. Opening the HTML files directly using `file://` will not register the service worker and will not make the website installable.

For local testing, `localhost` is accepted:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Installation instructions

### Google Chrome on desktop

1. Open the website.
2. Look for the Install icon in the address bar.
3. Click it and select **Install**.

When the icon is not visible:

1. Click the three-dot menu.
2. Choose **Cast, save and share** or **Save and share**.
3. Select **Install page as app** or **Create shortcut**.
4. When available, enable **Open as window** and confirm.

### Android using Chrome

1. Open the website.
2. Tap the three-dot menu.
3. Tap **Add to Home screen** or **Install app**.
4. Confirm.

### iPhone using Safari

1. Open the website in Safari.
2. Tap the Share button.
3. Select **Add to Home Screen**.
4. Tap **Add**.

## Updating the deployed PWA

When changing website files, update the version near the top of `sw.js`:

```js
const VERSION = "biomet-pwa-1.0.1";
```

Changing this value creates a new cache and removes the previous cache after activation.
