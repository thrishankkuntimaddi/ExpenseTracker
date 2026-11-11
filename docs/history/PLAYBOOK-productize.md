> **Historical — do not paste into a new session.** This was the kickoff prompt for the Android + desktop work (done in 3.11–3.12). Its open questions were answered (Sheets dropped, 4 platforms, 4 reminders, shared trips) and its workflow rules are superseded: work goes straight to `main`, is pushed, deployed and tagged. See README for the current state.

# Playbook: turn a web app into a synced, lightweight Android + desktop product

This is how the **Meditation** app went from a half-working PWA to a real product: website + Android app (3.5 MB) + Mac/Windows/Linux apps (~2 MB), synced across devices, with quiet notifications, clean releases, and everything tested on real systems.

- **Part 1** is the prompt. Paste it into a new Claude Code session opened in the `ExpenseTracker` folder.
- **Part 2** lists the traps we hit, so they're avoided this time.
- **Part 3** is ExpenseTracker-specific: what's already there, and the questions to answer first.

---

## PART 1 — THE PROMPT (copy everything between the lines)

---

You are working on **ExpenseTracker**, my React + Vite + Firebase web app (PWA). Turn it into a polished, complete product that I can install on my phone and computers, synced across devices. Work through the phases below in order, use your own judgement, and verify everything on real systems before saying it's done. Ask me before anything outward-facing (deploying, publishing, deleting remote data, changing cloud rules). Never put passwords or keys in chat.

### Ground rules
- **The Firebase project `nistha-passi-core` is shared** with my other apps (Meditation, ClearMyMind, Chttrix). ExpenseTracker owns the top-level `users/{uid}/…` tree. **Never deploy Firestore rules or indexes on their own.** That replaces every app's rules. Give me rule *changes to merge*, and tell me exactly where to paste them in the console.
- Keep my existing colour palette and overall look. Make it consistent, don't reinvent it.
- **Honesty:** if an OS can't do something (iOS can't toggle Focus, browsers can't schedule notifications offline), say so in the app and to me. Never show a tick for something that didn't happen.
- Keep my data safe: existing localStorage keys and Firestore paths must keep working. Migrate, don't drop.
- **Commits:** small and descriptive, with a co-author line. Push only when I say so.

### Phase 0 — See it and audit it (before changing anything)
1. Read the entire codebase. Run `npm install`, `npm run build`, `npm run lint`, `npm test` and record every failure.
2. Run the app and **screenshot every screen** at phone size (390×844). If the Chrome extension isn't connected, use `puppeteer-core` against `/Applications/Google Chrome.app` from a scratch folder outside the repo. Emulate light and dark mode.
3. List what's broken, inconsistent or half-built: UI, data, sync, icons, offline, PWA, the Sheets server. Check the Firebase setup read-only with the CLI (`firebase firestore:indexes --project nistha-passi-core`). Any query with `where` + `orderBy` on different fields needs a composite index, or it fails silently.
4. Show me the list and your plan, with the decisions you've made, then start.

### Phase 1 — Foundation
- Fix dependency conflicts, lint errors and failing tests. Keep `npm run build`, `lint` and `test` green from now on.
- Anything time-based must use **wall-clock time** (`Date.now()`), never accumulated ticks or `requestAnimationFrame`. rAF stops in background tabs.

### Phase 2 — Design system (one look everywhere)
- **Colour tokens** as CSS variables holding RGB triplets (`--c-bg: 250 250 249`), mapped into Tailwind/CSS as `rgb(var(--c-bg) / <alpha>)`.
- **Theme:** Light / Dark / System, applied with `<html data-theme="…">` before the first paint. It's a **per-device** setting, never synced. Update `<meta name="theme-color">`, and the Android status bar via `@capacitor/status-bar`.
- **Icons:** one icon family, the same stroke width and sizes everywhere (lucide is fine; nothing else mixed in).
- **Shared primitives** (Button, Card, Row/RowGroup, Segmented, Toggle, Stepper, Field) and **Dialog rendered with `createPortal(…, document.body)`**. An animated parent traps `position: fixed` children under the bottom tab bar on phones.
- **Layout:** phone first, max width ~480px on big screens. Safe areas with `env(safe-area-inset-*)`, and a 16px gutter.
- **Destructive actions:** confirm with a Dialog, or a press-and-hold button. Never a single tap.

### Phase 3 — Data and sync across devices
- **Signed-out mode:** the app works locally.
- **Signed-in sync:** Firestore with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` and `ignoreUndefinedProperties: true`, so offline writes queue and sync later.
- **Paths:** everything per user under `users/{uid}/…`, which needs no composite indexes. Settings shared across devices live in a single doc; device-only settings (theme, device name) stay local.
- **Conflicts:** last write wins on `updatedAt`. Use **tombstones** (`deleted: true`) so deletions sync, and client-generated ids so saves are idempotent.
- **Device presence** (optional): `users/{uid}/devices/{deviceId}` with `lastSeen` every ~4 min, shown in Settings as "Your devices · open now".
- **Sync status** in Settings (synced / offline / problem). Turn `permission-denied` into a readable message, never swallow it.
- **Reset data** in Settings, two options, both confirmed:
  - **Clear this device:** sign out, then wipe local data (signing out first stops the cloud refilling it).
  - **Delete all my data:** batch-delete this app's cloud docs (batches of 450), then wipe local.
- **Multiple windows on one device:** keep them in step with the `storage` event and `BroadcastChannel`.

### Phase 4 — One codebase, three shells
- **Build modes:**
  - `vite build`: PWA for GitHub Pages (base `/ExpenseTracker/`, service worker).
  - `vite build --mode native`: base `./`, output `dist-native/`, **no service worker**.
- **Native bridge** (`src/native/index.js`): detect `'__TAURI_INTERNALS__' in window` (desktop), `Capacitor.isNativePlatform()` (Android), otherwise web. Every native call returns what it actually did, so the UI can report truthfully.
- **Android (Capacitor 8):**
  - Setup: `npx cap add android`, `appId com.thrishank.expensetracker`.
  - Plugins: `@capacitor/app` (hardware back goes to Home, and minimizes instead of quitting), `@capacitor/status-bar`, `@capacitor/local-notifications`.
  - Custom plugins are Java classes registered in `MainActivity.onCreate` *before* `super.onCreate`.
- **Desktop (Tauri 2, not Electron):** Electron was 122 MB; Tauri is ~2 MB because it uses the system web view.
  - Setup: `src-tauri/` with `frontendDist: ../dist-native`, `beforeBuildCommand: npm run build:native`, and `version: ../package.json`.
  - Plugins: single-instance, notification, autostart (LaunchAgent, `--hidden`).
  - Tray icon (Open / Quit); closing the window hides it to the tray; `RunEvent::Reopen` shows it again (macOS).
  - Custom `#[tauri::command]`s for native features. Run slow shell-outs as `async` commands.
  - Release profile: `lto`, `opt-level = "s"`, `strip`, `panic = "abort"`.
  - macOS `signingIdentity: "-"` (ad-hoc), Windows NSIS `installMode: currentUser`.
- **iPhone:** stays a PWA (Add to Home Screen). Say so in the app.
- **Icons:**
  - One master SVG, rendered to PNGs with headless Chrome (192, 512, maskable 512, apple-touch 180, 1024).
  - `npx tauri icon assets/icon.png -o src-tauri/icons` for desktop.
  - `@capacitor/assets generate --android` for launcher icons and light/dark splash.
  - Android notification icon: a white vector drawable (`ic_stat_*`).

### Phase 5 — Notifications (minimal, never distracting)
- **Off by default.** Each reminder type has its own on/off, time and days.
- **Copy:** one short line, original (no copyrighted quotes), in a style the user picks. Personalise from their real data, warmly and with no guilt.
- **Rules:** at most one per type per day; skip if the user already did the thing today; nothing while the user is busy in the app.
- **Plan in a pure function** `buildSchedule(now, settings, data) → items[]` covering the next 14 days, with unit tests. Re-plan on app open, settings change and data change.
- **Android:**
  - Local notifications on a **LOW-importance channel** (no sound, no pop-up) by default, `allowWhileIdle: true`.
  - **`isExactNotification: false`.** Otherwise the plugin opens the full-screen "Alarms & reminders" settings page and the call hangs.
  - Request `POST_NOTIFICATIONS` when the user first turns a reminder on. Tapping a notification deep-links to the right screen (`extra` data).
- **Desktop:** hand the planned list to a Rust thread (`set_reminders`) that fires due items every 20 s. It skips items more than 15 min stale (the machine was asleep).
- **Web:** only while the page is open. Say so in the UI.
- **"Send a test" button** and a preview of what the reminder looks like.

### Phase 6 — CI/CD and clean releases
- **`deploy-web.yml`** on push to `main`: `npm ci`, lint, build, `upload-pages-artifact`, then `deploy-pages`.
  - Remind me to set Settings → Pages → Source = **GitHub Actions**.
  - Remind me to allow `main` in Settings → Environments → **github-pages** → deployment branches.
  - Then the `gh-pages` branch can go.
- **`build-apps.yml`** on tag `v*`:
  - **Android:** JDK 21. Restore the keystore from secret `ANDROID_KEYSTORE_BASE64` and `assembleRelease`; fall back to debug with a warning.
  - **Desktop matrix:** `aarch64-apple-darwin`, `x86_64-apple-darwin` (both on `macos-latest`), `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu` (on `ubuntu-22.04` with `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev`). Use `dtolnay/rust-toolchain` + `Swatinem/rust-cache`.
  - **Rename files** to `ExpenseTracker-Android.apk`, `-Mac-AppleSilicon.dmg`, `-Mac-Intel.dmg`, `-Windows-Setup.exe`, `-Linux.AppImage`.
  - **Publish** with `softprops/action-gh-release`, `body_path: .github/release-notes.md`. The notes hold a "Which file do I download?" table, how to tell Apple chip from Intel, per-OS install steps for the one-time "unverified app" warnings, and a line saying to ignore the auto "Source code" zips.
- **Android signing:** create **one permanent keystore** locally (`keytool`, PKCS12, RSA 4096, 10000 days), stored outside the repo (`~/.local/expensetracker-signing/`).
  - Give me the 4 secrets to add by copying from files (`pbcopy < …`, `open -e …`), never in chat.
  - `build.gradle` reads `ANDROID_KEYSTORE_PATH/PASSWORD/KEY_ALIAS/KEY_PASSWORD` from the environment.
  - `versionName` comes from package.json, with `versionCode = major*10000 + minor*100 + patch`.
- **Website:** add an OS-aware "Get the app" button linking to `releases/latest/download/<name>`. Detect Intel vs Apple Silicon with `userAgentData.getHighEntropyValues(['architecture'])`.

### Phase 7 — Verify on real systems (required; don't claim it works without this)
- **Every change:** build, lint, tests.
- **Web E2E** with puppeteer-core: two pages in one browser for cross-window behaviour, plus light/dark emulation. Assert on behaviour (text, storage, computed styles) and look at screenshots.
- **Android emulator:**
  - Setup: JDK 21 + Android cmdline-tools in `~`; `avdmanager create avd` with an existing device profile (check `avdmanager list device -c`), booted headless.
  - Install with `adb install`. Drive the WebView over CDP: `adb forward tcp:9444 localabstract:webview_devtools_remote_<pid>`, then `puppeteer.connect({ browserURL })`.
  - Check real OS state with `adb shell settings get …`, `dumpsys notification --noredact`, `dumpsys alarm`, `dumpsys window`.
  - Screenshots with `adb exec-out screencap -p`.
- **Desktop:**
  - Rust `#[ignore]` tests that make the real system calls and assert they restore (`cargo test -- --ignored --test-threads=1`).
  - A **debug-only self-test**: `window.eval(include_str!("selftest.js"))` calls every `invoke` and reports through a `selftest_report` command. Quit other copies first, because single-instance swallows the launch.
  - macOS blocks terminal screen capture, so test through code, not screenshots.
- **After any UI fix:** rebuild the desktop app (`PATH=$HOME/.cargo/bin:$PATH npx tauri build --bundles app`) and copy it over `/Applications/ExpenseTracker.app`. Otherwise I keep seeing the old bug.
- **After a release:** download the published APK and run `apksigner verify --print-certs`. The signer must be my permanent key, not "Android Debug".
- **GitHub API polling:** the anonymous limit is 60/hour. Poll every 30–60 s, or check the release pages on github.com instead.

### Phase 8 — Hand-off
- Update the README: features, a per-platform capability table, install table, dev/build/release commands, architecture.
- Tell me plainly what's done and verified, what's untested and why, and exactly what I must do (console rules to paste, secrets to add, settings to flip).

---

## PART 2 — TRAPS WE HIT ON MEDITATION (and the fix)

| Symptom | Real cause | Fix |
|---|---|---|
| `npm install` fails (ERESOLVE) | `vite-plugin-pwa` older than Vite 8 support | Upgrade the plugin (≥ 1.3) |
| History never loaded from cloud | `where(userId) + orderBy(timestamp)` needs a composite index that didn't exist, and the error was caught and ignored | Per-user subcollections; surface errors |
| Timer froze / bells silent in background | `requestAnimationFrame` stops in hidden tabs | `setInterval` plus wall-clock math; state as a pure function of elapsed time |
| Styles missing after config change | Dev server kept stale Tailwind output | Restart the dev server after `tailwind.config` edits |
| Delete dialog hidden under tab bar on phone | Animated parent trapped the fixed dialog's layer order | `createPortal` to `document.body` |
| Desktop app 122 MB | Electron bundles Chromium | Tauri (system web view): **1.8 MB** |
| Tauri build failed in `apple-sys` | `keepawake` crate's generated system bindings broke on the new macOS SDK | Own keep-awake: `caffeinate -d -i -w <pid>` (mac), `SetThreadExecutionState` (Win), `systemd-inhibit` (Linux) |
| "It never silences anything" | Mac only muted *other* Macs; Windows did nothing; the Android DND permission was easy to miss | Per-role behaviour, onboarding card, a "test" button, and reports of what really happened |
| Reminders didn't schedule; a settings page popped up | The local-notifications plugin requests exact alarms by default | `isExactNotification: false` |
| Phones would refuse app updates | CI signed every APK with a new random debug key | One permanent keystore + GitHub secrets |
| Secrets "added" but build still used debug key | Added in the wrong place or with the wrong name | Must be **Repository secrets** with exact names; check the build annotations |
| Pages deploy rejected | `github-pages` environment only allowed `gh-pages` | Allow `main` in environment rules |
| Release vanished after re-tagging | Deleting a tag turns its release into a draft | Publish a new version instead of re-tagging |
| Lost track of CI | Anonymous GitHub API limit (60/h) | Slow polling, or read github.com pages |
| Test launch did nothing | Single-instance plugin handed off to the already-running copy | Quit the installed app before self-tests |
| DND could stick on | Exit ran before enter finished | Chain: `entered.finally(() => exit())` |
| Fix "done" but user still saw bug | Desktop app not rebuilt / reinstalled | Always rebuild + reinstall after UI fixes |

---

## PART 3 — EXPENSETRACKER: WHAT'S ALREADY THERE + QUESTIONS

**Already in place** (from a quick look, unverified):
- **Stack:** React + Vite in **JavaScript** (no TypeScript), Recharts, lucide-react icons, Vitest tests (`TZ=Asia/Kolkata`).
- **Firestore** under `users/{uid}/` with transactions, income, external_transactions, recently_deleted, recurring, trips (plus `monthly_summaries`, which the rules mention). The offline cache is already enabled, so cross-device sync mostly exists already. The work is polish, status, reset and native shells.
- **Strict rules** for `users/` with `validEntry()` money checks. Any new subcollection is allowed by the catch-all under `users/{userId}`.
- **A hand-written `public/sw.js`** and `manifest.json`. Decide whether to keep them or move to vite-plugin-pwa.
- **An Express server (`server/`)** that proxies Google Sheets. The native apps can't run this, so it has to be hosted somewhere they can reach.

**Questions to answer before or at the start of the session:**
1. **Sheets server:** where is `server/` hosted today, if anywhere? Should the phone and desktop apps keep Google Sheets export (needs a hosted URL), or drop it there?
2. **Reminders:** which ones do you want? For example a daily "log today's spending" nudge, a budget nearing its limit, recurring bills due tomorrow, or a weekly summary. And which tone?
3. **Platforms:** Android + Mac + Windows like Meditation, or a subset? Is Linux needed?
4. **TypeScript:** convert gradually, or stay in JavaScript?
5. **Android-only extras:** anything that uses the phone itself, such as a home-screen widget or a quick-add tile? (Reading bank SMS is possible but heavily restricted by Google Play; skip it unless you need it.)
6. **Sharing:** is ExpenseTracker just for you, or do others use it (trip splitting with friends)? That changes the sync and rules design.
7. **Commits:** may Claude commit and push as it goes, or only when you say?
