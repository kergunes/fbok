# fbok

Facebook feed cleaner for Chromium browsers.

fbok is a Manifest V3 extension that removes unwanted Facebook feed content locally in the browser. Its primary target is Sponsored / Sponsorlu / Ad content, with optional filtering for suggested posts and separate handling for the right-rail Sponsored module.

Current version: **v0.5.1**

## What it does

- hides high-confidence feed ads;
- hides medium-confidence feed candidates by current product policy;
- optionally hides suggested posts;
- hides the right-column Sponsored module;
- keeps all filtering local to the browser;
- provides debug counters, blocked-post snapshots, and reveal controls for manual auditing.

fbok is intentionally Facebook-specific. It does not act as a generic network ad blocker; it classifies Facebook's rendered feed cards and applies local CSS filtering.

## Detection model

The detector uses several independent signals, ordered from stronger platform metadata to more fragile DOM fallbacks:

1. **React feed metadata**
   - bounded inspection of Facebook feed-unit React props;
   - `category: SPONSORED` is treated as a primary high-confidence signal.

2. **Accessibility and structured DOM**
   - `aria-label`, `aria-labelledby`, `title`;
   - transient label cache and reverse-referrer resolution;
   - SVG `<use>` sprite references;
   - Ads About links.

3. **Rendered metadata**
   - header text in the bounded metadata region;
   - character-split / CSS-order reconstruction;
   - direct mixed-wrapper text-node geometry.

4. **Shape fallback**
   - outbound-link + no-permalink;
   - dangling label reference + no-permalink.

Short `Ad` labels are deliberately stricter than `Sponsored` / `Sponsorlu`: they require independent corroboration before becoming a high-confidence ad signal.

## Filtering policy

Detection and filtering are related but not identical.

- **high confidence** → hidden;
- **medium confidence** → hidden by current product policy;
- **suggested content** → hidden only when the popup toggle is enabled;
- **revealed debug card** → temporarily shown for manual inspection.

Medium hiding is an intentional UX decision, not a claim that every medium candidate is certainly an advertisement. In live testing, this bucket also catches some suggested/recommended feed content.

## Performance and lifecycle constraints

Facebook is a continuously mutating React application, so fbok avoids destructive DOM manipulation and unbounded rescans.

Key constraints:

- no `remove()` / `replaceChildren()` on Facebook feed cards;
- hiding is CSS-based;
- no document-wide polling loop;
- MutationObserver work is batched with `requestAnimationFrame`;
- nested mutation scan roots are coalesced;
- unresolved positive signals use a bounded retry queue;
- hydration retries are limited per card;
- React metadata inspection is depth- and candidate-bounded.

These constraints exist specifically to avoid regressions such as stalled or infinitely loading feeds.

## Settings

Click the fbok toolbar icon to open the popup.

Current user setting:

- **Hide suggested posts** — persisted with `chrome.storage.sync`.

Sponsored feed filtering and medium-candidate filtering are currently always enabled.

## Debugging

Debug mode is currently enabled in the content script.

The bottom-left badge shows detector activity, including scanned cards, high/medium hits, blocked count, label-cache activity, and retry state.

Blocked cards are snapshotted at decision time. Connected blocked cards can be temporarily restored using the on-page **Reveal blocked #N** controls.

From the normal Facebook DevTools console, blocked-card details can be requested through the read-only event bridge:

```js
document.addEventListener(
  "fbok-debug-response",
  (event) => console.log(event.detail),
  { once: true },
);

document.dispatchEvent(
  new CustomEvent("fbok-debug-request", {
    detail: { action: "blockedPosts" },
  }),
);
```

Use `action: "diagnostics"` for detector counters and current settings.

## Repository layout

```text
.
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── src/
│   ├── content.js
│   └── debug.css
├── scripts/
│   └── validate.mjs
├── docs/
│   ├── architecture.md
│   ├── manual-test.md
│   └── research-notes.md
├── CHANGELOG.md
├── TODO.md
└── .github/workflows/validate.yml
```

The runtime is still intentionally small: one content script plus popup assets. `src/content.js` currently contains the detector, lifecycle queues, right-rail filtering, settings integration, and debug reporting. See `docs/architecture.md` for the current boundaries and future cleanup direction.

## Local installation

1. Clone or download the repository.
2. Open `brave://extensions` or `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the repository directory.
5. Hard-refresh Facebook after reloading the extension.

## Validation

Requires Node.js 20+.

```bash
npm test
```

Current CI validates:

- Manifest V3 shape and Facebook-only host scope;
- required popup/storage declarations;
- referenced extension files;
- JavaScript syntax for the content script and popup.

CI does **not** currently prove detector accuracy. Live false-positive / false-negative testing is still required.

## Current priorities

1. broaden real-feed validation in Chrome/Brave;
2. measure false positives on wanted organic posts;
3. add fixture/unit coverage for classifier logic;
4. separate debug and release behavior;
5. modularize the content script only after behavior is locked;
6. prepare Chrome Web Store packaging and release workflow.

See `TODO.md` for the active work list and `CHANGELOG.md` for milestone history.

## Privacy

fbok processes Facebook page content locally in the browser only for content filtering.

- zero telemetry;
- zero developer-operated data collection;
- zero external requests;
- Facebook-only host access;
- no remote backend;
- no sale or transfer of user data.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.
