(() => {
  "use strict";

  const VERSION = "0.1.8";
  const CONFIG = Object.freeze({
    debug: true,
    maxCandidatesPerPost: 420,
    metadataMaxPixelsFromTop: 260,
    metadataMaxFractionOfPost: 0.4,
    labelCacheLimit: 200,
  });

  const SPONSORED_LABELS = new Set(["sponsored", "sponsorlu", "ad"]);
  const POST_SELECTOR =
    '[data-pagelet^="FeedUnit"], [aria-posinset], [role="article"], article';
  const LABEL_SELECTOR =
    'span, a, use, text, [aria-label], [aria-labelledby], [role="button"]';

  const DETECTED_ATTR = "data-fbok-detected";
  const REASON_ATTR = "data-fbok-reason";
  const CONFIDENCE_ATTR = "data-fbok-confidence";
  const SEEN_ATTR = "data-fbok-seen";

  const INVISIBLE_CHARS_RE = /[\p{Cf}\p{Mn}\p{Co}]/gu;
  const PERMALINK_RE =
    /\/(posts|permalink|permalink\.php|story\.php|videos|video\.php|watch|photo|photo\.php|photos|reel|reels|groups|events|notes|share|media\/set|commerce\/listing|marketplace\/item)([\/?]|$)/i;

  const pendingPosts = new Set();
  const labelTextById = new Map();
  let flushScheduled = false;

  const debugState = {
    scanned: 0,
    hits: 0,
    highHits: 0,
    mediumHits: 0,
    cachedLabels: 0,
    danglingCandidates: 0,
    outboundCandidates: 0,
    roleShapeCandidates: 0,
    labelElementsScanned: 0,
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

  function isTopLevelPositionedItem(post) {
    if (!post.hasAttribute("aria-posinset")) return false;

    const position = Number.parseInt(post.getAttribute("aria-posinset") ?? "", 10);
    if (!Number.isFinite(position) || position < 1) return false;

    const positionedAncestor = post.parentElement?.closest("[aria-posinset]");
    if (positionedAncestor) return false;

    if (!post.closest('[role="main"]')) return false;
    if (
      post.closest(
        '[role="dialog"], [role="navigation"], [role="complementary"]',
      )
    ) {
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

  function resolvePostContainer(node) {
    if (!(node instanceof Element)) return null;

    let candidate = node.closest(POST_SELECTOR);
    while (candidate) {
      if (isFeedPost(candidate)) return candidate;
      candidate = candidate.parentElement?.closest(POST_SELECTOR) ?? null;
    }

    return null;
  }

  function isLikelyMetadataNode(node, post) {
    if (!(node instanceof Element) || !isElementVisible(node)) return false;

    const nodeRect = node.getBoundingClientRect();
    const postRect = post.getBoundingClientRect();
    if (postRect.width <= 0 || postRect.height <= 0) return false;

    const offsetFromTop = nodeRect.top - postRect.top;
    const maxOffset = Math.min(
      CONFIG.metadataMaxPixelsFromTop,
      Math.max(130, postRect.height * CONFIG.metadataMaxFractionOfPost),
    );

    return offsetFromTop >= -8 && offsetFromTop <= maxOffset;
  }

  function rememberLabelText(id, rawText) {
    if (!id) return;

    const text = cleanText(rawText);
    if (!text || text.length > 40) return;

    if (!labelTextById.has(id) && labelTextById.size >= CONFIG.labelCacheLimit) {
      labelTextById.delete(labelTextById.keys().next().value);
    }

    labelTextById.set(id, text);
    debugState.cachedLabels = labelTextById.size;

    if (isSponsoredLabel(text)) {
      resolveCachedLabelReferrer(id);
    }
  }

  function cacheLabelTargets(node) {
    if (!(node instanceof Element)) return;

    if (node.id) rememberLabelText(node.id, node.textContent);

    for (const element of node.querySelectorAll("[id]")) {
      rememberLabelText(element.id, element.textContent);
    }
  }

  function referencedLabelText(node) {
    const ids = (node.getAttribute("aria-labelledby") ?? "")
      .split(/\s+/)
      .filter(Boolean);

    const values = [];

    for (const id of ids) {
      const target = document.getElementById(id);
      const text = target ? cleanText(target.textContent) : labelTextById.get(id);
      if (text) values.push(text);
    }

    return values;
  }

  function resolveCachedLabelReferrer(id) {
    if (!id || typeof CSS === "undefined" || !CSS.escape) return;

    const escaped = CSS.escape(id);
    const referrer =
      document.querySelector(`[aria-labelledby~="${escaped}"]`) ||
      document.querySelector(`use[*|href="#${escaped}"]`);

    if (!referrer) return;

    const post = resolvePostContainer(referrer);
    if (post) enqueuePost(post);
  }

  function svgReference(useElement) {
    return (
      useElement.getAttribute("href") ||
      useElement.getAttribute("xlink:href") ||
      useElement.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
      ""
    );
  }

  function classifyStructuredLabel(node, post) {
    if (!(node instanceof Element)) return null;

    const ariaLabel = node.getAttribute("aria-label");
    if (ariaLabel && /sponsored content$/i.test(cleanText(ariaLabel))) {
      return { reason: "accessibility-sponsored-content", confidence: "high" };
    }

    if (ariaLabel && isSponsoredLabel(ariaLabel) && isLikelyMetadataNode(node, post)) {
      return { reason: "accessibility-label", confidence: "high" };
    }

    const title = node.getAttribute("title");
    if (title && isSponsoredLabel(title) && isLikelyMetadataNode(node, post)) {
      return { reason: "title-label", confidence: "high" };
    }

    if (node.tagName.toLowerCase() === "use") {
      const ref = svgReference(node);
      if (ref.startsWith("#") && ref.length > 1) {
        const id = ref.slice(1);
        const target = document.getElementById(id);
        const text = target ? cleanText(target.textContent) : labelTextById.get(id);

        if (text && isSponsoredLabel(text)) {
          return { reason: "svg-sprite-ref", confidence: "high" };
        }
      }
    }

    const labelledByValues = referencedLabelText(node);
    if (
      labelledByValues.some(isSponsoredLabel) &&
      isLikelyMetadataNode(node, post)
    ) {
      return { reason: "aria-labelledby-ref", confidence: "high" };
    }

    if (node.tagName.toLowerCase() === "a") {
      const href = (node.getAttribute("href") ?? "").toLocaleLowerCase();
      if (
        href.includes("/ads/about") ||
        href.includes("why_am_i_seeing_this_ad")
      ) {
        return { reason: "ads-about-link", confidence: "high" };
      }
    }

    return null;
  }

  function collectOrderedLeaves(root, depth = 0) {
    if (!(root instanceof Element) || depth > 4) return [];

    const ordered = Array.from(root.childNodes).map((child, index) => {
      let order = index;
      let hidden = false;

      if (child instanceof Element) {
        const style = getComputedStyle(child);
        const parsed = Number.parseInt(style.order, 10);
        if (Number.isFinite(parsed)) order = parsed;
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
        leaves.push({ text: child.textContent ?? "", classCount: null });
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

  function characterSplitVariants(root) {
    const children = root.children;
    if (children.length < 4 || children.length > 120) return [];

    let leafish = 0;
    for (const child of children) {
      if (
        child.tagName === "SPAN" &&
        child.children.length === 0 &&
        cleanText(child.textContent).length <= 1
      ) {
        leafish += 1;
      }
    }

    if (leafish < Math.ceil(children.length * 0.65)) return [];

    const leaves = collectOrderedLeaves(root);
    if (leaves.length === 0) return [];

    const assemble = (keep) =>
      cleanText(
        leaves
          .filter(
            (leaf) => leaf.classCount === null || keep(leaf.classCount),
          )
          .map((leaf) => leaf.text)
          .join(""),
      );

    return [
      assemble(() => true),
      assemble((count) => count > 10),
      assemble((count) => count <= 10),
    ].filter(Boolean);
  }

  function classifyTextLabel(node, post) {
    if (!(node instanceof Element) || !isLikelyMetadataNode(node, post)) {
      return null;
    }

    if (node.children.length === 0) {
      const text = cleanText(node.textContent);
      if (text.length <= 40 && isSponsoredLabel(text)) {
        return { reason: "visible-text", confidence: "high" };
      }
    }

    const direct = ownText(node);
    if (direct && direct.length <= 40 && isSponsoredLabel(direct)) {
      return { reason: "own-text-label", confidence: "high" };
    }

    for (const variant of characterSplitVariants(node)) {
      if (isSponsoredLabel(variant)) {
        return { reason: "visible-text-reconstructed", confidence: "high" };
      }
    }

    return null;
  }

  function candidateElements(post) {
    return Array.from(post.querySelectorAll(LABEL_SELECTOR)).slice(
      0,
      CONFIG.maxCandidatesPerPost,
    );
  }

  function detectLabelSignals(post) {
    const hits = [];

    for (const node of candidateElements(post)) {
      debugState.labelElementsScanned += 1;

      const structured = classifyStructuredLabel(node, post);
      if (structured) {
        hits.push({ ...structured, node });
        continue;
      }

      const text = classifyTextLabel(node, post);
      if (text) hits.push({ ...text, node });
    }

    return hits;
  }

  function linkPath(link) {
    const href = link.getAttribute("href") ?? "";
    if (!href || href === "#") return "";

    try {
      return new URL(href, location.origin).pathname;
    } catch {
      return href.replace(/^[a-z]+:\/\/[^/]*/i, "").split(/[?#]/)[0] || "/";
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
      return !/(^|\.)facebook\.com$/i.test(url.hostname);
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
        const cached = labelTextById.get(id);
        const text = target ? cleanText(target.textContent) : cached;

        if (!text) return true;
      }
    }

    return false;
  }

  function hasAdRoleShape(post) {
    return Boolean(
      post.querySelector('[data-ad-rendering-role="profile_name"]') &&
        post.querySelector('[data-ad-rendering-role="story_message"]') &&
        post.querySelector('[data-ad-rendering-role^="cta-"]'),
    );
  }

  function looksLikePost(post) {
    const text = cleanText(post.textContent);
    if (text.length < 40) return false;

    let storyLinks = 0;
    for (const link of post.querySelectorAll('a[href*="/stories/"]')) {
      storyLinks += 1;
      if (storyLinks > 1) return false;
    }

    return true;
  }

  function detectUnlabeledShape(post) {
    if (!looksLikePost(post)) return null;
    if (hasPermalink(post)) return null;

    const dangling = hasDanglingLabelReference(post);
    const outbound = hasOutboundLink(post);
    const roleShape = hasAdRoleShape(post);

    if (dangling) debugState.danglingCandidates += 1;
    if (outbound) debugState.outboundCandidates += 1;
    if (roleShape) debugState.roleShapeCandidates += 1;

    if (!dangling && !outbound && !roleShape) return null;

    const reasons = [];
    if (dangling) reasons.push("dangling-label-no-permalink");
    if (outbound) reasons.push("outbound-no-permalink");
    if (roleShape) reasons.push("ad-role-shape");

    return {
      reasons,
      confidence:
        (dangling && outbound) || (outbound && roleShape) ? "high" : "medium",
      nodes: [post],
    };
  }

  function detectSponsored(post) {
    if (!isFeedPost(post)) return null;

    const labelHits = detectLabelSignals(post);

    if (labelHits.length > 0) {
      return {
        confidence: "high",
        reasons: [...new Set(labelHits.map((hit) => hit.reason))],
        nodes: labelHits.map((hit) => hit.node),
      };
    }

    return detectUnlabeledShape(post);
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
    const detected = document.querySelectorAll(
      `[${DETECTED_ATTR}="true"]`,
    ).length;

    debugState.scanned = scanned;
    debugState.hits = detected;

    badge.textContent =
      `fbok ${VERSION} · scanned ${scanned} · hits ${detected}` +
      ` · H/M ${debugState.highHits}/${debugState.mediumHits}` +
      ` · cache ${debugState.cachedLabels}`;
  }

  function markDetected(post, detection) {
    const wasDetected = post.getAttribute(DETECTED_ATTR) === "true";

    post.setAttribute(DETECTED_ATTR, "true");
    post.setAttribute(REASON_ATTR, detection.reasons.join(", "));
    post.setAttribute(CONFIDENCE_ATTR, detection.confidence);

    if (!wasDetected) {
      if (detection.confidence === "high") debugState.highHits += 1;
      else debugState.mediumHits += 1;
    }

    if (CONFIG.debug) {
      console.debug("[fbok] Sponsored post candidate", {
        reasons: detection.reasons,
        confidence: detection.confidence,
        post,
      });
    }

    updateDebugBadge();
  }

  function inspectPost(post) {
    if (!(post instanceof Element) || !isFeedPost(post)) return;

    post.setAttribute(SEEN_ATTR, "true");

    const detection = detectSponsored(post);
    if (detection) markDetected(post, detection);

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
      for (const removedNode of mutation.removedNodes) {
        if (removedNode instanceof Element) cacheLabelTargets(removedNode);
      }

      for (const addedNode of mutation.addedNodes) {
        if (addedNode instanceof Element) {
          cacheLabelTargets(addedNode);
          enqueueFromNode(addedNode);
        }
      }

      if (mutation.target instanceof Element) {
        const changedPost = resolvePostContainer(mutation.target);
        if (changedPost) enqueuePost(changedPost);
      }
    }
  });

  function start() {
    cacheLabelTargets(document.documentElement);
    scanExistingFeed();

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.__fbokDebug = Object.freeze({
      version: VERSION,
      rescan: scanExistingFeed,
      scannedCount() {
        return document.querySelectorAll(`[${SEEN_ATTR}="true"]`).length;
      },
      detectedCount() {
        return document.querySelectorAll(
          `[${DETECTED_ATTR}="true"]`,
        ).length;
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
      diagnostics() {
        return {
          ...debugState,
          cachedLabels: labelTextById.size,
        };
      },
    });

    if (CONFIG.debug) {
      console.debug(`[fbok] v${VERSION} research-aligned detector active`);
    }

    updateDebugBadge();
  }

  start();
})();
