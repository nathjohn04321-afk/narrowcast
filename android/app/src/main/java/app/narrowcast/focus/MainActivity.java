package app.narrowcast.focus;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.Charset;

public class MainActivity extends BridgeActivity {

    private String shim;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Registered before the bridge exists, so the first page load cannot outrun it.
        bridgeBuilder.addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageLoaded(WebView view) {
                    injectShim(view);
                }
            }
        );

        super.onCreate(savedInstanceState);

        Bridge bridge = getBridge();
        if (bridge == null) return; // no usable WebView on this device; Capacitor already bailed out

        WebView webView = bridge.getWebView();
        if (webView == null) return;

        WebSettings settings = webView.getSettings();
        // Without this, window.open() replaces the current page, which would put YouTube
        // inside the app's own WebView. With it, the call is routed to onCreateWindow.
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        // localStorage holds every focus, channel and queue item. Capacitor enables DOM
        // storage already; this keeps it explicit and survives app restarts.
        settings.setDomStorageEnabled(true);

        bridge.setWebViewClient(new NarrowcastWebViewClient(bridge));
        webView.setWebChromeClient(new NarrowcastChromeClient(bridge));
        webView.addJavascriptInterface(new DownloadBridge(this), DownloadBridge.NAME);
    }

    private void injectShim(WebView view) {
        if (shim == null) {
            shim = readRawResource(R.raw.narrowcast_native);
        }
        if (shim != null && !shim.isEmpty()) {
            view.evaluateJavascript(shim, null);
        }
    }

    private String readRawResource(int resId) {
        try (InputStream in = getResources().openRawResource(resId)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toString(Charset.forName("UTF-8").name());
        } catch (Exception e) {
            android.util.Log.w(ExternalLinks.TAG, "Could not read the injected script", e);
            return null;
        }
    }
}
