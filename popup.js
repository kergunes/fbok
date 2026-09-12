(() => {
  "use strict";

  const toggle = document.getElementById("suggested-toggle");
  const status = document.getElementById("status");

  chrome.storage.sync.get({ hideSuggested: true }, (settings) => {
    toggle.checked = Boolean(settings.hideSuggested);
  });

  toggle.addEventListener("change", () => {
    chrome.storage.sync.set({ hideSuggested: toggle.checked }, () => {
      status.textContent = toggle.checked
        ? "Suggested-post filter enabled."
        : "Suggested-post filter disabled.";
    });
  });
})();
