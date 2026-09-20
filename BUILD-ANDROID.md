# BUILD-ANDROID.md — brief for Claude Code

Turn this folder into an installable, signed Android APK.

Everything the app needs is already here. `index.html` is fully self-contained
(inline CSS and JS, no build step, no external JS). The only network calls it makes
are a Google Fonts stylesheet — which degrades to system fonts when offline — and the
YouTube links it opens on purpose.

## What I want

A `.apk` I can copy to my phone and install directly (sideload, not Play Store).
It should work with no connection, and it must keep working if the site it came from
disappears — so **bundle the web assets inside the APK**. Do not build a Trusted Web
Activity that loads a remote URL.

App name: Narrowcast
Package id: `app.narrowcast.focus`
Orientation: portrait
Min SDK: whatever Capacitor defaults to is fine
Theme colour / splash background: `#0F1E24`

## Suggested route — Capacitor

Use whatever you think is best, but this is the path I expect works with the least
friction. Check the current Capacitor docs rather than trusting the exact commands
below if anything has moved.

```bash
# from inside this folder
npm init -y
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/android
npx cap init Narrowcast app.narrowcast.focus --web-dir=www

mkdir -p www
cp index.html manifest.webmanifest sw.js icon-*.png www/

npx cap add android
npx @capacitor/assets generate --android   # reads assets/icon.png and assets/splash.png
npx cap sync

cd android && ./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

You will need a JDK (17+) and the Android SDK. Install them if they are missing —
`sdkmanager` for platform-tools, the current platform, and build-tools. Tell me what
you installed and roughly how much disk it took.

## The one thing that must be verified, not assumed

**External links.** Opening YouTube is the entire purpose of this app. Every launch
goes through `window.open(url, '_blank', 'noopener')` in `index.html`.

Inside a Capacitor WebView that must leave the app and hand the URL to Android, so it
opens in the YouTube app or the browser. It must never load YouTube inside the app's
own WebView — signed-out YouTube in a bare WebView is broken and useless.

Please actually test this on a device or emulator. If the default behaviour is wrong,
fix it — `@capacitor/browser`, an `AppLauncher` call, or a small `shouldOverrideUrlLoading`
override are all acceptable. Your choice, just make it work.

**Second thing to check while you are in there:** when the URL opens in the YouTube
Android app rather than a browser, does YouTube still honour the `sp=` filter
parameter? That parameter is what removes Shorts from the results, so it is not
optional. If the YouTube app drops the filter, force these URLs to the browser
instead. Test with a real launch and count whether any Shorts appear.

## Signing

Debug build first so I can install it quickly. Then also produce a release APK signed
with a new keystore:

```bash
keytool -genkey -v -keystore narrowcast.keystore -alias narrowcast \
        -keyalg RSA -keysize 2048 -validity 10000
```

Wire the signing config into `android/app/build.gradle`, keep the keystore password out
of any file that would get committed, and tell me plainly where the keystore file ended
up and why losing it means I can never update this app.

## Done checklist

- [ ] APK installs on a phone via sideload without an "app not installed" error
- [ ] App opens full screen with the funnel icon and no browser chrome
- [ ] A search launch leaves the app and lands in YouTube with the length filter applied
- [ ] Airplane mode: the app itself still opens and my saved focuses are still there
- [ ] Focuses, channels and queue survive closing and reopening the app
- [ ] Backup export writes a file I can find in Downloads
- [ ] Tell me the APK path and its size

## Notes

- `sw.js` is only useful when served over http(s). Inside Capacitor it is harmless
  either way — the registration in `index.html` is already guarded by a protocol check.
  Delete it from `www/` if it causes trouble.
- The app stores everything in `localStorage`. Confirm Capacitor's WebView persists it
  across app restarts; if it does not, say so rather than silently switching storage.
- Don't restructure `index.html`. If something in it genuinely blocks the build, tell me
  what and why before changing it.
