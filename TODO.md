# TODO

This file tracks **active work only**. Completed version history lives in `CHANGELOG.md`.

Current release line: **v0.5.1**

## P0 — Correctness and safety

- [ ] Run a broader real-feed validation pass in Brave/Chrome.
- [ ] Record false positives separately for:
  - [ ] wanted organic posts;
  - [ ] suggested/recommended posts;
  - [ ] external-link shares;
  - [ ] page posts;
  - [ ] group posts.
- [ ] Record false negatives for visible feed ads.
- [ ] Verify infinite scroll over a long session with fbok enabled.
- [ ] Verify no feed-stall regression after repeated navigation / refresh cycles.
- [ ] Test English and Turkish Facebook UI variants.
- [ ] Decide an acceptable false-positive threshold for medium-confidence hiding.

## P1 — Automated confidence

- [ ] Add unit tests for label normalization.
- [ ] Add unit tests for short-`Ad` corroboration rules.
- [ ] Add tests for permalink vs outbound-link classification.
- [ ] Add classifier fixtures for high / medium / organic cases.
- [ ] Add tests for suggested-post settings behavior.
- [ ] Add regression fixtures from real DOM captures where practical.
- [ ] Make CI exercise classifier behavior, not only syntax/manifest validation.

## P1 — Product controls

- [ ] Add extension master on/off switch.
- [ ] Add user-facing blocked counters.
- [ ] Separate counters by category:
  - [ ] ads;
  - [ ] suggested;
  - [ ] other medium-filtered content.
- [ ] Add a debug/release mode switch or build-time flag.
- [ ] Decide whether medium hiding should be configurable.
- [ ] Add Turkish + English popup UI.

## P2 — Codebase hygiene

- [ ] Keep behavior stable before structural refactors.
- [ ] Split `src/content.js` once detector behavior is sufficiently covered by tests.
- [ ] Candidate future boundaries:
  - [ ] detector primitives;
  - [ ] React metadata detector;
  - [ ] DOM/accessibility detector;
  - [ ] shape/suggested classifiers;
  - [ ] observer/queue lifecycle;
  - [ ] right-rail filtering;
  - [ ] debug/reporting.
- [ ] Avoid introducing a build system unless modularization actually requires it.
- [ ] Keep runtime dependency-free if practical.

## P2 — Release readiness

- [ ] Add release/versioning workflow.
- [ ] Add production icon assets.
- [ ] Prepare Chrome Web Store listing copy.
- [ ] Prepare privacy disclosure matching actual permissions.
- [ ] Verify unpacked and packaged builds behave identically.
- [ ] Create a clean release checklist.
- [ ] Decide whether debug controls ship in public builds.

## Completed capabilities

- [x] Manifest V3 Facebook-only extension.
- [x] Dynamic feed observation with frame batching.
- [x] ARIA/accessibility detection.
- [x] SVG sprite reference detection.
- [x] character-split / obfuscated text reconstruction.
- [x] React feed metadata detection.
- [x] bounded unresolved-signal retry queue.
- [x] bounded hydration retries.
- [x] semantic + geometry post-container resolution.
- [x] CSS-based high-confidence hiding.
- [x] medium-confidence hiding with reveal auditing.
- [x] blocked-card snapshots and diagnostics bridge.
- [x] suggested-post filtering.
- [x] suggested-post popup toggle with `chrome.storage.sync`.
- [x] right-rail Sponsored filtering.
- [x] nested mutation scan coalescing.
- [x] GitHub Actions validation.

## Android — later experiment

Browser stability remains the priority.

- [ ] Build a separate rootless Android prototype using `AccessibilityService`.
- [ ] Restrict scanning to the native Facebook app.
- [ ] Detect Sponsored/Sponsorlu through `AccessibilityNodeInfo`.
- [ ] Add a debug overlay for reason + post bounds.
- [ ] Measure native-feed detection accuracy.
- [ ] Prototype overlay hide / auto-skip only if detection is reliable.
- [ ] Investigate patched APK or LSPosed/root hooks only if accessibility is insufficient.
