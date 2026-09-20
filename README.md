# Narrowcast — install on your phone

YouTube, one goal at a time. No Shorts.

This folder is the whole app. It runs in the browser, installs to your home screen
with its own icon, and works with no connection (except when it hands you over to
YouTube, which obviously needs one). Nothing is sent anywhere — your focuses, channels
and queue are stored on the phone itself.

## Files

- `index.html` — the app
- `manifest.webmanifest` — what makes it installable
- `sw.js` — keeps it working offline
- `icon-*.png` — the home screen icon

They must stay together in the same folder.

---

## Route 1 — Netlify Drop (fastest, about two minutes)

You need a computer for this part, once.

1. On a computer, go to **https://app.netlify.com/drop**
2. Drag the whole `narrowcast` folder onto the page. No account needed to start.
3. It gives you an address like `https://something-random.netlify.app`.
4. Open that address **on your phone**, in Chrome (Android) or Safari (iPhone).
5. Install it:
   - **Android / Chrome:** menu (⋮) → *Install app* or *Add to Home screen*
   - **iPhone / Safari:** Share button → *Add to Home Screen*
6. The funnel icon appears on your home screen. Open it — no browser bar, no tabs.

Netlify lets you claim the site later if you want to keep the address permanently.

## Route 2 — GitHub Pages (permanent, free)

1. Make a new public repository on GitHub, e.g. `narrowcast`.
2. Upload all the files in this folder to the root of the repo.
3. Repo → **Settings → Pages** → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`. Save.
4. After a minute it publishes at `https://yourname.github.io/narrowcast/`.
5. Open it on your phone and install it, same as step 5 above.

## Route 3 — Straight onto the phone, no hosting

1. Copy this folder to your phone (cable, Google Drive, WhatsApp to yourself).
2. Unzip it with any file manager.
3. Tap `index.html` and choose to open it with Chrome.

This works, but with two catches: Android won't offer the *Install app* option for a
local file, so there's no proper home screen icon, and some Android browsers wipe
storage for local files. If you use this route, take a backup file often
(*Your data → Save a backup file*).

---

## Once it's installed

- **Add a focus** — what you're working on, what done looks like, and the words that
  belong to the topic. Everything else bends around the focus you have selected.
- **Type a question and launch.** The search opens on YouTube with a length filter
  attached. Shorts are three minutes or less, so a length filter removes them from the
  results entirely — they aren't hidden, they can't be there.
- **Build search angles** turns your topic words into eight different search phrases,
  in Indonesian, English or both, depending on the focus. Tap one to launch it.
- **Channels you trust** open on the channel's Videos tab, which never lists Shorts.
- **Queue** is your watch list for the focus you're in. Paste a link and it lands there;
  paste a Shorts link and it gets converted into a normal video link. Each video has
  four things:
  - **Play here** opens a player inside the app, and **Open in YouTube** hands it over
    the way it always did. Use whichever suits the video. Playing here needs a
    connection and you are signed out, so it leaves no trace in your history.
  - **Notes** keeps as many dated notes per video as you want, not one box. Tap any note
    to edit it. Notes survive while a video is playing, so you can write as you watch.
  - **Related** builds follow-up search angles from the video's title and your focus
    words, on the phone, with no connection. They are searches, not recommendations:
    each one opens YouTube with the length filter already applied.
  - The tick marks it watched and drops it down the list.
- **Doors** are the four YouTube entry points that don't put the recommendation feed in
  front of you. The home page is deliberately missing.

## Backups

Your data lives in this one browser on this one phone. Clearing site data erases it.
*Your data → Save a backup file* writes a small JSON file you can keep in Drive, and
*Restore from backup* reads it back — that's also how you move to a new phone.
