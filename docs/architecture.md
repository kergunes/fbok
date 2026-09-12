# Architecture

This document describes fbok's current runtime boundaries and the constraints that should be preserved during future cleanup.

Current version: **v0.5.1**

## Runtime shape

fbok intentionally has a small runtime surface:

- `src/content.js` — Facebook detector, lifecycle queues, filtering policy integration, right-rail logic, and debug reporting;
- `src/debug.css` — hiding/reveal/debug presentation;
- `popup.js` — user setting persistence;
- `manifest.json` — Facebook-only Manifest V3 registration.

There is no backend and no external runtime dependency.

## Detection pipeline

A feed card can be classified through several evidence families.

### 1. Primary platform metadata

The strongest current detector inspects bounded React props attached to resolved feed-unit elements and searches a limited object graph for sponsored feed category metadata.

This is powerful but inherently private-implementation-dependent, so it must never become the only detector.

### 2. Structured DOM / accessibility

Fallback evidence includes:

- ARIA labels;
- referenced label IDs;
- title attributes;
- transient label caching;
- SVG sprite references;
- Ads About links.

This layer exists partly because Facebook may render or remove accessibility labels at different lifecycle moments.

### 3. Rendered text / geometry

The content script can reconstruct short header labels using:

- direct visible text;
- own text nodes;
- character-split spans;
- CSS ordering;
- bounded header geometry;
- mixed-wrapper text-node ranges.

This logic must remain spatially bounded to the post metadata area to avoid body-text false positives.

### 4. Shape fallback

When stronger signals are unavailable, fbok can classify cards using feed shape such as:

- outbound links;
- absence of a Facebook permalink;
- dangling accessibility references.

Shape evidence is weaker and should stay conceptually separate from strong ad evidence.

## Classification vs filtering policy

These are different concerns.

Classification describes what the detector believes about a card.

Filtering policy decides whether the user sees it.

Current policy:

- high-confidence ad → hide;
- medium-confidence candidate → hide;
- suggested content → hide only when enabled;
- revealed blocked card → temporarily show.

Future refactors should preserve this distinction so medium-policy changes do not require rewriting detector semantics.

## Lifecycle model

Facebook continuously mutates and hydrates the feed.

fbok therefore uses:

- `MutationObserver` for child-list changes;
- `requestAnimationFrame` batching for post work;
- coalesced scan roots for nested mutation bursts;
- a bounded unresolved-signal retry queue;
- bounded per-card hydration retries;
- weak collections for card lifecycle state where possible.

Avoid adding:

- document-wide polling;
- unbounded recursive DOM scans;
- character-data observation across the full document;
- destructive card removal;
- synchronous full-feed rescans inside mutation callbacks.

## Hiding strategy

Cards are marked with fbok data attributes and hidden through CSS.

This is deliberate. Removing Facebook-owned nodes can interfere with React reconciliation and previously caused feed-loading regressions during development.

Any future blocker path should prefer reversible presentation changes over ownership-destructive DOM mutations.

## Debug model

Blocked-card evidence is snapshotted when a card first enters blocking policy.

The debug system provides:

- aggregate counters;
- blocked-card details;
- card reveal controls;
- a read-only DOM-event bridge accessible from the normal page DevTools console.

Debug state is diagnostic only and should not become a required dependency for filtering correctness.

## Settings

`chrome.storage.sync` currently stores:

- `hideSuggested`

The content script listens for storage changes and reapplies the relevant policy without requiring a full extension restart.

## Current technical-debt boundary

`src/content.js` is intentionally still monolithic because detector behavior is evolving quickly. Splitting it before behavior is covered by tests would create more moving pieces without reducing product risk.

A future modularization should happen after classifier fixtures exist. Reasonable boundaries are:

```text
detectors/
  react
  structured-dom
  rendered-metadata
  shape
  suggested

runtime/
  observer
  queues
  settings

filters/
  feed
  right-rail

debug/
  diagnostics
  reveal
```

This is a direction, not a requirement for an immediate build-system migration.

## Invariants for future changes

1. Facebook-only host scope.
2. No telemetry or external requests.
3. No destructive removal of Facebook feed cards.
4. No unbounded hot-loop scanning.
5. Short `Ad` labels require corroboration.
6. Strong and weak evidence remain distinguishable.
7. User-configurable filters remain independent from ad classification.
8. Any performance optimization must preserve detector correctness.
9. Any detector expansion must be tested against wanted organic posts.
10. CI green means repository integrity, not live-classifier accuracy, until fixture tests are added.
