# Building the Narrowcast APK

This repository now contains a complete Capacitor Android project that bundles the web
app inside the APK. It does not load anything from a remote URL, so it keeps working if
the site it came from disappears.

The APK was **not** produced on the machine that wrote this code. That machine cannot
reach `dl.google.com`, which serves the Android SDK and the Android Gradle Plugin, and
it has no KVM, so it could not run an emulator either. Details are in
[What could not be done here](#what-could-not-be-done-here).

There are three ways to get from here to something you can actually open, in rough
order of how little you need installed.

---

## Build it on GitHub, with no computer

`.github/workflows/build-apk.yml` builds the APK on GitHub's runners, which already
have the Android SDK. Every push runs it; you can also start one by hand from the
**Actions** tab, **Build APK**, **Run workflow**.

When the run finishes, open it and download **narrowcast-apk** from the Artifacts
section at the bottom. It arrives as a zip containing `narrowcast-debug.apk`. Unzip it,
move the `.apk` to the phone, and tap it. Android asks once for permission to install
from that app; allow it, then install.

Artifacts are visible only to people who can see this repository's Actions tab, and
they expire after 90 days. Nothing is published anywhere.

To have CI produce a *signed release* APK as well, add these repository secrets under
**Settings, Secrets and variables, Actions**:

| Secret | Value |
| --- | --- |
| `NARROWCAST_KEYSTORE_BASE64` | `base64 -w0 narrowcast.keystore` |
| `NARROWCAST_KEYSTORE_PASSWORD` | the password you chose |
| `NARROWCAST_KEY_ALIAS` | `narrowcast`, unless you changed it |
| `NARROWCAST_KEY_PASSWORD` | the key password, if different |

Until those exist the workflow just builds the debug APK and succeeds.

## Use it as a web app instead

The app was a working web app before it was an Android project, and still is. Nothing
needs building. Turn on **Settings, Pages**, source **Deploy from a branch**, branch
`claude/new-session-5zm6ro`, folder `/ (root)`. A minute later it is live at
`https://nathjohn04321-afk.github.io/narrowcast/`.

Open that on the phone in Chrome and use the menu's **Install app** or **Add to Home
screen**. You get the funnel icon, no browser chrome, and offline support, which is
every checklist item except the Downloads behaviour, where the browser handles the
backup file its own way. `README.md` covers the other hosting routes.

## Build it

You need a JDK 17 or newer and the Android SDK. Then:

```bash
npm install
npm run apk:debug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

Copy that file to the phone and open it. Android will ask you to allow installing from
this source the first time.

`npm run apk:debug` runs three steps, which you can also run separately:

```bash
npm run build     # copies the web app into www/
npx cap sync      # copies www/ into the Android project
cd android && ./gradlew assembleDebug
```

If Gradle cannot find the SDK, point it there:

```bash
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
```

### Release build

First make a signing key. Do this on a machine you keep:

```bash
./scripts/make-keystore.sh
# writes ~/narrowcast-signing/narrowcast.keystore
```

Then tell the build where it is, either by copying
`android/keystore.properties.example` to `android/keystore.properties` and filling it
in, or by exporting the variables the script prints. Either way the password never
lands in a file that git tracks: `android/keystore.properties`, `*.keystore` and
`*.jks` are all in `.gitignore`.

```bash
npm run apk:release
# -> android/app/build/outputs/apk/release/app-release.apk
```

With no keystore configured the release build still runs and simply produces an
unsigned APK, so a debug build is never blocked by a missing key.

### Why the keystore matters more than it looks

Android identifies an app by package id **and** signature. An update signed with a
different key is not an update; it is a different app, and Android refuses to install
it over the old one. If you lose `narrowcast.keystore`, the only way onto a newer
version is to uninstall Narrowcast first, which erases every focus, channel and queue
item stored on the device. There is no recovery and no appeal. Back the file up
somewhere you will still have in five years, and keep the password with it.

---

## What was changed, and why

`manifest.webmanifest`, `sw.js` and the icons are **byte-identical** to what you
supplied, and every Android fix lives in native code beside them rather than in the page.

`index.html` was byte-identical too until the queue gained a player, dated notes and
suggestions. Those are changes to the app itself, not workarounds for Android, so they
had to go in the page. Nothing that was already there was restructured: the additions
sit alongside the existing code and reuse its helpers.

### External links leave the app

This was the thing that had to be right, so it is handled in two places rather than
relying on WebView defaults.

`window.open(url, '_blank', 'noopener')` is what every search launch goes through. An
Android WebView with `setSupportMultipleWindows(false)` — the default, and what stock
Capacitor leaves in place — answers that call by loading the URL **in the same
WebView**, which is exactly the broken signed-out YouTube you did not want. So:

- `MainActivity` turns multiple-window support **on**, which routes `window.open` and
  the four `target="_blank"` door anchors into `WebChromeClient.onCreateWindow`.
- `NarrowcastChromeClient.onCreateWindow` hands back a throwaway WebView whose only job
  is to report the address it is asked to load. It never loads it. The URL goes to
  Android as an intent and the throwaway view is destroyed.
- `NarrowcastWebViewClient.shouldOverrideUrlLoading` catches anything that reaches the
  main WebView by another path, as a backstop.

A new window often starts at `about:blank` before the real navigation arrives, so only
`http` and `https` addresses are accepted; anything else is ignored and the handler
keeps waiting for the address that matters.

### Which links go to a browser, and which may go to the YouTube app

`ExternalLinks.mustUseBrowser` decides. The rule is that **any URL whose
Shorts-avoidance lives in the URL itself goes to a browser**, because the YouTube
Android app parses the parameters it recognises on a deep link and drops the rest:

| URL | Goes to | Why |
| --- | --- | --- |
| `youtube.com/results?...&sp=...` | Browser only | `sp=` is the length filter. Shorts are three minutes or less, so the filter is the whole mechanism. |
| `youtube.com/@name/videos` and other `/videos` tabs | Browser only | The Videos tab never lists Shorts; the tab is encoded in the path. |
| `youtube.com/watch?v=...` | Whatever Android prefers | Nothing to lose, and playback is better in the app. |
| The four doors: subscriptions, Watch later, playlists, history | Whatever Android prefers | Plain destinations with no filter state. |
| Anything not on a YouTube host | Whatever Android prefers | Not ours to route. |

"Browser only" is done by restricting the intent to apps that answer for the bare
`https:` scheme. Browsers register that way; YouTube registers for its own hosts, so it
is not a candidate. If no browser answers, the code falls back to a normal open rather
than doing nothing.

You can see the whole decision table run against the URLs `index.html` actually
generates, with only a JDK and no device:

```bash
./tools/routing-check/run.sh
```

### The queue plays, keeps notes, and suggests where to go next

The watch list grew three things, and one of them changes a native rule.

**Play here** drops a `youtube-nocookie.com` embed into the item. The iframe is only
created when the button is pressed, so nothing reaches YouTube until you ask it to. One
player runs at a time. This forced a change in `NarrowcastWebViewClient`: it now ignores
anything that is not a main-frame navigation. Without that, Capacitor's own link
handling would treat the embed as a link leaving the app and bounce the whole video out
to the YouTube app the instant it loaded. **Open in YouTube** sits beside it and behaves
as it always did, so the choice is per video.

**Notes** became a dated list instead of one box. Data written by the old version is
migrated on load: a `note` string becomes the first entry in `notes`, and the upgraded
shape is written straight back to storage so an old backup restores correctly too.
Adding a note saves that one item without redrawing the page, because a full redraw
would tear out the iframe and restart the video you are taking notes on.

**Related** builds follow-up search angles from the video title plus the focus keywords,
using the same offline pattern machinery as "Build search angles". It suggests searches,
not videos: with no network there is nothing to look anything up against. Each suggestion
opens a length-filtered YouTube search, so Shorts stay out.

Run the browser checks for all of this with:

```bash
./tools/app-check/run.sh
```

That serves the app locally, blocks every other request, and asserts the migration, the
notes, the suggestions, the player, and that nothing but the Google Fonts stylesheet
leaves on its own.

### Channels and searches open inside the app

With a YouTube Data API key pasted into *YouTube connection*, the app stops handing you
to YouTube. **Browse** on a trusted channel resolves its uploads playlist, lists the
recent videos with thumbnails and durations, and plays any of them in place. The search
box returns results in the app. **Queue** on any result files it in the watch list with
its real title, so capture no longer means copying a link and typing a name.

Two things matter about how this is built.

**Shorts are excluded by real duration, not by a filter parameter.** Every list runs the
ids through `videos.list` and drops anything at or under three minutes. That is stricter
than the old `sp=` approach, and it is why the "any length" option is now safe: there is
nothing left for a Short to slip through. The RSS feed, which needs no key, was rejected
for exactly this reason — it carries no duration, so Shorts cannot be filtered out of it.

**Nothing is requested until you ask.** With no key the app makes no API calls at all and
behaves exactly as it did before. With a key it still makes none until you press Browse
or Search. The resolved uploads playlist and channel title are cached onto the saved
channel, so a second visit costs two calls instead of three.

Quota is the one thing to watch: the free allowance is 10,000 units a day, a search costs
100 and a channel browse costs 2. When it runs out the app says so plainly and points at
*Open this on YouTube*.

The four doors stay as they are and are now labelled as the only things that leave. They
are tied to a Google account, so no key can bring them in-app; that would need a full
sign-in flow, which an embedded player cannot carry.

### Backup export writes a real file

`exportData()` builds a `blob:` URL and clicks a generated `<a download>`. An Android
WebView ignores that completely: blob URLs never reach `DownloadListener`, so the tap
would do nothing at all and you would get no file and no error.

`android/app/src/main/res/raw/narrowcast_native.js` is injected after page load. It
catches the click on any `<a download>` with a `blob:` or `data:` href, reads the blob
itself, and passes the bytes to `DownloadBridge`, which writes them into Downloads
through `MediaStore` on Android 10 and later, or to the public Downloads directory
behind the storage permission on Android 9 and older. A toast confirms the path.

### Everything else

- **Portrait** is locked in the manifest.
- **`#0F1E24`** is the splash background, the Android 12+ splash colour, and the window
  background, so launch never flashes white. The app's own light and dark themes still
  follow the system setting, as they did in the browser.
- **Icons and splash** were generated from the supplied funnel artwork. The funnel was
  lifted off its background losslessly (the art is a two-colour blend, so the alpha is
  recoverable exactly) and re-composed for the adaptive icon and splash.
- **`sw.js` was kept.** Its registration in `index.html` is already behind a protocol
  check, and Capacitor serves the app over `https://localhost`, so it registers
  harmlessly and changes nothing. It is not needed inside the APK — the assets are
  already local — but it does no damage and removing it would have meant touching files
  you asked me to leave alone.
- **`localStorage` persists.** Capacitor enables DOM storage, and `MainActivity` sets it
  explicitly. WebView keeps it in the app's private data directory, so it survives the
  app being closed and reopened. It is cleared by uninstalling, or by clearing the app's
  storage from Android settings.

---

## What could not be done here

Two hard blocks, both environmental:

**`dl.google.com` is blocked by this machine's network policy.** That host serves the
Android SDK, and `maven.google.com` is a redirector to it, so the Android Gradle Plugin
and every AndroidX library are unreachable too. Gradle itself downloaded fine and Maven
Central is reachable; the build stops at the very first dependency:

```
Could not resolve com.android.tools.build:gradle:8.13.0.
  > Could not GET 'https://dl.google.com/dl/android/maven2/.../gradle-8.13.0.pom'.
     > Received status code 403 from server: Forbidden
```

**There is no `/dev/kvm`**, so no emulator can run here, and there is no physical
device attached. That rules out the on-device tests the brief asked for.

So these are **unverified on a device** and should be checked on the first install:

- that a search launch leaves the app and lands on filtered results;
- that the backup file appears in Downloads;
- that the icon, splash and portrait lock look right.

What *was* verified here, without a device: the routing decision table runs green
against the real generated URLs; every Java source type-checks against the Android and
Capacitor APIs it uses; the injected JavaScript and every XML resource parse; and the
web assets are identical from the repository root through `www/` into the APK's asset
folder. The app's own behaviour is covered by `tools/app-check`, which drives it in a
real browser at four phone widths with every outbound request blocked.

## The `sp=` filter, separately from Android

You asked whether the YouTube app honours `sp=`. Routing searches to a browser makes
that moot. But there is a second thing worth knowing, because it affects the app
everywhere including in the browser.

YouTube changed its search filters in January 2026 and tightened the URL parameters in
February 2026. The part that was closed off is **sort order**: `sp=CAI%3D`, sort by
upload date, no longer forces a chronological sort. The **duration filters are still
the documented way to do this** and are what the app relies on: `EgQQARgC` for long,
`EgQQARgD` for medium. Your `buildSp` encodes exactly those.

Practically: the Sort control in the app may now be ignored by YouTube, while the
length filter that removes Shorts still works. That is worth a look on a real launch,
counting whether any Shorts appear, which is the test you wanted anyway.

One thing in the app's own logic is worth flagging: when the length filter is set to
"any", `buildSp` still emits `sp=EgIQAQ%3D%3D`, which filters to type=video only.
Shorts are videos, so that setting does not exclude them. The default is "long", so
this only bites if the filter is deliberately set to any. I have not changed it.

Sources: [9to5Google on the filter rename](https://9to5google.com/2026/01/08/youtube-search-filters/),
[PiunikaWeb on the URL parameters](https://piunikaweb.com/2026/02/05/youtube-search-filters-missing-url-parameters-workaround/),
[Social Media Today](https://www.socialmediatoday.com/news/youtube-updates-search-filter-terms-and-functions/809142/).

---

## Layout

```
index.html, manifest.webmanifest, sw.js, icon-*.png   the web app, untouched
www/                                                  copy of the above; what gets bundled
assets/                                               icon and splash sources
scripts/build-www.js                                  refreshes www/
scripts/make-keystore.sh                              creates the signing key
tools/routing-check/                                  runnable link-routing test, JDK only
tools/app-check/                                      browser tests: app-check.js and api-check.js
android/app/src/main/java/app/narrowcast/focus/
  MainActivity.java                                   wires the WebView up
  ExternalLinks.java                                  browser-vs-app decision
  NarrowcastChromeClient.java                         window.open and target=_blank
  NarrowcastWebViewClient.java                        ordinary navigation backstop
  DownloadBridge.java                                 writes the backup into Downloads
android/app/src/main/res/raw/narrowcast_native.js     injected download shim
```

Edit the web app at the repository root, never in `www/` or under `android/`. Both are
regenerated by `npm run build` and `npx cap sync`.
