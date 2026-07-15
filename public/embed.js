/* Vraelis embed loader — RETIRED.
 *
 * This loaded the embeddable human-evaluation voting widget, which is part of a product Vraelis no longer
 * offers. The loader is now a safe no-op: it mounts nothing, so any site still including the old
 *   <script async src="https://vraelis.com/embed.js" data-vraelis-test="..."></script>
 * tag simply renders nothing instead of a broken iframe. The file is preserved (not deleted) so those old
 * script tags resolve with 200 rather than 404. Vraelis is now production verification for AI-built systems —
 * see https://vraelis.com.
 */
(function () {
  try {
    if (document.querySelector("script[data-vraelis-test]")) {
      // One quiet console note for any developer still shipping the old snippet; no UI is rendered.
      (window.console && console.info) && console.info("[Vraelis] The embeddable evaluation widget is retired and no longer renders. See https://vraelis.com");
    }
  } catch (e) { /* never throw into a host page */ }
})();
