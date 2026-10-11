// Inline scripts and their constants, kept out of the client modules: a server layout that imports a constant from a
// "use client" file receives a client reference, not the string, so the script would never run.
export const INTRO_STYLE_ID = "v8-intro-pending";
// 76px is the measured travel for Manrope 600 at 21px; the component corrects it once fonts are ready.
export const INTRO_SCRIPT = `(function(){try{if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;var s=document.createElement("style");s.id="${INTRO_STYLE_ID}";s.textContent=".v8 .v8-brand__word{opacity:1}.v8 .v8-nav{transform:translateX(var(--v8-shift,76px))}";document.head.appendChild(s);setTimeout(function(){if(s.parentNode)s.parentNode.removeChild(s)},7000)}catch(e){}})();`;
export const THEME_STYLE_ID = "v8-theme-light";
export const THEME_KEY = "vraelis-theme";
export const LIGHT_TOKENS = ".v8{--ground:#FFFFFF;--s1:#F6F6F7;--s2:#EEEEF0;--s3:#E4E4E7;--ink:#0A0A0B;--ink-2:rgba(10,10,11,.8);--ink-3:rgba(10,10,11,.62);--ink-4:rgba(10,10,11,.46);--line:rgba(10,10,11,.08);--line-2:rgba(10,10,11,.13);--line-3:rgba(10,10,11,.24);--glass:rgba(255,255,255,.84);--panel:rgba(255,255,255,.98);--fade:rgba(246,246,247,.94);--stage:#F2F2F5;--solid-hover:#2A2A2E;--go:#11845B;--wait:#9A6700;--stop:#C2410C;color-scheme:light}.v8 ::selection{background:#0A0A0B;color:#FAFAFA}";
export const THEME_SCRIPT = `(function(){try{var t=null;try{t=sessionStorage.getItem("${THEME_KEY}")}catch(e){}if(!t){try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}}if(!t&&matchMedia("(prefers-color-scheme: light)").matches)t="light";if(t==="light"){var s=document.createElement("style");s.id="${THEME_STYLE_ID}";s.textContent=${JSON.stringify(LIGHT_TOKENS)};document.head.appendChild(s)}}catch(e){}})();`;
