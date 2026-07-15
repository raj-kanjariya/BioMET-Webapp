# BioMET ’26 Progressive Web App — 13 July Schedule

This package includes:

- The complete programme from `Schedule_updated_13_07_2026_BP (1).xlsx`
- 152 programme entries across 4–7 August 2026
- Four-room parallel-session layouts
- Home-page countdown to 5 August 2026, 7:30 AM IST
- Browser-only one-click Install button
- Five-minute reminders for talks and major programme sessions
- Improved interface and PWA icons
- Offline page and cached programme data
- Responsive mobile, tablet and desktop layouts

## Installation

Deploy the website over HTTPS. Browser users will see an **Install** button in the header.

- Chrome/Android: the button opens the native installation prompt when available.
- iPhone/iPad: the button displays Safari’s Add to Home Screen steps.
- The Install button is automatically hidden in the installed standalone PWA.

## Five-minute reminders

Users must select **Enable 5-minute alerts** and allow notifications.

Parallel talks beginning at the same time are grouped into one reminder to avoid four simultaneous notifications.

Important technical limitation: browser-only local reminders work while the website or installed PWA is running. Exact notifications after the app has been fully closed require a web-push server and stored push subscriptions, which are not included in this static website package.

## Testing locally

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

Chrome treats localhost as a secure context for PWA testing. Production deployment must use HTTPS.

## Main editable files

- `assets/js/data.js` — schedule, updates, contacts, FAQ and conference settings
- `assets/js/app.js` — countdown, reminders, install flow and page behaviour
- `assets/css/style.css` — responsive visual design
- `sw.js` — offline caching and notification click behaviour
- `manifest.json` — installation metadata


## Automatic notification update

- There is no notification enable/disable button.
- On the user's first interaction, the browser automatically asks for notification permission.
- Once permission is granted, five-minute talk reminders remain enabled.
- A one-time welcome notification is shown after permission is granted.
- Browser security does not allow a website to bypass or force notification permission.
- The home countdown now ends at 5 August 2026, 12:00 AM IST and disappears after reaching zero.
