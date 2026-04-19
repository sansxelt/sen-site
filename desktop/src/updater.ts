import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Once per launch, ask the manifest endpoint if there's a newer
// version. If yes: download + install + relaunch. If no: silent.
//
// In dev (Vite + tauri dev), this is a no-op — the updater is only
// active on bundled builds because the dev binary doesn't have a
// real version to compare against.
export async function checkForUpdatesOnLaunch(): Promise<void> {
  try {
    const update = await check();
    if (!update) return; // no update available

    console.info(
      `[sansxel-updater] update found: ${update.version} (${update.date ?? "?"})`,
    );

    let total = 0;
    let downloaded = 0;
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          total = event.data.contentLength ?? 0;
          console.info(`[sansxel-updater] downloading ${total} bytes`);
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          break;
        case "Finished":
          console.info("[sansxel-updater] download complete, installing");
          break;
      }
    });

    // Install puts the new binary on disk; relaunch swaps to it.
    await relaunch();
  } catch (err) {
    // Updater errors are silent — they shouldn't disrupt the user.
    console.warn("[sansxel-updater] check failed:", err);
  }
}
