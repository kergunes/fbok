# v0.5.1 manual test checklist

This checklist validates the current live behavior of fbok. Automated CI currently checks repository/manifest integrity and JavaScript syntax; it does not replace real Facebook feed testing.

## Setup

1. `git pull`
2. Open `brave://extensions` or `chrome://extensions`.
3. Reload fbok and verify version `0.5.1`.
4. Hard-refresh Facebook.
5. Keep the normal Facebook feed open and scroll through a meaningful sample.

## Expected behavior

### Feed

- High-confidence ad cards are hidden.
- Medium-confidence candidates are hidden by current product policy.
- Hidden connected cards can be audited with `Reveal blocked #N`.
- Revealing a card must not change the historical blocked count.
- Facebook infinite scroll must continue to load normally.

### Suggested-post toggle

Open the fbok toolbar popup.

When **Hide suggested posts** is enabled:
- explicit `Suggested for you` / `Senin için önerilen` cards may be hidden;
- detected Follow/Takip et or group Join/Katıl recommendation cards may be hidden.

When disabled:
- suggested-only detections should be cleared;
- ad filtering should remain active.

### Right rail

- The right-column Sponsored module should be hidden.
- Contacts / Kişiler and unrelated right-column modules must remain usable.

## Debug badge

The bottom-left badge includes values similar to:

`fbok 0.5.1 · scanned N · hits N · H/M N/N · blocked N · cache N · late/rescue N/N · retry N`

The important distinction is:

- `hits` = classified DOM cards;
- `H/M` = high vs medium classification counts;
- `blocked` = cards that entered blocking policy;
- `currentlyHidden` is available through diagnostics and reflects reveal state.

## Blocked-card report

From Facebook's normal DevTools console:

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

For diagnostics:

```js
document.addEventListener(
  "fbok-debug-response",
  (event) => console.log(event.detail),
  { once: true },
);

document.dispatchEvent(
  new CustomEvent("fbok-debug-request", {
    detail: { action: "diagnostics" },
  }),
);
```

## High-confidence evidence to watch

Common reasons include:

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
- `metadata-rendered-sponsored-token`
- `metadata-rendered-ad-corroborated`
- `metadata-visual-sponsored`
- `metadata-visual-ad-corroborated`
- `suggested-label-post`
- `suggested-follow-post`
- `suggested-group-join-post`

Short `Ad` labels are expected to require independent corroboration rather than acting as a standalone high-confidence signal.

## Medium-confidence evidence

Current medium reasons include:

- `shape-dangling-label-no-permalink`
- `shape-outbound-no-permalink`

Medium candidates are currently hidden by product policy. Treat every revealed medium card as useful false-positive/false-negative evidence.

## False-positive checks

Pay special attention to wanted content that should not disappear unexpectedly:

- normal friend posts;
- normal followed-page posts;
- intentional group posts;
- ordinary external-link shares;
- reels and marketplace cards;
- story tray;
- posts containing the literal words `Sponsored`, `Sponsorlu`, or `Ad` in body/comment text;
- right-column Contacts / Kişiler.

Suggested/recommended content hidden by the medium policy should be recorded separately from genuinely wanted organic false positives.

## Performance regression checks

During a longer scroll session verify:

- initial Facebook load completes;
- scrolling remains responsive;
- new feed cards continue loading;
- opening/closing Facebook menus does not freeze the page;
- memory/CPU does not obviously climb without bound;
- repeated navigation between feed and other Facebook pages remains usable;
- extension reload + Facebook hard refresh recovers cleanly.

## Report format

For each test session record:

- browser + Facebook UI language;
- approximate number of cards observed;
- ads hidden;
- ads missed;
- suggested/recommended content hidden;
- wanted organic posts hidden;
- right-rail result;
- whether infinite scroll stayed healthy;
- full debug badge text;
- diagnostics output if anything suspicious happened.
