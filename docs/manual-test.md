# v0.1 manual test checklist

v0.1 deliberately **does not hide posts**. It only highlights high-confidence Sponsored / Sponsorlu candidates and shows the detection reason.

## Setup

1. Open `chrome://extensions` in Chrome or `brave://extensions` in Brave.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the repository folder.
4. Open or refresh `https://www.facebook.com/`.
5. Scroll the main feed long enough to load both normal and sponsored posts.

## Expected behavior

A detected sponsored post receives a red outline and an `fbok · <reason>` badge. The current reasons are:

- `accessibility-label`
- `title-label`
- `svg-accessibility`
- `visible-text`
- `visible-text-reconstructed`

DevTools also exposes `window.__fbokDebug`:

- `__fbokDebug.detectedCount()`
- `__fbokDebug.detectedPosts()`
- `__fbokDebug.rescan()`

## False-positive checks

These must **not** be highlighted:

- A normal post whose body text contains the word "Sponsored".
- A comment containing "Sponsored" or "Sponsorlu".
- A normal post linking to an article that contains either word.
- UI outside the main `role="feed"`.
- Posts where a detector cannot resolve a semantic feed article container.

## Coverage checks

Verify at least:

- English Facebook UI: `Sponsored`.
- Turkish Facebook UI: `Sponsorlu`.
- Infinite scroll after several batches of posts.
- Posts inserted after SPA navigation without a full refresh.
- Light and dark Facebook themes.
- No repeated badges or console errors after long scrolling.

When reporting a false positive or missed ad, capture the relevant post DOM with personal content removed/redacted and note the detector reason if one was shown.
