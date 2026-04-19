# Releasing the sansxel desktop

End-to-end: from dev binary → signed Windows installer → users get it
automatically.

## One-time setup (only first release)

### 1. Generate an updater signing keypair

The auto-updater needs a public/private RSA pair. Public key goes in
`tauri.conf.json` (committed). Private key stays on your machine
(NEVER committed). Run from the repo root:

```
npm run desktop:keygen
```

It writes:
- `sansxel-updater.key` — private key, keep safe (back it up to a
  password manager)
- `sansxel-updater.key.pub` — public key, paste its contents into
  `desktop/src-tauri/tauri.conf.json` under
  `plugins.updater.pubkey` (replace `REPLACE_WITH_YOUR_TAURI_PUBKEY`)

`sansxel-updater.key` is gitignored. Don't lose it — you can't sign
new releases without it. Losing it means existing installs can never
auto-update again (you'd have to ship a new app under a new pubkey
and ask users to reinstall).

### 2. Set the signing key in your environment

The build will sign artifacts automatically when these env vars are set:

```
TAURI_SIGNING_PRIVATE_KEY=<paste contents of sansxel-updater.key>
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=<the password you chose during keygen>
```

You can put these in a local `.env` file (gitignored) or your shell
profile.

## Each release

### 1. Bump the version

Edit `desktop/src-tauri/tauri.conf.json` → `version`. Use semver:
patch (`0.1.1`) for bugfixes, minor (`0.2.0`) for features.

### 2. Build the installer

```
npm run desktop:build
```

Takes ~3-5 minutes. Output lands in:

```
desktop/src-tauri/target/release/bundle/
├── msi/sansxel_<version>_x64_en-US.msi
├── nsis/sansxel_<version>_x64-setup.exe
└── nsis/sansxel_<version>_x64-setup.nsis.zip + .nsis.zip.sig
```

The `.nsis.zip` + `.nsis.zip.sig` pair is what the updater downloads.
The `.msi` / `.exe` is what new users download from your website.

### 3. Upload to GitHub Releases

```
gh release create v<version> \
  desktop/src-tauri/target/release/bundle/msi/sansxel_*_x64_en-US.msi \
  desktop/src-tauri/target/release/bundle/nsis/sansxel_*_x64-setup.exe \
  desktop/src-tauri/target/release/bundle/nsis/sansxel_*_x64-setup.nsis.zip \
  desktop/src-tauri/target/release/bundle/nsis/sansxel_*_x64-setup.nsis.zip.sig
```

(Or upload manually via github.com → Releases → Draft a new release.)

### 4. Update the manifest endpoint

Open `app/api/desktop/updates/latest/route.ts` and fill in:

```ts
const LATEST_VERSION = "0.2.0";              // your new version
const RELEASE_NOTES = "What changed";
const RELEASE_DATE  = "2026-04-19T20:00:00Z";

const PLATFORMS = {
  "windows-x86_64": {
    url: "https://github.com/sansxelt/sen-site/releases/download/v0.2.0/sansxel_0.2.0_x64-setup.nsis.zip",
    signature: "<contents of the matching .nsis.zip.sig file>",
  },
};
```

Commit + push. Vercel deploys.

### 5. Done

Existing installs check `/api/desktop/updates/latest` 4 seconds after
launch. They'll find the new version, download the signed bundle in
the background, and relaunch into it. Silent — no permission prompt,
no install wizard.

New users go to `https://sansxel.ai/download` and grab the MSI.

## Code signing (Windows "unrecognized publisher" warning)

Out of scope for this doc. To get rid of the SmartScreen warning on
first install, you need an EV (Extended Validation) Code Signing
Certificate from a CA — DigiCert / Sectigo / SSL.com etc. Costs
$200-400/yr. Once you have it, set the cert env vars Tauri docs
describe and `tauri build` signs the installer too.

Until then, users see "Windows protected your PC" on first install
and have to click "More info → Run anyway." Tolerable for early
beta; ship the cert before paid users.
