# TODO

## Browser extension

### v0.1 — Detection / debug
- [x] Manifest V3 skeleton
- [x] Facebook-only content script
- [x] MutationObserver for dynamic/infinite feed
- [x] Multiple independent Sponsored/Sponsorlu detectors
- [x] Accessibility/ARIA detection
- [x] SVG sprite reference detection
- [x] Obfuscated/character-split text reconstruction
- [x] Feed post container resolution with fallbacks
- [x] Debug highlight mode + detected reason
- [x] Fail-open behavior
- [x] Manual test checklist
- [x] GitHub Actions validation
- [ ] Real Facebook feed validation in Chrome/Brave
  - [x] First real-world miss captured: Logitech feed ad labeled `Ad`
  - [x] Added strict visible `Ad` header detection in v0.1.3
  - [x] Relaxed brittle heading dependency and added debug badge in v0.1.4
- [ ] False-positive / false-negative test pass
- [ ] Tune detectors from real DOM captures

### v0.2 — Usable blocker
- [ ] Real hide/collapse mode
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
