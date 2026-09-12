(() => {
  "use strict";

  const VERSION = "0.1.13";

  const CONFIG = Object.freeze({
    debug: true,
    labelCacheLimit: 256,
    maxCandidatesPerPost: 420,
    retryIntervalMs: 100,
    retryWindowMs: 5000,
    maxPendingSignals: 64,
    debugBadgeIntervalMs: 250,
    metadataMaxPixelsFromTop: 280,
    metadataMaxFractionOfPost: 0.42,
    visualMetadataMaxPixelsFromTop: 92,
    visualMetadataLineTolerancePx: 5,
    visualMetadataJoinGapPx: 9,
  });

  const SPONSORED_LABELS = new Set(["sponsored", "sponsorlu", "ad"]);

  const POST_SELECTOR =
    '[data-pagelet^="FeedUnit"], [aria-posinset], [role="article"], article';

  const LABEL_SELECTOR =
    'span, a, use, text, [aria-label], [aria-labelledby], [title]';

  const DETECTED_ATTR = "data-fbok-detected";
  const REASON_ATTR = "data-fbok-reason";
  const CONFIDENCE_ATTR = "data-fbok-confidence";
  const SEEN_ATTR = "data-fbok-seen";

  const INVISIBLE_CHARS_RE = /[\p{Cf}\p{Mn}\p{Co}]/gu;
  const HONEYPOT_CLASS_COUNT = 10;

  const PERMALINK_RE =
    /\/(posts|permalink|permalink\.php|story\.php|videos|video\.php|watch|photo|photo\.php|photos|reel|reels|groups|events|notes|share|media\/set|commerce\/listing|marketplace\/item)([\/?]|$)/i;

  const labelTextById = new Map();
  const pendingPosts = new Set();
  const pendingSignals = new Map();

  let flushScheduled = false;
  let retryTimer = null;
  let debugBadgeScheduled = false;
  let lastDebugBadgeAt = 0;

  const debugState = {
    scanned: 0,
    hits: 0,
    highHits: 0,
    mediumHits: 0,
    cachedLabels: 0,
    lateTextLabels: 0,
    rescuedLabels: 0,
    referrerResolutions: 0,
    retryQueued: 0,
    retryResolved: 0,
    retryExpired: 0,
    svgMatches: 0,
    ariaMatches: 0,
    textMatches: 0,
    visualMetadataMatches: 0,
    shapeCandidates: 0,
    badgeUpdates: 0,
    lastPendingReason: "",
  };

  function cleanText(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(INVISIBLE_CHARS_RE, "")
      .trim();
  }

  function normalizeLabel(value) {
    return cleanText(value)
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "");
  }

  function isSponsoredLabel(value) {
    return SPONSORED_LABELS.has(normalizeLabel(value));
  }

  function ownText(element) {
    let out = "";

    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      out += node.textContent ?? "";
      if (out.length > 300) return "";
    }

    return cleanText(out);
  }

  function isElementVisible(element) {
    if (!(element instanceof Element)) return false;
    if (element.closest('[aria-hidden="true"]')) return false;

    const style = getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isPageletFeedUnit(post) {
    if (!post.matches('[data-pagelet^="FeedUnit"]')) return false;
    if (!post.closest('[role="main"]')) return false;
    return !post.closest('[role="dialog"], [role="complementary"]');
  }

  function isTopLevelPositionedItem(post) {
    if (!post.hasAttribute("aria-posinset")) return false;

    const position = Number.parseInt(
      post.getAttribute("aria-posinset") ?? "",
      10,
    );

    if (!Number.isFinite(position) || position < 1) return false;
    if (post.parentElement?.closest("[aria-posinset]")) return false;
    if (!post.closest('[role="main"]')) return false;

    return !post.closest(
      '[role="dialog"], [role="navigation"], [role="complementary"]',
    );
  }

  function isLegacyFeedArticle(post) {
    if (!(post.matches('[role="article"]') || post.matches("article"))) {
      return false;
    }

    return Boolean(post.closest('[role="feed"], [role="main"]'));
  }

  function isFeedPost(post) {
    if (!(post instanceof Element)) return false;

    return (
      isPageletFeedUnit(post) ||
      isTopLevelPositionedItem(post) ||
      isLegacyFeedArticle(post)
    );
  }

  function holdsSeveralCards(element) {
    let cards = 0;

    for (const child of element.children) {
      const rect = child.getBoundingClientRect();

      if (
        rect.width >= 360 &&
        rect.width <= 900 &&
        rect.height >= 120 &&
        rect.height <= 3200
      ) {
        cards += 1;
        if (cards > 1) return true;
      }
    }

    return false;
  }

  function looksLikePost(card) {
    if (!(card instanceof Element)) return false;

    const text = cleanText(card.textContent);
    if (text.length < 40) return false;

    let storyLinks = 0;
    for (const link of card.querySelectorAll('a[href*="/stories/"]')) {
      storyLinks += 1;
      if (storyLinks > 1) return false;
    }

    return true;
  }

  function climbToCardByWidth(signal) {
    if (!(signal instanceof Element)) return null;

    let node = signal;
    let best = null;

    for (let depth = 0; node && depth < 24; depth += 1) {
      const parent = node.parentElement;
      if (!parent || parent === document.body) break;

      const width = node.getBoundingClientRect().width;
      const parentWidth = parent.getBoundingClientRect().width;

      if (width >= 400 && width <= 900) {
        best = node;

        if (parentWidth > width * 1.2) {
          break;
        }
      }

      node = parent;
    }

    if (!best) return null;
    if (best.closest('[role="dialog"]')) return null;
    if (!best.closest('[role="main"]')) return null;

    return best;
  }

  function geometryCardFromSignal(signal) {
    if (!(signal instanceof Element)) return null;

    let node = signal;
    let best = null;

    for (let depth = 0; node && depth < 30; depth += 1) {
      const parent = node.parentElement;
      if (!parent || parent === document.body) break;

      const rect = node.getBoundingClientRect();

      if (
        node.closest('[role="main"]') &&
        rect.width >= 360 &&
        rect.width <= Math.min(900, window.innerWidth * 0.8) &&
        rect.height >= 120 &&
        rect.height <= 3200 &&
        looksLikePost(node)
      ) {
        best = node;

        const parentRect = parent.getBoundingClientRect();
        if (parentRect.width > rect.width * 1.25) break;
        if (holdsSeveralCards(parent)) break;
      }

      node = parent;
    }

    return best;
  }

  function resolvePostContainer(node) {
    if (!(node instanceof Element)) return null;

    const articleOrPagelet = node.closest(
      '[role="article"], article, [data-pagelet^="FeedUnit"]',
    );

    if (
      articleOrPagelet &&
      articleOrPagelet.closest('[role="main"]') &&
      !articleOrPagelet.closest('[role="dialog"]')
    ) {
      return articleOrPagelet;
    }

    if (!node.closest('[role="dialog"]')) {
      const positioned = node.closest("[aria-posinset]");

      if (
        positioned &&
        positioned.closest('[role="main"]') &&
        !positioned.closest('[role="complementary"]')
      ) {
        return positioned;
      }
    }

    let candidate = node.closest(POST_SELECTOR);

    while (candidate) {
      if (isFeedPost(candidate)) return candidate;
      candidate = candidate.parentElement?.closest(POST_SELECTOR) ?? null;
    }

    return (
      climbToCardByWidth(node) ||
      geometryCardFromSignal(node)
    );
  }

  function isLikelyMetadataNode(node, post) {
    if (!(node instanceof Element) || !isElementVisible(node)) return false;

    const nodeRect = node.getBoundingClientRect();
    const postRect = post.getBoundingClientRect();

    if (postRect.width <= 0 || postRect.height <= 0) return false;

    const offsetFromTop = nodeRect.top - postRect.top;
    const maxOffset = Math.min(
      CONFIG.metadataMaxPixelsFromTop,
      Math.max(140, postRect.height * CONFIG.metadataMaxFractionOfPost),
    );

    return offsetFromTop >= -12 && offsetFromTop <= maxOffset;
  }

  function renderDebugBadge() {
    if (!CONFIG.debug) return;

    let badge = document.getElementById("fbok-debug-badge");

    if (!badge) {
      badge = document.createElement("div");
      badge.id = "fbok-debug-badge";
      document.documentElement.appendChild(badge);
    }

    debugState.cachedLabels = labelTextById.size;
    debugState.badgeUpdates += 1;

    badge.textContent =
      `fbok ${VERSION} · scanned ${debugState.scanned} · hits ${debugState.hits}` +
      ` · H/M ${debugState.highHits}/${debugState.mediumHits}` +
      ` · cache ${labelTextById.size}` +
      ` · late/rescue ${debugState.lateTextLabels}/${debugState.rescuedLabels}` +
      ` · retry ${pendingSignals.size}` +
      (pendingSignals.size > 0 && debugState.lastPendingReason
        ? `(${debugState.lastPendingReason})`
        : "");
  }

  function updateDebugBadge(force = false) {
    if (!CONFIG.debug) return;

    const now = performance.now();
    if (force || now - lastDebugBadgeAt >= CONFIG.debugBadgeIntervalMs) {
      lastDebugBadgeAt = now;
      debugBadgeScheduled = false;
      renderDebugBadge();
      return;
    }

    if (debugBadgeScheduled) return;
    debugBadgeScheduled = true;

    window.setTimeout(() => {
      debugBadgeScheduled = false;
      lastDebugBadgeAt = performance.now();
      renderDebugBadge();
    }, CONFIG.debugBadgeIntervalMs);
  }

  function markDetected(post, detection) {
    if (!(post instanceof Element)) return;

    const wasDetected = post.getAttribute(DETECTED_ATTR) === "true";
    const previousConfidence = post.getAttribute(CONFIDENCE_ATTR);
    const effectiveConfidence =
      previousConfidence === "high" ? "high" : detection.confidence;

    const previousReasons = (post.getAttribute(REASON_ATTR) ?? "")
      .split(",")
      .map((reason) => reason.trim())
      .filter(Boolean);

    const reasons = [
      ...new Set([...previousReasons, ...detection.reasons]),
    ];

    post.setAttribute(DETECTED_ATTR, "true");
    post.setAttribute(REASON_ATTR, reasons.join(", "));
    post.setAttribute(CONFIDENCE_ATTR, effectiveConfidence);

    if (!wasDetected) {
      debugState.hits += 1;

      if (effectiveConfidence === "high") {
        debugState.highHits += 1;
      } else {
        debugState.mediumHits += 1;
      }
    } else if (
      previousConfidence === "medium" &&
      effectiveConfidence === "high"
    ) {
      debugState.mediumHits = Math.max(0, debugState.mediumHits - 1);
      debugState.highHits += 1;
    }

    if (CONFIG.debug) {
      console.debug("[fbok] Sponsored candidate", {
        reasons,
        confidence: effectiveConfidence,
        post,
      });
    }

    updateDebugBadge();
  }

  function cacheLabelText(id, rawText, source = null) {
    if (!id) return false;

    const text = cleanText(rawText);
    if (!text || text.length > 40) return false;

    if (!labelTextById.has(id) && labelTextById.size >= CONFIG.labelCacheLimit) {
      labelTextById.delete(labelTextById.keys().next().value);
    }

    labelTextById.set(id, text);

    if (isSponsoredLabel(text)) {
      resolveReferrersForId(id, source);
    }

    updateDebugBadge();
    return true;
  }

  function rememberLabelTarget(element) {
    if (!(element instanceof Element) || !element.id) return false;
    return cacheLabelText(element.id, element.textContent, element);
  }

  function cacheLabelTargets(root) {
    if (!(root instanceof Element)) return;

    if (root.id) rememberLabelTarget(root);

    for (const element of root.querySelectorAll("[id]")) {
      rememberLabelTarget(element);
    }
  }

  function svgReference(useElement) {
    return (
      useElement.getAttribute("href") ||
      useElement.getAttribute("xlink:href") ||
      useElement.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
      ""
    );
  }

  function referencedLabelText(node) {
    const ids = (node.getAttribute("aria-labelledby") ?? "")
      .split(/\s+/)
      .filter(Boolean);

    const values = [];

    for (const id of ids) {
      const target = document.getElementById(id);
      const text = target
        ? cleanText(target.textContent)
        : labelTextById.get(id);

      if (text) values.push(text);
    }

    return values;
  }

  function referrersForId(id) {
    if (!id) return [];

    const found = [];
    const escaped = CSS.escape(id);

    try {
      for (const node of document.querySelectorAll(
        `[aria-labelledby~="${escaped}"]`,
      )) {
        found.push(node);
      }
    } catch {
      // Ignore malformed transient ids and fall back to the explicit scan below.
    }

    for (const useElement of document.querySelectorAll("use")) {
      if (svgReference(useElement) === `#${id}`) {
        found.push(useElement);
      }
    }

    return [...new Set(found)];
  }

  function resolveReferrersForId(id, source = null) {
    let resolved = false;

    for (const referrer of referrersForId(id)) {
      if (referrer === source) continue;

      const hit = classifyStructuredSignal(referrer);

      if (hit) {
        const post = resolvePostContainer(referrer);

        if (post) {
          markDetected(post, {
            confidence: "high",
            reasons: [hit.reason],
            nodes: [referrer],
          });
          resolved = true;
          debugState.referrerResolutions += 1;
          continue;
        }

        queuePositiveSignal(referrer, hit);
      } else {
        enqueuePost(resolvePostContainer(referrer));
      }
    }

    return resolved;
  }

  function isCharacterSplit(element) {
    const children = element.children;

    if (children.length < 4 || children.length > 120) return false;

    for (const child of children) {
      if (child.tagName !== "SPAN" || child.children.length !== 0) {
        return false;
      }

      if (cleanText(child.textContent).length > 1) return false;
    }

    return true;
  }

  function collectOrderedLeaves(root, depth = 0) {
    if (!(root instanceof Element) || depth > 4) return [];

    const ordered = Array.from(root.childNodes).map((child, index) => {
      let order = index;
      let hidden = false;

      if (child instanceof Element) {
        const style = getComputedStyle(child);
        const parsedOrder = Number.parseInt(style.order, 10);

        if (Number.isFinite(parsedOrder)) order = parsedOrder;

        hidden =
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity) === 0;
      }

      return { child, order, hidden };
    });

    ordered.sort((a, b) => a.order - b.order);

    const leaves = [];

    for (const entry of ordered) {
      if (entry.hidden) continue;

      const child = entry.child;

      if (child.nodeType === Node.TEXT_NODE) {
        leaves.push({
          text: child.textContent ?? "",
          classCount: null,
        });
        continue;
      }

      if (!(child instanceof Element)) continue;

      if (child.tagName === "SPAN" && child.children.length === 0) {
        leaves.push({
          text: child.textContent ?? "",
          classCount: child.classList.length,
        });
      } else {
        leaves.push(...collectOrderedLeaves(child, depth + 1));
      }
    }

    return leaves;
  }

  function characterSplitVariants(element) {
    if (!isCharacterSplit(element)) return [];

    const leaves = collectOrderedLeaves(element);
    if (leaves.length === 0) return [];

    const assemble = (keep) =>
      cleanText(
        leaves
          .filter(
            (leaf) =>
              leaf.classCount === null || keep(leaf.classCount),
          )
          .map((leaf) => leaf.text)
          .join(""),
      );

    return [
      assemble(() => true),
      assemble((count) => count > HONEYPOT_CLASS_COUNT),
      assemble((count) => count <= HONEYPOT_CLASS_COUNT),
    ].filter(Boolean);
  }

  function isAdsAboutHref(value) {
    const href = String(value ?? "").toLocaleLowerCase();

    return (
      href.includes("/ads/about") ||
      href.includes("why_am_i_seeing_this_ad")
    );
  }

  function classifyStructuredSignal(node) {
    if (!(node instanceof Element)) return null;

    const ariaLabel = node.getAttribute("aria-label");

    if (ariaLabel) {
      const cleaned = cleanText(ariaLabel);

      if (/sponsored content$/i.test(cleaned) || isSponsoredLabel(cleaned)) {
        debugState.ariaMatches += 1;
        return {
          reason: /sponsored content$/i.test(cleaned)
            ? "accessibility-sponsored-content"
            : "accessibility-label",
          confidence: "high",
        };
      }
    }

    const title = node.getAttribute("title");

    if (title && isSponsoredLabel(title)) {
      debugState.ariaMatches += 1;
      return { reason: "title-label", confidence: "high" };
    }

    if (node.tagName.toLowerCase() === "use") {
      const ref = svgReference(node);

      if (ref.startsWith("#") && ref.length > 1) {
        const id = ref.slice(1);
        const target = document.getElementById(id);

        const text = target
          ? cleanText(target.textContent)
          : labelTextById.get(id);

        if (text && isSponsoredLabel(text)) {
          debugState.svgMatches += 1;
          return { reason: "svg-sprite-ref", confidence: "high" };
        }
      }
    }

    if (referencedLabelText(node).some(isSponsoredLabel)) {
      debugState.ariaMatches += 1;
      return { reason: "aria-labelledby-ref", confidence: "high" };
    }

    if (node.tagName.toLowerCase() === "a") {
      const rawHref = node.getAttribute("href") ?? "";

      if (isAdsAboutHref(rawHref) || isAdsAboutHref(node.href)) {
        return { reason: "ads-about-link", confidence: "high" };
      }
    }

    return null;
  }

  function classifyTextSignal(node, post = null) {
    if (!(node instanceof Element)) return null;

    if (post && !isLikelyMetadataNode(node, post)) return null;

    if (node.children.length === 0) {
      const text = cleanText(node.textContent);

      if (text.length <= 40 && isSponsoredLabel(text)) {
        debugState.textMatches += 1;
        return { reason: "visible-text", confidence: "high" };
      }
    }

    const direct = ownText(node);

    if (direct && direct.length <= 40 && isSponsoredLabel(direct)) {
      debugState.textMatches += 1;
      return { reason: "own-text-label", confidence: "high" };
    }

    for (const variant of characterSplitVariants(node)) {
      if (isSponsoredLabel(variant)) {
        debugState.textMatches += 1;
        return {
          reason: "visible-text-reconstructed",
          confidence: "high",
        };
      }
    }

    return null;
  }

  function classifySignal(node, post = null) {
    return (
      classifyStructuredSignal(node) ||
      classifyTextSignal(node, post)
    );
  }


  function visualMetadataSignal(post) {
    if (!(post instanceof Element)) return null;

    const postRect = post.getBoundingClientRect();
    if (postRect.width <= 0 || postRect.height <= 0) return null;

    const leaves = [];

    for (const node of post.querySelectorAll("span, a, div")) {
      if (node.children.length !== 0) continue;
      if (!isElementVisible(node)) continue;

      const text = cleanText(node.textContent);
      if (!text || text.length > 32) continue;

      const rect = node.getBoundingClientRect();
      const top = rect.top - postRect.top;

      if (
        top < -8 ||
        top > CONFIG.visualMetadataMaxPixelsFromTop ||
        rect.height <= 0 ||
        rect.height > 42 ||
        rect.width <= 0 ||
        rect.width > 220
      ) {
        continue;
      }

      leaves.push({
        node,
        text,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        centerY: rect.top + rect.height / 2,
      });
    }

    if (leaves.length === 0) return null;

    leaves.sort((a, b) => {
      const dy = a.centerY - b.centerY;
      if (Math.abs(dy) > CONFIG.visualMetadataLineTolerancePx) return dy;
      return a.left - b.left;
    });

    const lines = [];

    for (const leaf of leaves) {
      let line = lines.find(
        (candidate) =>
          Math.abs(candidate.centerY - leaf.centerY) <=
          CONFIG.visualMetadataLineTolerancePx,
      );

      if (!line) {
        line = { centerY: leaf.centerY, leaves: [] };
        lines.push(line);
      }

      line.leaves.push(leaf);
      line.centerY =
        line.leaves.reduce((sum, item) => sum + item.centerY, 0) /
        line.leaves.length;
    }

    const shapeCorroborated =
      !hasPermalink(post) && hasOutboundLink(post);

    for (const line of lines) {
      line.leaves.sort((a, b) => a.left - b.left);

      const segments = [];
      let current = null;

      for (const leaf of line.leaves) {
        if (
          !current ||
          leaf.left - current.right > CONFIG.visualMetadataJoinGapPx
        ) {
          current = {
            text: leaf.text,
            right: leaf.right,
            nodes: [leaf.node],
          };
          segments.push(current);
        } else {
          current.text += leaf.text;
          current.right = Math.max(current.right, leaf.right);
          current.nodes.push(leaf.node);
        }
      }

      for (const segment of segments) {
        const normalized = normalizeLabel(segment.text);

        if (
          normalized === "sponsored" ||
          normalized === "sponsorlu"
        ) {
          debugState.visualMetadataMatches += 1;
          return {
            reason: "metadata-visual-sponsored",
            confidence: "high",
            node: segment.nodes[0],
          };
        }

        if (normalized === "ad" && shapeCorroborated) {
          debugState.visualMetadataMatches += 1;
          return {
            reason: "metadata-visual-ad-corroborated",
            confidence: "high",
            node: segment.nodes[0],
          };
        }
      }
    }

    return null;
  }

  function renderedMetadataSignal(post) {
    if (!(post instanceof Element)) return null;

    const postRect = post.getBoundingClientRect();
    if (postRect.width <= 0 || postRect.height <= 0) return null;

    const candidates = Array.from(
      post.querySelectorAll("div, span, a"),
    ).slice(0, 220);

    for (const node of candidates) {
      if (!isElementVisible(node)) continue;

      const rect = node.getBoundingClientRect();
      const offsetFromTop = rect.top - postRect.top;

      if (
        offsetFromTop < -8 ||
        offsetFromTop > 170 ||
        rect.height <= 0 ||
        rect.height > 96 ||
        rect.width <= 0 ||
        rect.width > Math.min(560, postRect.width * 0.9)
      ) {
        continue;
      }

      const rendered = cleanText(node.innerText);
      if (!rendered || rendered.length > 140) continue;

      const tokens = rendered
        .split(/[\s\n\r·•|]+/u)
        .map(normalizeLabel)
        .filter(Boolean);

      if (tokens.includes("sponsored") || tokens.includes("sponsorlu")) {
        debugState.textMatches += 1;
        return {
          reason: "metadata-rendered-sponsored-token",
          confidence: "high",
          node,
        };
      }

      if (
        tokens.includes("ad") &&
        !hasPermalink(post) &&
        hasOutboundLink(post)
      ) {
        debugState.textMatches += 1;
        return {
          reason: "metadata-rendered-ad-corroborated",
          confidence: "high",
          node,
        };
      }
    }

    return null;
  }

  function processSignalElement(node) {
    if (!(node instanceof Element)) return false;

    const post = resolvePostContainer(node);
    const hit = classifySignal(node, post);

    if (!hit) return false;

    if (post) {
      markDetected(post, {
        confidence: hit.confidence,
        reasons: [hit.reason],
        nodes: [node],
      });
      return true;
    }

    if (node.id && resolveReferrersForId(node.id, node)) {
      return true;
    }

    queuePositiveSignal(node, hit);
    return false;
  }

  function scanLabelRoot(root) {
    if (!(root instanceof Element)) return;

    if (root.matches(LABEL_SELECTOR)) {
      processSignalElement(root);
    }

    for (const node of root.querySelectorAll(LABEL_SELECTOR)) {
      processSignalElement(node);
    }
  }

  function queuePositiveSignal(node, hit) {
    if (!(node instanceof Element)) return;
    if (pendingSignals.has(node)) return;
    if (pendingSignals.size >= CONFIG.maxPendingSignals) return;

    pendingSignals.set(node, {
      firstSeen: performance.now(),
      hit,
    });

    debugState.lastPendingReason = hit.reason;
    debugState.retryQueued += 1;
    ensureRetryLoop();
    updateDebugBadge();
  }

  function ensureRetryLoop() {
    if (retryTimer !== null) return;

    retryTimer = window.setInterval(() => {
      const now = performance.now();

      for (const [node, entry] of pendingSignals) {
        if (now - entry.firstSeen > CONFIG.retryWindowMs) {
          pendingSignals.delete(node);
          debugState.retryExpired += 1;
          continue;
        }

        const post = resolvePostContainer(node);

        if (post) {
          markDetected(post, {
            confidence: entry.hit.confidence,
            reasons: [entry.hit.reason, "retry-resolved"],
            nodes: [node],
          });

          pendingSignals.delete(node);
          debugState.retryResolved += 1;
          continue;
        }

        if (node.id && resolveReferrersForId(node.id, node)) {
          pendingSignals.delete(node);
          debugState.retryResolved += 1;
        }
      }

      if (pendingSignals.size === 0) {
        clearInterval(retryTimer);
        retryTimer = null;
      }

      updateDebugBadge();
    }, CONFIG.retryIntervalMs);
  }

  function candidateElements(post) {
    return Array.from(post.querySelectorAll(LABEL_SELECTOR)).slice(
      0,
      CONFIG.maxCandidatesPerPost,
    );
  }

  function detectHighConfidenceSignals(post) {
    const hits = [];

    for (const node of candidateElements(post)) {
      const hit = classifySignal(node, post);

      if (hit) {
        hits.push({ ...hit, node });
      }
    }

    const visualHit = visualMetadataSignal(post);
    if (visualHit) {
      hits.push(visualHit);
    }

    const renderedHit = renderedMetadataSignal(post);
    if (renderedHit) {
      hits.push(renderedHit);
    }

    if (hits.length === 0) return null;

    return {
      confidence: "high",
      reasons: [...new Set(hits.map((hit) => hit.reason))],
      nodes: hits.map((hit) => hit.node),
    };
  }

  function linkPath(link) {
    const href = link.getAttribute("href") ?? "";
    if (!href || href === "#") return "";

    try {
      return new URL(href, location.origin).pathname;
    } catch {
      return href
        .replace(/^[a-z]+:\/\/[^/]*/i, "")
        .split(/[?#]/)[0] || "/";
    }
  }

  function hasPermalink(post) {
    for (const link of post.querySelectorAll("a[href]")) {
      if (PERMALINK_RE.test(linkPath(link))) return true;
    }

    return false;
  }

  function isOutboundLink(link) {
    const href = link.getAttribute("href") ?? "";
    if (!href || href.startsWith("#")) return false;

    if (linkPath(link) === "/l.php") return true;

    try {
      const url = new URL(href, location.origin);
      return !/(^|\.)(facebook\.com|fb\.com|fbcdn\.net)$/i.test(
        url.hostname,
      );
    } catch {
      return false;
    }
  }

  function hasOutboundLink(post) {
    return Array.from(post.querySelectorAll("a[href]")).some(isOutboundLink);
  }

  function hasDanglingLabelReference(post) {
    for (const element of post.querySelectorAll("[aria-labelledby]")) {
      const ids = (element.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .filter(Boolean);

      for (const id of ids) {
        const target = document.getElementById(id);
        const text = target
          ? cleanText(target.textContent)
          : labelTextById.get(id);

        if (!text) return true;
      }
    }

    return false;
  }

  function detectShapeCandidate(post) {
    if (!looksLikePost(post)) return null;
    if (hasPermalink(post)) return null;

    const dangling = hasDanglingLabelReference(post);
    const outbound = hasOutboundLink(post);

    if (!dangling && !outbound) return null;

    debugState.shapeCandidates += 1;

    const reasons = [];

    if (dangling) reasons.push("shape-dangling-label-no-permalink");
    if (outbound) reasons.push("shape-outbound-no-permalink");

    return {
      confidence: "medium",
      reasons,
      nodes: [post],
    };
  }

  function inspectPost(post) {
    if (!(post instanceof Element) || !isFeedPost(post)) return;

    if (post.getAttribute(SEEN_ATTR) !== "true") {
      post.setAttribute(SEEN_ATTR, "true");
      debugState.scanned += 1;
    }

    const high = detectHighConfidenceSignals(post);

    if (high) {
      markDetected(post, high);
      updateDebugBadge();
      return;
    }

    // Cheap fallback: evaluated only on the feed post already being inspected.
    // No document-wide sweep and no extra timer.
    const shape = detectShapeCandidate(post);

    if (shape) {
      markDetected(post, shape);
    }

    updateDebugBadge();
  }

  function enqueuePost(post) {
    if (!post || !isFeedPost(post)) return;

    pendingPosts.add(post);

    if (flushScheduled) return;

    flushScheduled = true;

    requestAnimationFrame(() => {
      flushScheduled = false;

      const posts = Array.from(pendingPosts);
      pendingPosts.clear();

      for (const post of posts) {
        if (post.isConnected) inspectPost(post);
      }
    });
  }

  function enqueueFromNode(node) {
    if (!(node instanceof Element)) return;

    if (node.matches(POST_SELECTOR) && isFeedPost(node)) {
      enqueuePost(node);
    }

    const ownPost = resolvePostContainer(node);
    if (ownPost) enqueuePost(ownPost);

    for (const post of node.querySelectorAll(POST_SELECTOR)) {
      if (isFeedPost(post)) enqueuePost(post);
    }
  }

  function scanExistingFeed() {
    for (const post of document.querySelectorAll(POST_SELECTOR)) {
      if (isFeedPost(post)) enqueuePost(post);
    }
  }

  function sweepShapeCandidates() {
    // Disabled in v0.1.10 stability hotfix. Shape heuristics are intentionally
    // deferred until high-confidence detection is proven fast on the live feed.
  }

  function handleRemovedNode(node, mutationTarget) {
    if (node instanceof Element) {
      cacheLabelTargets(node);
      return;
    }

    if (node.nodeType !== Node.TEXT_NODE) return;
    if (!(mutationTarget instanceof Element)) return;
    if (!mutationTarget.id) return;

    if (
      cacheLabelText(
        mutationTarget.id,
        node.textContent,
        mutationTarget,
      )
    ) {
      debugState.rescuedLabels += 1;
    }
  }

  function handleAddedNode(node, mutationTarget) {
    if (node instanceof Element) {
      cacheLabelTargets(node);
      enqueueFromNode(node);

      requestAnimationFrame(() => {
        if (node.isConnected) scanLabelRoot(node);
      });

      return;
    }

    if (node.nodeType !== Node.TEXT_NODE) return;

    const parent =
      node.parentElement ||
      (mutationTarget instanceof Element ? mutationTarget : null);

    if (!parent) return;

    if (parent.id) {
      if (cacheLabelText(parent.id, parent.textContent, parent)) {
        debugState.lateTextLabels += 1;
      }
    }

    processSignalElement(parent);

    const post = resolvePostContainer(parent);
    if (post) enqueuePost(post);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        handleRemovedNode(node, mutation.target);
      }

      for (const node of mutation.addedNodes) {
        handleAddedNode(node, mutation.target);
      }

      if (mutation.target instanceof Element) {
        const post = resolvePostContainer(mutation.target);
        if (post) enqueuePost(post);
      }
    }

    sweepShapeCandidates();
    updateDebugBadge();
  });

  function start() {
    const root = document.body || document.documentElement;

    cacheLabelTargets(root);
    scanLabelRoot(root);
    scanExistingFeed();

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.__fbokDebug = Object.freeze({
      version: VERSION,
      rescan() {
        const root = document.body || document.documentElement;
        scanLabelRoot(root);
        scanExistingFeed();
      },
      scannedCount() {
        return debugState.scanned;
      },
      detectedCount() {
        return debugState.hits;
      },
      detectedPosts() {
        return Array.from(
          document.querySelectorAll(
            `[${DETECTED_ATTR}="true"]`,
          ),
        ).map((post) => ({
          reason: post.getAttribute(REASON_ATTR),
          confidence: post.getAttribute(CONFIDENCE_ATTR),
          post,
        }));
      },
      diagnostics() {
        return {
          ...debugState,
          cachedLabels: labelTextById.size,
          pendingSignals: pendingSignals.size,
        };
      },
    });

    if (CONFIG.debug) {
      console.debug(
        `[fbok] v${VERSION} lifecycle-aware detector active`,
      );
    }

    updateDebugBadge(true);
  }

  start();
})();
