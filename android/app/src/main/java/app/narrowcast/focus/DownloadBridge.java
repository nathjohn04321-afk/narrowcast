package app.narrowcast.focus;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Receives the backup bytes from narrowcast_native.js and writes them into the
 * device's Downloads folder, so "Save a backup file" produces a file the user can
 * actually find.
 *
 * Only the app's own bundled page runs in this WebView; every external link is sent
 * out to Android, so nothing remote is ever in a position to call this.
 */
public class DownloadBridge {

    static final String NAME = "NarrowcastNative";
    private static final int REQUEST_LEGACY_STORAGE = 9731;

    private final AppCompatActivity activity;

    DownloadBridge(AppCompatActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void save(String name, String mime, String base64) {
        final String fileName = safeName(name);
        final String mimeType = (mime == null || mime.isEmpty()) ? "application/json" : mime;

        byte[] bytes;
        try {
            bytes = Base64.decode(base64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            toast("The backup could not be prepared.");
            return;
        }

        try {
            String where = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? writeViaMediaStore(fileName, mimeType, bytes)
                : writeLegacy(fileName, bytes);
            if (where != null) {
                toast("Saved to " + where);
            }
        } catch (Exception e) {
            Log.w(ExternalLinks.TAG, "Backup write failed", e);
            toast("Could not write the backup file.");
        }
    }

    @JavascriptInterface
    public void failed(String message) {
        Log.w(ExternalLinks.TAG, "Backup export failed in the page: " + message);
        toast("Could not read the backup data.");
    }

    /** Android 10 and later: scoped storage, no permission needed. */
    private String writeViaMediaStore(String fileName, String mimeType, byte[] bytes) throws Exception {
        ContentResolver resolver = activity.getContentResolver();

        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri item = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (item == null) throw new IllegalStateException("MediaStore refused the insert");

        try (OutputStream out = resolver.openOutputStream(item)) {
            if (out == null) throw new IllegalStateException("MediaStore gave no stream");
            out.write(bytes);
            out.flush();
        }

        values.clear();
        values.put(MediaStore.Downloads.IS_PENDING, 0);
        resolver.update(item, values, null, null);

        return "Downloads/" + fileName;
    }

    /** Android 7 to 9: a real path, behind the storage permission. */
    private String writeLegacy(String fileName, byte[] bytes) throws Exception {
        if (
            ContextCompat.checkSelfPermission(activity, Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            activity.runOnUiThread(
                new Runnable() {
                    @Override
                    public void run() {
                        ActivityCompat.requestPermissions(
                            activity,
                            new String[] { Manifest.permission.WRITE_EXTERNAL_STORAGE },
                            REQUEST_LEGACY_STORAGE
                        );
                    }
                }
            );
            toast("Allow storage access, then tap Save a backup file again.");
            return null;
        }

        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (dir != null && !dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Downloads folder is not writable");
        }

        File target = new File(dir, fileName);
        try (FileOutputStream out = new FileOutputStream(target)) {
            out.write(bytes);
            out.flush();
        }
        return target.getAbsolutePath();
    }

    private static String safeName(String name) {
        String cleaned = (name == null ? "" : name).replaceAll("[^A-Za-z0-9._-]", "_");
        if (cleaned.isEmpty() || cleaned.equals(".") || cleaned.equals("..")) {
            cleaned = "narrowcast-backup.json";
        }
        return cleaned;
    }

    private void toast(final String message) {
        activity.runOnUiThread(
            new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(activity, message, Toast.LENGTH_LONG).show();
                }
            }
        );
    }
}
