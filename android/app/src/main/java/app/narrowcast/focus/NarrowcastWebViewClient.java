package app.narrowcast.focus;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Catches ordinary navigations out of the app: the four "door" anchors, and any
 * window.open that the WebView chose to run in the current frame rather than a new one.
 */
public class NarrowcastWebViewClient extends BridgeWebViewClient {

    private final Bridge bridge;

    public NarrowcastWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        if (ExternalLinks.isWeb(url) && !isAppOrigin(url)) {
            if (ExternalLinks.open(bridge.getActivity(), url)) {
                return true;
            }
        }
        // Capacitor's own handling covers the app's own pages and non-web schemes.
        return super.shouldOverrideUrlLoading(view, request);
    }

    /** The app is served from its own origin; only that origin stays in the WebView. */
    private boolean isAppOrigin(Uri url) {
        String appUrl = bridge.getAppUrl();
        if (appUrl == null) return false;
        Uri app = Uri.parse(appUrl);
        return app.getScheme() != null
            && app.getScheme().equals(url.getScheme())
            && app.getHost() != null
            && app.getHost().equals(url.getHost());
    }
}
