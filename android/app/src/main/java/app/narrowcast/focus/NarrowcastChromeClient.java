package app.narrowcast.focus;

import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Message;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * index.html launches every search through window.open(url, '_blank', 'noopener').
 *
 * With multiple windows enabled, that call and the target="_blank" anchors both land
 * here instead of quietly loading YouTube in the current WebView. The URL is not passed
 * to onCreateWindow directly, so a throwaway WebView is handed back purely to report
 * the address it is asked to load. It never loads anything.
 */
public class NarrowcastChromeClient extends BridgeWebChromeClient {

    private final Bridge bridge;

    public NarrowcastChromeClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        if (!(resultMsg.obj instanceof WebView.WebViewTransport)) {
            return false;
        }

        final WebView probe = new WebView(view.getContext());
        final AtomicBoolean handled = new AtomicBoolean(false);

        probe.setWebViewClient(
            new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                    take(probe, handled, request.getUrl());
                    return true;
                }

                // Backstop for WebView builds that start the load without asking first.
                @Override
                public void onPageStarted(WebView v, String url, Bitmap favicon) {
                    if (url != null) {
                        take(probe, handled, Uri.parse(url));
                    }
                }
            }
        );

        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
        transport.setWebView(probe);
        resultMsg.sendToTarget();
        return true;
    }

    /**
     * Hands the first real web address to Android and tears the probe down.
     *
     * A new window often begins at about:blank before the real navigation arrives, so
     * only http and https count; anything else is ignored and the probe stays alive
     * waiting for the address that matters.
     */
    private void take(final WebView probe, AtomicBoolean handled, Uri url) {
        if (url == null || !ExternalLinks.isWeb(url)) return;
        if (!handled.compareAndSet(false, true)) return;

        ExternalLinks.open(bridge.getActivity(), url);

        probe.stopLoading();
        // Tearing the probe down inside its own callback crashes; let the loop drain first.
        probe.post(
            new Runnable() {
                @Override
                public void run() {
                    probe.destroy();
                }
            }
        );
    }
}
