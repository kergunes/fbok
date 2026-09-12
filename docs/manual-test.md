# v0.1.9 manual test checklist

v0.1.9 does **not hide posts**. It highlights candidates and records why they matched.

## Setup

1. `git pull`
2. Open `brave://extensions` or `chrome://extensions`.
3. Reload fbok and verify version `0.1.9`.
4. Hard refresh Facebook.
5. Scroll until several normal posts and at least one feed ad are visible.

## Visual meaning

- **Red solid outline** = high-confidence ad signal.
- **Orange dashed outline** = medium-confidence unlabeled-ad shape candidate.
- No outline = no current match.

The bottom-left badge includes:

`fbok 0.1.9 · scanned N · hits N · H/M N/N · cache N · late/rescue N/N · retry N`

Useful counters:
- `cache`: ephemeral id → text labels retained.
- `late`: labels completed by a later text node.
- `rescue`: label text recovered from a removal mutation.
- `retry`: positively classified signals waiting to be attached to a feed card.

## High-confidence reasons

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

## Medium-confidence reasons

- `shape-dangling-label-no-permalink`
- `shape-outbound-no-permalink`

Medium candidates are intentionally **not considered verified ads** yet.

## False-positive checks

These must not receive a red high-confidence outline:

- normal post containing the word “Sponsored” in its body/comment;
- organic post sharing an external link;
- group/marketplace/reel cards;
- story tray;
- normal page post carrying `data-ad-rendering-role` attributes;
- sidebar ads (out of scope for feed v0.1).

## Report back

For the next pass, record:

- visible feed ads;
- red high-confidence hits;
- orange medium candidates;
- missed ads;
- organic posts receiving any outline;
- the full bottom-left badge text.

If a visible ad is still missed, run `__fbokDebug.diagnostics()` from the extension content-script execution context and capture the result.
