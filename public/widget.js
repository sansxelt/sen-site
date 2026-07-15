/* Vraelis embeddable lead chat widget — RETIRED.
 *
 * This mounted the lead-agent chat/intake widget, part of a product Vraelis no longer offers. The loader is
 * now a safe no-op: it mounts nothing, so any site still including the old
 *   <script src="https://vraelis.com/widget.js" data-vraelis-key="vk_..."></script>
 * tag renders nothing instead of a live retired widget. The file is preserved (not deleted) so those old
 * tags resolve with 200 rather than 404. Vraelis is now production verification for AI-built systems —
 * see https://vraelis.com.
 */
(function () {
  try {
    if (document.querySelector("script[data-vraelis-key]")) {
      (window.console && console.info) && console.info("[Vraelis] The embeddable lead widget is retired and no longer renders. See https://vraelis.com");
    }
  } catch (e) { /* never throw into a host page */ }
})();
