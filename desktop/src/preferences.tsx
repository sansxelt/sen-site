import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_PREFERENCES,
  type DesktopPreferences,
  getPreferences,
  patchPreferences,
} from "./api";

type PreferencesContextValue = {
  prefs: DesktopPreferences;
  loading: boolean;
  update: (patch: Partial<DesktopPreferences>) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  prefs: DEFAULT_PREFERENCES,
  loading: true,
  update: async () => {},
});

export function PreferencesProvider({
  token,
  children,
}: {
  token: string;
  children: React.ReactNode;
}) {
  const [prefs, setPrefs] = useState<DesktopPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  // Load on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await getPreferences(token);
        if (!cancelled) setPrefs(next);
      } catch {
        // Keep defaults on failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Apply prefs as data attributes on the document root so CSS can
  // react to them globally.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-density", prefs.density);
    root.setAttribute("data-accent", prefs.accent);
    root.setAttribute("data-window-mode", prefs.window_mode);
    root.setAttribute("data-bg-pattern", prefs.bg_pattern);
    root.setAttribute("data-bubble-shape", prefs.bubble_shape);
  }, [
    prefs.density,
    prefs.accent,
    prefs.window_mode,
    prefs.bg_pattern,
    prefs.bubble_shape,
  ]);

  // v0.1.8 — RTL hookup. Arabic is the only RTL locale we ship; flip
  // the document direction + lang so the whole layout mirrors and
  // assistive tech reads it correctly. Everything else is LTR.
  useEffect(() => {
    const root = document.documentElement;
    const lang = prefs.system_language || "en";
    const isRtl = lang === "ar";
    root.setAttribute("dir", isRtl ? "rtl" : "ltr");
    root.setAttribute("lang", lang);
  }, [prefs.system_language]);

  const update = useCallback(
    async (patch: Partial<DesktopPreferences>) => {
      // Optimistic
      setPrefs((cur) => ({ ...cur, ...patch }));
      try {
        const next = await patchPreferences(token, patch);
        setPrefs(next);
      } catch {
        // Rollback would require knowing the prior — for v0 we just
        // refetch authoritative state on next launch.
      }
    },
    [token],
  );

  const value = useMemo(
    () => ({ prefs, loading, update }),
    [prefs, loading, update],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
