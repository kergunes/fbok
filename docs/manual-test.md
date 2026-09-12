# v0.1 manual test checklist

v0.1 deliberately **does not hide posts**. It only highlights high-confidence Sponsored / Sponsorlu candidates and shows the detection reason.

## Setup

1. Open `chrome://extensions` in Chrome or `brave://extensions` in Brave.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the repository folder.
4. Open or refresh `https://www.facebook.com/`.
5. Scroll the main feed long enough to load both normal and sponsored posts.

## Expected behavior

A detected sponsored post receives a red outline and an `fbok · <reason>` badge. A fixed `fbok 0.1.6 · scanned N · hits N` badge should also appear at the bottom-left when the content script is running. Current reasons include:

- `svg-sprite-ref`
- `accessibility-label`
- `title-label`
- `aria-labelledby-ref`
- `visible-text`
- `visible-text-reconstructed`
- `visible-short-ad-label`
- `ads-about-link`

Each inspected feed post also receives `data-fbok-seen="true"`. This separates "the detector scanned it and did not match" from "the scanner never reached it."

The content script exposes `window.__fbokDebug` in the extension's isolated DevTools execution context:

- `__fbokDebug.scannedCount()`
- `__fbokDebug.detectedCount()`
- `__fbokDebug.detectedPosts()`
- `__fbokDebug.rescan()`

## False-positive checks

These must **not** be highlighted:

- A normal post whose body text contains the word "Sponsored".
- A comment containing "Sponsored" or "Sponsorlu".
- A normal post linking to an article that contains either word.
- A normal post whose timestamp is rendered through an SVG sprite.
- UI outside the main feed.
- Nested list items inside a post.
- Posts where a signal cannot be resolved to a top-level feed container.\n- `data-pagelet=\"FeedUnit…\"` fallback'iyle yakalanan feed postları.

## Coverage checks

Verify at least:

- English Facebook UI: `Sponsored`.
- English Facebook UI variant: short `Ad` label directly under/near the advertiser name.
- Closed-shadow-root `Ad` label wrapped by a Facebook `/ads/about/` link.
- Turkish Facebook UI: `Sponsorlu`.
- Chromium SVG-sprite sponsored labels.
- Obfuscated / character-split sponsored labels.
- Infinite scroll after several batches of posts.
- Posts inserted after SPA navigation without a full refresh.
- Light and dark Facebook themes.
- No repeated badges or console errors after long scrolling.

When reporting a false positive or missed ad, capture the relevant post DOM with personal content removed/redacted and note the detector reason if one was shown.
