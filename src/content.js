(() => {
  "use strict";

  const CONFIG = Object.freeze({
    debug: true,
    maxCandidatesPerPost: 260,
    metadataMaxPixelsFromTop: 240,
    metadataMaxFractionOfPost: 0.38,
  });

  const LABELS = new Set(["sponsored", "sponsorlu"]);
  const SHORT_VISIBLE_LABELS = new Set(["ad"]);
  const POST_SELECTOR = '[data-pagelet^="FeedUnit"], [aria-posinset], [role="article"], article';
  const DETECTED_ATTR = "data-fbok-detected";
  const REASON_ATTR = "data-fbok-reason";
  const CONFIDENCE_ATTR = "data-fbok-confidence";
  const SEEN_ATTR = "data-fbok-seen";

  const pendingPosts = new Set();
  let flushScheduled = false;

  function normalizeLabel(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "");
  }

  function isSponsoredLabel(value) {
    return LABELS.has(normalizeLabel(value));
  }

  function isShortVisibleAdLabel(value) {
    return SHORT_VISIBLE_LABELS.has(normalizeLabel(value));
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

  function isTopLevelPositionedItem(post) {
    if (!post.hasAttribute("aria-posinset")) return false;

    const position = Number.parseInt(post.getAttribute("aria-posinset") ?? "", 10);
    if (!Number.isFinite(position) || position < 1) return false;

    const positionedAncestor = post.parentElement?.closest("[aria-posinset]");
    if (positionedAncestor) return false;

    if (!post.closest('[role="main"]')) return false;
    if (post.closest('[role="dialog"], [role="navigation"], [role="complementary"]')) {
      return false;
    }

    return true;
  }

  function isPageletFeedUnit(post) {
    if (!post.matches('[data-pagelet^="FeedUnit"]')) return false;
    if (!post.closest('[role="main"]')) return false;
    return !post.closest('[role="dialog"], [role="complementary"]');
  }

  function isLegacyFeedArticle(post) {
    if (!(post.matches('[role="article"]') || post.matches("article"))) return false;
    return Boolean(post.closest('[role="feed"]'));
  }

  function isFeedPost(post) {
    if (!(post instanceof Element)) return false;
    return (
      isPageletFeedUnit(post) ||
      isTopLevelPositionedItem(post) ||
      isLegacyFeedArticle(post)
    );
  }

  function resolvePostContainer(node) {
    if (!(node instanceof Element)) return null;

    let candidate = node.closest(POST_SELECTOR);
    while (candidate) {
      if (isFeedPost(candidate)) return candidate;
      candidate = candidate.parentElement?.closest(POST_SELECTOR) ?? null;
    }

    return null;
  }

  function firstAuthorHeading(post) {
    return post.querySelector(
      'h1, h2, h3, h4, [role="heading"][aria-level="1"], [role="heading"][aria-level="2"], [role="heading"][aria-level="3"], [role="heading"][aria-level="4"]',
    );
  }

  function isLikelyMetadataNode(node, post, requireAuthorProximity = false) {
    if (!(node instanceof Element) || !isElementVisible(node)) return false;

    const nodeRect = node.getBoundingClientRect();
    const postRect = post.getBoundingClientRect();
    if (postRect.width <= 0 || postRect.height <= 0) return false;

    const offsetFromTop = nodeRect.top - postRect.top;
    const maxOffset = Math.min(
      CONFIG.metadataMaxPixelsFromTop,
      Math.max(120, postRect.height * CONFIG.metadataMaxFractionOfPost),
    );

    if (offsetFromTop < -8 || offsetFromTop > maxOffset) return false;
    if (!requireAuthorProximity) return true;

    const heading = firstAuthorHeading(post);
    if (!heading || !isElementVisible(heading)) return false;

    const headingRect = heading.getBoundingClientRect();
    return (
      nodeRect.top >= headingRect.top - 24 &&
      nodeRect.top <= headingRect.bottom + 100
    );
  }

  function candidateElements(post, selector) {
    return Array.from(post.querySelectorAll(selector)).slice(
      0,
      CONFIG.maxCandidatesPerPost,
    );
  }

  function referencedText(node) {
    const ids = (node.getAttribute("aria-labelledby") ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const values = [];

    for (const id of ids) {
      const target = document.getElementById(id);
      if (!target) continue;

      values.push(target.getAttribute("aria-label") ?? "");
      values.push(target.getAttribute("title") ?? "");
      values.push(target.textContent ?? "");
    }

    return values;
  }

  function detectAccessibilityLabel(post) {
    const nodes = candidateElements(post, "[aria-label], [title], [aria-labelledby]");

    for (const node of nodes) {
      if (!isLikelyMetadataNode(node, post)) continue;

      const ariaLabel = node.getAttribute("aria-label");
      if (ariaLabel && isSponsoredLabel(ariaLabel)) {
        return { reason: "accessibility-label", node, confidence: "high" };
      }

      const title = node.getAttribute("title");
      if (title && isSponsoredLabel(title)) {
        return { reason: "title-label", node, confidence: "high" };
      }

      for (const value of referencedText(node)) {
        if (isSponsoredLabel(value)) {
          return { reason: "aria-labelledby-ref", node, confidence: "high" };
        }
      }
    }

    return null;
  }

  function svgReference(useElement) {
    return (
      useElement.getAttribute("href") ||
      useElement.getAttribute("xlink:href") ||
      useElement.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
      ""
    );
  }

  function detectSvgSprite(post) {
    const uses = candidateElements(post, "svg use, use");

    for (const useElement of uses) {
      const svg = useElement.closest("svg") ?? useElement;
      if (!isLikelyMetadataNode(svg, post)) continue;

      const reference = svgReference(useElement);
      if (!reference.startsWith("#") || reference.length < 2) continue;

      const target = document.getElementById(reference.slice(1));
      if (!target) continue;

      const accessibleValues = [
        target.getAttribute("aria-label"),
        target.getAttribute("title"),
        target.textContent,
      ];

      if (accessibleValues.some((value) => value && isSponsoredLabel(value))) {
        return { reason: "svg-sprite-ref", node: svg, confidence: "high" };
      }
    }

    return null;
  }

  function hasNearbyIdentityLink(node, post) {
    let container = node.parentElement;

    for (let depth = 0; container && depth < 5; depth += 1) {
      if (container === post) break;

      const links = Array.from(container.querySelectorAll("a[href]"));
      if (
        links.some((link) => {
          if (!isElementVisible(link)) return false;

          const href = link.getAttribute("href") ?? "";
          if (!href || href.startsWith("#")) return false;

          const rect = link.getBoundingClientRect();
          const nodeRect = node.getBoundingClientRect();

          return (
            Math.abs(rect.top - nodeRect.top) <= 80 &&
            rect.width > 0 &&
            rect.height > 0
          );
        })
      ) {
        return true;
      }

      container = container.parentElement;
    }

    return false;
  }

  function isLikelyShortAdMetadataNode(node, post) {
    if (!(node instanceof Element) || !isElementVisible(node)) return false;

    const nodeRect = node.getBoundingClientRect();
    const postRect = post.getBoundingClientRect();
    if (postRect.width <= 0 || postRect.height <= 0) return false;

    const offsetFromTop = nodeRect.top - postRect.top;

    // Facebook currently renders the short "Ad" label directly below/next to
    // the advertiser identity. Keep this detector intentionally narrow so a
    // body-text occurrence of "ad" cannot hide a normal post.
    if (offsetFromTop < -8 || offsetFromTop > 125) return false;
    if (nodeRect.left < postRect.left - 8 || nodeRect.right > postRect.right + 8) {
      return false;
    }

    return hasNearbyIdentityLink(node, post);
  }

  function detectVisibleExactText(post) {
    const nodes = candidateElements(post, "span, a, div[role='button']");

    for (const node of nodes) {
      if (node.children.length > 0) continue;

      const text = node.textContent ?? "";

      if (
        text.length <= 32 &&
        isLikelyMetadataNode(node, post, true) &&
        isSponsoredLabel(text)
      ) {
        return { reason: "visible-text", node, confidence: "high" };
      }

      if (
        text.length <= 8 &&
        isShortVisibleAdLabel(text) &&
        isLikelyShortAdMetadataNode(node, post)
      ) {
        return { reason: "visible-short-ad-label", node, confidence: "high" };
      }
    }

    return null;
  }

  function isCharacterSplitCandidate(root) {
    const children = Array.from(root.children);
    if (children.length < 4 || children.length > 24) return false;

    const leafSpans = children.filter((child) => {
      if (!(child instanceof HTMLElement) || child.tagName !== "SPAN") return false;
      if (child.childElementCount !== 0) return false;

      const normalized = normalizeLabel(child.textContent ?? "");
      return normalized.length <= 2;
    });

    return leafSpans.length >= Math.ceil(children.length * 0.7);
  }

  function orderedCharacterEntries(root) {
    const entries = [];

    for (const child of root.children) {
      if (!(child instanceof HTMLElement) || child.tagName !== "SPAN") continue;
      if (child.childElementCount !== 0 || !isElementVisible(child)) continue;

      const text = normalizeLabel(child.textContent ?? "");
      if (text.length !== 1) continue;

      const style = getComputedStyle(child);
      const order = Number.parseFloat(style.order);
      const rect = child.getBoundingClientRect();

      entries.push({
        text,
        order: Number.isFinite(order) ? order : 0,
        left: rect.left,
        classCount: child.classList.length,
      });
    }

    const hasDistinctOrder = new Set(entries.map((entry) => entry.order)).size > 1;

    entries.sort((a, b) => {
      if (hasDistinctOrder && a.order !== b.order) return a.order - b.order;
      return a.left - b.left;
    });

    return entries;
  }

  function characterSplitVariants(root) {
    if (!isCharacterSplitCandidate(root)) return [];

    const entries = orderedCharacterEntries(root);
    if (entries.length < 4) return [];

    const variants = [entries.map((entry) => entry.text).join("")];
    const byClassCount = new Map();

    for (const entry of entries) {
      const bucket = byClassCount.get(entry.classCount) ?? [];
      bucket.push(entry.text);
      byClassCount.set(entry.classCount, bucket);
    }

    for (const chars of byClassCount.values()) {
      if (chars.length >= 6) variants.push(chars.join(""));
    }

    return [...new Set(variants)];
  }

  function detectReconstructedVisibleText(post) {
    const nodes = candidateElements(post, "span, a");

    for (const node of nodes) {
      if (!isLikelyMetadataNode(node, post, true)) continue;

      const variants = characterSplitVariants(node);
      if (variants.some(isSponsoredLabel)) {
        return {
          reason: "visible-text-reconstructed",
          node,
          confidence: "high",
        };
      }
    }

    return null;
  }

  const detectors = [
    detectSvgSprite,
    detectAccessibilityLabel,
    detectVisibleExactText,
    detectReconstructedVisibleText,
  ];

  function detectSponsored(post) {
    if (!isFeedPost(post)) return null;

    const hits = [];

    for (const detector of detectors) {
      const hit = detector(post);
      if (hit) hits.push(hit);
    }

    if (hits.length === 0) return null;

    return {
      confidence: "high",
      reasons: [...new Set(hits.map((hit) => hit.reason))],
      nodes: hits.map((hit) => hit.node),
    };
  }

  function updateDebugBadge() {
    if (!CONFIG.debug) return;

    let badge = document.getElementById("fbok-debug-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "fbok-debug-badge";
      document.documentElement.appendChild(badge);
    }

    const scanned = document.querySelectorAll(`[${SEEN_ATTR}="true"]`).length;
    const detected = document.querySelectorAll(`[${DETECTED_ATTR}="true"]`).length;
    badge.textContent = `fbok 0.1.4 · scanned ${scanned} · hits ${detected}`;
  }

  function markDetected(post, detection) {
    post.setAttribute(DETECTED_ATTR, "true");
    post.setAttribute(REASON_ATTR, detection.reasons.join(", "));
    post.setAttribute(CONFIDENCE_ATTR, detection.confidence);

    if (CONFIG.debug) {
      console.debug("[fbok] Sponsored post candidate", {
        reasons: detection.reasons,
        confidence: detection.confidence,
        post,
      });
      updateDebugBadge();
    }
  }

  function inspectPost(post) {
    if (!(post instanceof Element) || !isFeedPost(post)) return;

    post.setAttribute(SEEN_ATTR, "true");
    updateDebugBadge();
    if (post.getAttribute(DETECTED_ATTR) === "true") return;

    const detection = detectSponsored(post);
    if (detection) markDetected(post, detection);
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

      for (const pendingPost of posts) {
        if (pendingPost.isConnected) inspectPost(pendingPost);
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

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.target instanceof Element) {
        const changedPost = resolvePostContainer(mutation.target);
        if (changedPost) enqueuePost(changedPost);
      }

      for (const addedNode of mutation.addedNodes) {
        enqueueFromNode(addedNode);
      }
    }
  });

  function start() {
    scanExistingFeed();

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.__fbokDebug = Object.freeze({
      version: "0.1.4",
      rescan: scanExistingFeed,
      scannedCount() {
        return document.querySelectorAll(`[${SEEN_ATTR}="true"]`).length;
      },
      detectedCount() {
        return document.querySelectorAll(`[${DETECTED_ATTR}="true"]`).length;
      },
      detectedPosts() {
        return Array.from(
          document.querySelectorAll(`[${DETECTED_ATTR}="true"]`),
        ).map((post) => ({
          reason: post.getAttribute(REASON_ATTR),
          confidence: post.getAttribute(CONFIDENCE_ATTR),
          post,
        }));
      },
    });

    if (CONFIG.debug) {
      console.debug("[fbok] v0.1.1 debug detector active");
    }
  }

  start();
})();
