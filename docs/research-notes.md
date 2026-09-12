# Research notes

fbok's detector architecture was reviewed against current public Facebook-specific blockers and filter rules rather than relying only on local trial-and-error.

## Useful current approaches

### F.B. Sponsored/Ad Post Blocker

Source: https://github.com/browseraddonsupport-wq/fb-sponsored-ad-post-blocker

The project documents several Facebook DOM variants observed in 2026:

- Chromium feed labels rendered through SVG `<use href="#...">` references.
- `aria-labelledby` targets that may be short-lived or removed after the accessible name is computed.
- Visible `Ad` labels that can exist without useful persistent text in the post.
- Ads with no readable label requiring a conservative shape heuristic.
- `aria-posinset` as a useful feed-post anchor.
- `data-ad-rendering-role` is explicitly unsafe as a standalone sponsored marker.

fbok reimplements these ideas independently and remains fail-open. The current debug build does not hide posts.

### uBlock Origin community filters

Reference: https://www.reddit.com/r/uBlockOrigin/comments/1vdm8jv/facebook_sponsored_posts_hidden_by_custom/

A current Brave/Chromium filter set combines:

- `data-ad-rendering-role="profile_name"`
- `data-ad-rendering-role="story_message"`
- `data-ad-rendering-role^="cta-"`
- feed container anchors such as `aria-posinset`

fbok treats that combination only as a heuristic signal, never the attribute by itself.

## v0.1.8 decision

Detection now has two layers:

1. High-confidence label/accessibility/SVG signals.
2. Conservative unlabeled-ad shape signals, currently used only for debug highlighting:
   - dangling `aria-labelledby` with no post permalink;
   - outbound link with no post permalink;
   - the combined ad-rendering-role shape above.

Before real hide mode, these shape detections must be manually measured for false positives.
