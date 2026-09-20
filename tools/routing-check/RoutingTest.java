import android.net.Uri;
import java.lang.reflect.Method;

/** Exercises ExternalLinks against the URLs index.html actually produces. */
public class RoutingTest {

    static int failures = 0;
    static Method mustUseBrowser;
    static Method isWeb;

    static void check(String label, String url, boolean expectBrowser) throws Exception {
        Uri uri = Uri.parse(url);
        boolean got = (Boolean) mustUseBrowser.invoke(null, uri);
        boolean ok = got == expectBrowser;
        if (!ok) failures++;
        System.out.printf("%-4s %-28s browser=%-5s (want %-5s)  %s%n",
            ok ? "PASS" : "FAIL", label, got, expectBrowser,
            url.length() > 68 ? url.substring(0, 68) + "..." : url);
    }

    static void checkWeb(String label, String url, boolean expectWeb) throws Exception {
        boolean got = (Boolean) isWeb.invoke(null, Uri.parse(url));
        boolean ok = got == expectWeb;
        if (!ok) failures++;
        System.out.printf("%-4s %-28s isWeb=%-5s (want %-5s)  %s%n",
            ok ? "PASS" : "FAIL", label, got, expectWeb, url);
    }

    public static void main(String[] args) throws Exception {
        Class<?> c = Class.forName("app.narrowcast.focus.ExternalLinks");
        mustUseBrowser = c.getDeclaredMethod("mustUseBrowser", Uri.class);
        isWeb = c.getDeclaredMethod("isWeb", Uri.class);
        mustUseBrowser.setAccessible(true);
        isWeb.setAccessible(true);

        System.out.println("--- searches: the sp= length filter must survive, so browser only ---");
        check("default launch (long)", "https://www.youtube.com/results?search_query=hydroponics%20tutorial&sp=EgQQARgC", true);
        check("medium length", "https://www.youtube.com/results?search_query=test&sp=EgQQARgD", true);
        check("sorted + recent + long", "https://www.youtube.com/results?search_query=test&sp=CAISBggBEAEYAg%3D%3D", true);
        check("video-type only", "https://www.youtube.com/results?search_query=test&sp=EgIQAQ%3D%3D", true);
        check("results, no sp at all", "https://www.youtube.com/results?search_query=test", true);

        System.out.println("\n--- channels: the /videos tab is what hides Shorts, so browser only ---");
        check("handle channel", "https://www.youtube.com/@veritasium/videos", true);
        check("channel id", "https://www.youtube.com/channel/UCHnyfMqiRRG1u-2MsSQLbXA/videos", true);
        check("legacy user", "https://www.youtube.com/user/someone/videos", true);
        check("c/ vanity", "https://www.youtube.com/c/Something/videos", true);

        System.out.println("\n--- watch + doors: no filter in the URL, the YouTube app is fine ---");
        check("watch", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", false);
        check("subscriptions door", "https://www.youtube.com/feed/subscriptions", false);
        check("watch later door", "https://www.youtube.com/playlist?list=WL", false);
        check("playlists door", "https://www.youtube.com/feed/playlists", false);
        check("history door", "https://www.youtube.com/feed/history", false);
        check("youtu.be short link", "https://youtu.be/dQw4w9WgXcQ", false);

        System.out.println("\n--- non-YouTube is never forced anywhere ---");
        check("other host with sp", "https://example.com/results?sp=EgQQARgC", false);
        check("lookalike host", "https://notyoutube.com/results?search_query=x&sp=EgQQARgC", false);
        check("subdomain m.youtube", "https://m.youtube.com/results?search_query=x&sp=EgQQARgC", true);
        check("uppercase host", "https://WWW.YOUTUBE.COM/results?search_query=x&sp=EgQQARgC", true);

        System.out.println("\n--- scheme handling ---");
        checkWeb("https", "https://www.youtube.com/watch?v=a", true);
        checkWeb("http", "http://www.youtube.com/watch?v=a", true);
        checkWeb("mailto", "mailto:someone@example.com", false);
        checkWeb("intent", "intent://scan/#Intent;scheme=zxing;end", false);

        System.out.println("\n--- opaque URI must not throw ---");
        check("opaque mailto", "mailto:a@b.c", false);

        System.out.println(failures == 0 ? "\nALL PASS" : "\n" + failures + " FAILURES");
        if (failures != 0) System.exit(1);
    }
}
