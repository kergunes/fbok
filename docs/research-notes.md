# Research notes

fbok's detector architecture is informed by maintained Facebook-specific blockers while being independently implemented.

Reference implementation reviewed:
- https://github.com/browseraddonsupport-wq/fb-sponsored-ad-post-blocker

## Findings adopted in v0.1.9

Current Facebook markup can expose ad labels through several lifecycles:

1. Plain or direct text: `Sponsored`, `Sponsorlu`, or `Ad`.
2. Character-split labels whose visual order is controlled by CSS `order`.
3. Decoy spans where either the high-class-count or low-class-count partition can contain the real label.
4. SVG `<use>` references whose target symbol contains accessible text.
5. `aria-labelledby` references to portal nodes outside the feed post.
6. Ephemeral label nodes inserted empty, filled later by a text-node mutation, and sometimes removed before the next animation frame.
7. Positively classified labels staged outside the final post before React reparents them.

v0.1.9 therefore uses:
- id → text cache;
- late text-node capture;
- removed-text rescue;
- reverse lookup from cached label id to `aria-labelledby` / SVG referrers;
- bounded retry only after a signal has already classified as an ad;
- three-way character reconstruction;
- semantic post anchors plus a geometry fallback.

## Explicit non-signal

`data-ad-rendering-role`, `data-ad-preview`, and similarly named attributes are not treated as ad evidence. They can appear on ordinary Facebook posts.

## Shape heuristics

Some ads can be unlabeled after all readable evidence disappears. fbok keeps a conservative shape fallback in debug mode only:
- no recognized permalink;
- dangling `aria-labelledby` and/or outbound link.

These produce **medium confidence** and must be false-positive tested before any hide mode uses them.
