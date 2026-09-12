(() => {
  "use strict";

  const toggle = document.getElementById("suggested-toggle");
  const debugToggle = document.getElementById("debug-toggle");
  const status = document.getElementById("status");

  chrome.storage.sync.get({ hideSuggested: true, debugInfo: true }, (settings) => {
    toggle.checked = Boolean(settings.hideSuggested);
    debugToggle.checked = Boolean(settings.debugInfo);
  });

  toggle.addEventListener("change", () => {
    chrome.storage.sync.set({ hideSuggested: toggle.checked }, () => {
      status.textContent = toggle.checked
        ? "Suggested-post filter enabled."
        : "Suggested-post filter disabled.";
    });
  });

  debugToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ debugInfo: debugToggle.checked }, () => {
      status.textContent = debugToggle.checked
        ? "Debug info enabled."
        : "Debug info hidden.";
    });
  });
})();
