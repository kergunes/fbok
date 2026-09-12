(() => {
  "use strict";

  const CONFIG = Object.freeze({
    debug: true,
    maxCandidatesPerPost: 240,
    metadataMaxPixelsFromTop: 220,
    metadataMaxFractionOfPost: 0.35,
  });

  const LABELS = new Set(["sponsored", "sponsorlu"]);
  const DETECTED_ATTR = "data-fbok-detected";
  const REASON_ATTR = "data-fbok-reason";
  const CONFIDENCE_ATTR = "data-fbok-confidence";

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

  function isFeedPost(post) {
    if (!(post instanceof Element)) return false;
    if (!(post.matches('[role="article"]') || post.matches("article"))) return false;
    return Boolean(post.closest('[role="feed"]'));
  }

  function resolvePostContainer(node) {
    if (!(node instanceof Element)) return null;

    const post = node.closest('[role="article"], article');
    return post && isFeedPost(post) ? post : null;
  }

  function isLikelyMetadataNode(node, post) {
    if (!(node instanceof Element) || !isElementVisible(node)) return false;

    const nodeRect = node.getBoundingClientRect();
    const postRect = post.getBoundingClientRect();

    if (postRect.width <= 0 || postRect.height <= 0) return false;

    const offsetFromTop = nodeRect.top - postRect.top;
    const maxOffset = Math.min(
      CONFIG.metadataMaxPixelsFromTop,
      Math.max(120, postRect.height * CONFIG.metadataMaxFractionOfPost),
    );

    return offsetFromTop >= -8 && offsetFromTop <= maxOffset;
  }

  function collectVisibleText(root) {
    if (!(root instanceof Element)) return "";

    let result = "";
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(textNode) {
        const parent = textNode.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        return isElementVisible(parent)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      result += node.textContent ?? "";
      if (result.length > 80) break;
    }

    return result;
  }

  function candidateElements(post, selector) {
    return Array.from(post.querySelectorAll(selector)).slice(
      0,
      CONFIG.maxCandidatesPerPost,
    );
  }

  function detectAccessibilityLabel(post) {
    const nodes = candidateElements(post, "[aria-label], [title]");

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
    }

    return null;
  }

  function detectSvgAccessibility(post) {
    const nodes = candidateElements(
      post,
      'svg[aria-label], [role="img"][aria-label], svg title',
    );

    for (const node of nodes) {
      const signalNode = node.matches("title") ? node.parentElement : node;
      if (!signalNode || !isLikelyMetadataNode(signalNode, post)) continue;

      const value = node.matches("title")
        ? node.textContent
        : node.getAttribute("aria-label");

      if (value && isSponsoredLabel(value)) {
        return { reason: "svg-accessibility", node: signalNode, confidence: "high" };
      }
    }

    return null;
  }

  function detectVisibleExactText(post) {
    const nodes = candidateElements(post, "span, a, div[role='button']");

    for (const node of nodes) {
      if (node.children.length > 0) continue;
      if (!isLikelyMetadataNode(node, post)) continue;

      const text = node.textContent ?? "";
      if (text.length <= 32 && isSponsoredLabel(text)) {
        return { reason: "visible-text", node, confidence: "high" };
      }
    }

    return null;
  }

  function detectReconstructedVisibleText(post) {
    const nodes = candidateElements(post, "span, a, div[role='button']");

    for (const node of nodes) {
      if (node.children.length === 0) continue;
      if (!isLikelyMetadataNode(node, post)) continue;

      const rawText = node.textContent ?? "";
      if (rawText.length > 96) continue;

      const visibleText = collectVisibleText(node);
      if (visibleText.length <= 48 && isSponsoredLabel(visibleText)) {
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
    detectAccessibilityLabel,
    detectSvgAccessibility,
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

  function markDetected(post, detection) {
    if (post.getAttribute(DETECTED_ATTR) === "true") return;

    post.setAttribute(DETECTED_ATTR, "true");
    post.setAttribute(REASON_ATTR, detection.reasons.join(", "));
    post.setAttribute(CONFIDENCE_ATTR, detection.confidence);

    if (CONFIG.debug) {
      console.debug("[fbok] Sponsored post candidate", {
        reasons: detection.reasons,
        confidence: detection.confidence,
        post,
      });
    }
  }

  function inspectPost(post) {
    if (!(post instanceof Element)) return;
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

    const ownPost = resolvePostContainer(node);
    if (ownPost) enqueuePost(ownPost);

    for (const post of node.querySelectorAll(
      '[role="feed"] [role="article"], [role="feed"] article',
    )) {
      enqueuePost(post);
    }
  }

  function scanExistingFeed() {
    for (const post of document.querySelectorAll(
      '[role="feed"] [role="article"], [role="feed"] article',
    )) {
      enqueuePost(post);
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
      version: "0.1.0",
      rescan: scanExistingFeed,
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
      console.debug("[fbok] v0.1 debug detector active");
    }
  }

  start();
})();
