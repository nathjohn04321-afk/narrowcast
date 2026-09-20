package app.narrowcast.focus;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import java.util.Locale;

/**
 * Decides how a link leaving Narrowcast is handed to Android.
 *
 * Nothing here ever loads a page back into the app's own WebView. Opening YouTube
 * is the point of the app, and a signed-out YouTube inside a bare WebView is useless.
 */
final class ExternalLinks {

    static final String TAG = "Narrowcast";

    private ExternalLinks() {}

    /** Web links belong outside the app. Everything else (mailto:, intent:, ...) is left alone. */
    static boolean isWeb(Uri uri) {
        String scheme = uri.getScheme();
        return "http".equals(scheme) || "https".equals(scheme);
    }

    private static boolean isYouTube(String host) {
        if (host == null) return false;
        host = host.toLowerCase(Locale.US);
        return host.equals("youtube.com")
            || host.endsWith(".youtube.com")
            || host.equals("youtu.be");
    }

    /**
     * Two kinds of YouTube URL carry their Shorts-avoidance in the URL itself:
     *
     *   - a search, where sp= is the length filter and Shorts are short by definition;
     *   - a channel's /videos tab, which never lists Shorts.
     *
     * The YouTube Android app is not guaranteed to preserve either when it picks up a
     * deep link: it parses the parameters it knows and drops the rest. A browser always
     * honours the whole URL, so these two go to a browser and nowhere else.
     *
     * Watch links and the four "doors" have no such state in the URL, so they are free
     * to open in the YouTube app, where playback and the signed-in session are better.
     */
    static boolean mustUseBrowser(Uri uri) {
        if (!isYouTube(uri.getHost())) return false;

        String sp = null;
        try {
            sp = uri.getQueryParameter("sp");
        } catch (UnsupportedOperationException ignored) {
            // opaque URI, no query to read
        }
        if (sp != null && sp.length() > 0) return true;

        String path = uri.getPath();
        if (path == null) return false;
        path = path.toLowerCase(Locale.US);
        return path.startsWith("/results") || path.endsWith("/videos");
    }

    /** Hand the URL to Android. Returns true once it has left the app. */
    static boolean open(Activity activity, Uri uri) {
        if (activity == null || uri == null) return false;

        if (mustUseBrowser(uri) && openInBrowser(activity, uri)) {
            return true;
        }
        return openAnywhere(activity, uri);
    }

    /**
     * Restrict the chooser to apps that answer for the bare https: scheme. Browsers
     * register that way; YouTube registers for its own hosts, so it is not a candidate.
     */
    private static boolean openInBrowser(Activity activity, Uri uri) {
        try {
            Intent selector = new Intent(Intent.ACTION_VIEW, Uri.fromParts("https", "", null));
            selector.addCategory(Intent.CATEGORY_BROWSABLE);

            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.setSelector(selector);

            activity.startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "No browser answered for " + uri + ", falling back to any handler");
            return false;
        } catch (Exception e) {
            Log.w(TAG, "Browser launch failed for " + uri, e);
            return false;
        }
    }

    private static boolean openAnywhere(Activity activity, Uri uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "Nothing on this device can open " + uri);
            return false;
        } catch (Exception e) {
            Log.w(TAG, "Launch failed for " + uri, e);
            return false;
        }
    }
}
