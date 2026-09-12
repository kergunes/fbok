# TODO

## Browser extension

### v0.1 — Detection / debug
- [x] Manifest V3 skeleton
- [x] Facebook-only content script
- [x] MutationObserver for dynamic/infinite feed
- [x] Multiple independent Sponsored/Sponsorlu/Ad detectors
- [x] Accessibility/ARIA detection
- [x] SVG sprite reference detection
- [x] Obfuscated/character-split text reconstruction
- [x] Feed post container resolution with fallbacks
- [x] Debug highlight mode + detected reason
- [x] Fail-open behavior
- [x] Manual test checklist
- [x] GitHub Actions validation
- [x] Ephemeral label cache + reverse referrer resolution
- [x] Late text-node and removed-text rescue
- [x] Bounded retry queue for positively classified unresolved signals
- [x] Remove data-ad-rendering-role as a detection signal
- [x] v0.1.10 stability hotfix: remove full-document debug recounts, disable characterData observer and shape sweeps
- [x] v0.1.11: reference-style width-climb container fallback + per-post-only medium shape detection
- [x] v0.1.12: rendered metadata corroboration + high-confidence CSS hide path + no-downgrade state
- [x] v0.1.13: visual-geometry reconstruction for obfuscated header Ad/Sponsored labels
- [x] v0.1.14: consistent independent corroboration for short Ad; avoid duplicate mutation-target scans
- [x] v0.1.15: mixed-header direct text-node geometry fallback for corroborated Ad
- [x] v0.1.16: ad CTA corroboration for visually rendered Ad cards with empty label references
- [x] v0.1.17: recognize plain div/span CTA rendering such as Learn more
- [x] v0.2.0: React feed-unit category metadata primary detector; CTA fallback removed
- [x] v0.2.1: bounded per-card hydration retries without characterData observation
- [x] v0.2.2: temporary medium-candidate CSS hide and deduplicated blocked counter
- [x] v0.2.3: on-demand blocked-post details report
- [x] v0.2.4: page-world read-only debug bridge for blocked-post report
- [x] v0.2.5: snapshot blocked-post evidence before Facebook re-render
- [x] v0.2.6: add non-destructive reveal controls for blocked test cards
- [x] v0.2.7: scroll to the card when revealing a blocked test card
- [x] v0.2.8: fix reveal CSS specificity for medium test cards
- [x] v0.2.9: add code-level suggested-post hide toggle and separate reason
- [x] v0.3.0: detect suggested labels and group join controls without requiring Follow
- [x] v0.4.0: lock medium hiding, add right-rail Sponsored filtering, and add popup toggle
- [x] v0.4.1: prevent right-rail marker rescan loops
- [x] v0.4.2: broaden right-rail Sponsored module card targeting
- [x] v0.4.3: resolve Sponsored-only sidebar ancestor and card fallback
- [x] v0.4.4: hide separate right-rail Sponsored text/link rows
- [x] v0.5.0: coalesce nested mutation label scans per animation frame
- [x] v0.5.1: make scan-root deduplication linear during mutation bursts
- [ ] Real Facebook feed validation in Chrome/Brave
- [ ] False-positive / false-negative test pass
- [ ] Tune detectors from real DOM captures

### v0.2 — Usable blocker
- [x] High-confidence feed hide path (v0.1.12; medium remains fail-open)
- [ ] Debug/hide mode switch
- [ ] Extension on/off switch
- [ ] Blocked counter
- [ ] Persist settings locally
- [ ] Turkish + English UI

### Later
- [ ] Sidebar ads
- [ ] Optional "Suggested for you" filtering
- [ ] Chrome Web Store packaging/publishing
- [ ] Release/versioning workflow

## Android — future experiment

- [ ] Create a separate rootsuz Android prototype using AccessibilityService
- [ ] Restrict scanning to the native Facebook app
- [ ] Detect Sponsored/Sponsorlu from AccessibilityNodeInfo
- [ ] Debug overlay showing detection reason and post bounds
- [ ] Test detection accuracy on real native Facebook feed
- [ ] If accuracy is acceptable, prototype overlay hiding / auto-skip behavior
- [ ] Only investigate patched APK or LSPosed/root hooks if the accessibility approach is not good enough

The Android track is intentionally secondary to stabilizing the browser extension.
