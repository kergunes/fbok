# Changelog

Notable development milestones for fbok.

## v0.5.3

- Added the packaged 128x128 fbok extension icon.
- Wired the icon into the extension manifest and toolbar action.
- Bumped the Chrome Web Store package version to 0.5.3.

## v0.5.2

- Improved feed performance by avoiding duplicate label-subtree scans.
- Added a popup toggle for on-page debug information.

## v0.5.1

- Made queued scan-root deduplication linear during mutation bursts.
- Reduced nested mutation label-scan overhead.

## v0.5.0

- Coalesced nested mutation label scans per animation frame.

## v0.4.x

- Added persistent popup toggle for suggested-post filtering.
- Added right-rail Sponsored filtering.
- Iterated sidebar module/card targeting.
- Prevented right-rail marker rescan loops.
- Locked medium-confidence candidates into the current hide policy.

## v0.3.0

- Expanded suggested-content detection to explicit labels, Follow/Takip et, and group Join/Katıl controls.

## v0.2.x

- Added React feed-unit category metadata as the primary sponsored detector.
- Added bounded per-card hydration retries.
- Added medium-candidate hiding.
- Added blocked-card counters and on-demand detail reporting.
- Added page-world read-only debug bridge.
- Added blocked-card evidence snapshots.
- Added reveal controls and scroll-to-card audit flow.
- Added code-level suggested-post filtering.

## v0.1.17

- Recognized plain div/span CTA rendering during live detector iteration.

## v0.1.16

- Added CTA corroboration during the short-Ad investigation.

## v0.1.15

- Added direct mixed-header text-node geometry fallback.

## v0.1.14

- Applied consistent independent corroboration for short `Ad` signals.
- Removed duplicate mutation-target scans.

## v0.1.13

- Reconstructed visually rendered header labels from geometry.

## v0.1.12

- Added the first high-confidence CSS blocking path.
- Prevented confidence downgrade from high back to medium.
- Added rendered metadata corroboration.

## v0.1.11

- Improved live post-container resolution.
- Added per-post medium shape detection.

## v0.1.10

- Stability hotfix after a Facebook feed-loading regression.
- Removed expensive full-document debug recounts.
- Disabled broad shape sweeps and character-data observation.

## Earlier v0.1

- Manifest V3 skeleton.
- Facebook-only content script.
- MutationObserver feed lifecycle.
- ARIA/accessibility detection.
- SVG sprite reference detection.
- character-split/obfuscated label reconstruction.
- semantic and geometry post resolution.
- transient label cache and reverse-referrer resolution.
- bounded retry queue.
- GitHub Actions validation.
