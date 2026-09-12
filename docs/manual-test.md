# v0.5.1 manual test checklist

v0.5.1 locks medium-confidence hiding on. The suggested-post filter is controlled from the fbok toolbar popup. The right-column Sponsored module is hidden separately. Nested label scans are coalesced per animation frame to reduce feed overhead.

## Setup

1. `git pull`
2. Open `brave://extensions` or `chrome://extensions`.
3. Reload fbok and verify version `0.5.1`.
4. Hard refresh Facebook.
5. Scroll until several normal posts and at least one feed ad are visible.

## Expected behavior

- **High-confidence ad** = disappears from the feed.
- Medium-confidence candidates are hidden; use the on-page `Reveal blocked #N` button to inspect one.
- No outline = no current match.
- Facebook must keep scrolling/loading normally.

The bottom-left badge includes:

`fbok 0.5.1 · scanned N · hits N · H/M N/N · blocked N · cache N · late/rescue N/N · retry N`

A hidden high-confidence post still remains inspectable through:

`__fbokDebug.detectedPosts()`

## High-confidence reasons

Existing direct signals:
- `react-feed-category-sponsored`
- `accessibility-sponsored-content`
- `accessibility-label`
- `title-label`
- `aria-labelledby-ref`
- `svg-sprite-ref`
- `ads-about-link`
- `visible-text`
- `own-text-label`
- `visible-text-reconstructed`
- `retry-resolved`

New v0.1.13 metadata signals:
- `metadata-rendered-sponsored-token`
- `metadata-rendered-ad-corroborated`
- `metadata-visual-sponsored`
- `metadata-visual-ad-corroborated`

v0.4.1 uses React feed-unit category metadata as the primary ad signal and bounded per-card hydration retries. Medium candidates are permanently CSS-hidden, while `blocked` remains deduplicated per DOM card. Use the page-world debug bridge to inspect blocked cards; records are captured at block time. Each connected blocked card gets a `Reveal blocked #N` button; revealing it restores and centers the card without changing the blocked counter or evidence snapshot. Suggested posts are identified by a visible header `Suggested for you`/`Senin için önerilen`, `Follow`/`Takip et`, or group `Join`/`Katıl` control when enabled from the popup.

From Facebook's normal DevTools Console:

```js
document.addEventListener("fbok-debug-response", (event) => console.log(event.detail), { once: true });
document.dispatchEvent(new CustomEvent("fbok-debug-request", { detail: { action: "blockedPosts" } }));
```

The short `Ad` token is deliberately not sufficient by itself. It is promoted only when the same feed card also has an outbound link and no Facebook permalink.

## Medium-confidence reasons

- `shape-dangling-label-no-permalink`
- `shape-outbound-no-permalink`

Medium candidates are hidden in this build by product decision; use Reveal for audit.

## Popup toggle

Click the fbok toolbar icon and change **Hide suggested posts**. The setting is persisted and applied to open Facebook tabs through extension storage.

## False-positive checks

These must remain visible:

- normal post containing “Sponsored”, “Sponsorlu”, or “Ad” in body/comment text;
- ordinary external-link share;
- group/marketplace/reel cards;
- story tray;
- normal page post carrying `data-ad-rendering-role` attributes;
- sidebar ads (out of scope for feed v0.1).

Pay particular attention to ordinary outbound-link posts: they may become medium candidates, but must not disappear unless a real header-level ad token is also found.

## Regression checks

- Initial Facebook load completes.
- Infinite scroll continues working.
- Opening/closing menus does not freeze the feed.
- A high-confidence post never downgrades back to medium and reappears after later DOM mutations.
- Medium candidates stay visible.
- Normal posts are not hidden.

## Report back

Record:

- visible feed ads before fbok classifies them;
- ads that disappear;
- orange medium candidates;
- missed ads;
- any organic post that disappears;
- whether infinite scroll remains healthy;
- full bottom-left badge text.

If a visible ad is still missed, run `__fbokDebug.diagnostics()` from the extension content-script execution context and capture the result.
