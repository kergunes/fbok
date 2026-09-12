# v0.1.12 manual test checklist

v0.1.12 is the first blocking pass. It hides only **high-confidence** feed ads. Medium-confidence shape candidates remain visible so false positives fail open.

## Setup

1. `git pull`
2. Open `brave://extensions` or `chrome://extensions`.
3. Reload fbok and verify version `0.1.12`.
4. Hard refresh Facebook.
5. Scroll until several normal posts and at least one feed ad are visible.

## Expected behavior

- **High-confidence ad** = disappears from the feed.
- **Orange dashed outline** = medium-confidence candidate; it must remain visible.
- No outline = no current match.
- Facebook must keep scrolling/loading normally.

The bottom-left badge includes:

`fbok 0.1.12 · scanned N · hits N · H/M N/N · cache N · late/rescue N/N · retry N`

A hidden high-confidence post still remains inspectable through:

`__fbokDebug.detectedPosts()`

## High-confidence reasons

Existing direct signals:
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

New v0.1.12 metadata signals:
- `metadata-rendered-sponsored-token`
- `metadata-rendered-ad-corroborated`

The short `Ad` token is deliberately not sufficient by itself. It is promoted only when the same feed card also has an outbound link and no Facebook permalink.

## Medium-confidence reasons

- `shape-dangling-label-no-permalink`
- `shape-outbound-no-permalink`

Medium candidates must never be hidden in this build.

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
