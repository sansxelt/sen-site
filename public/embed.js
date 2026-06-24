/* Vraelis embedded evaluation widget loader.
 * Usage on any site:
 *   <script async src="https://vraelis.com/embed.js" data-vraelis-test="TEST_ID"></script>
 * Replaces the script tag with a responsive iframe of the evaluation widget.
 */
(function () {
  var ORIGIN = "https://vraelis.com";

  function mount(el) {
    if (el.getAttribute("data-vraelis-mounted")) return;
    var testId = el.getAttribute("data-vraelis-test");
    if (!testId) return;
    el.setAttribute("data-vraelis-mounted", "1");

    var iframe = document.createElement("iframe");
    iframe.src = ORIGIN + "/embed/vote/" + encodeURIComponent(testId);
    iframe.title = "Vraelis — evaluate";
    iframe.loading = "lazy";
    iframe.setAttribute("scrolling", "no");
    iframe.style.cssText = "width:100%;max-width:440px;height:520px;border:0;border-radius:14px;display:block;";
    (el.parentNode || document.body).insertBefore(iframe, el.nextSibling);

    window.addEventListener("message", function (e) {
      if (e.origin !== ORIGIN || !e.data || e.data.type !== "vraelis:height") return;
      if (e.data.test === testId && typeof e.data.height === "number") {
        iframe.style.height = Math.max(280, e.data.height) + "px";
      }
    });
  }

  function init() {
    var nodes = document.querySelectorAll("script[data-vraelis-test]");
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
