/*
 * Injected into the page after load. index.html saves a backup by clicking a
 * generated <a download> whose href is a blob: URL. An Android WebView ignores
 * that: blob URLs never reach DownloadListener, so the tap does nothing at all.
 *
 * This reads the blob itself and hands the bytes to the native side, which writes
 * them into Downloads. index.html is untouched.
 */
(function () {
  if (window.__narrowcastNativeSave) return;
  if (typeof NarrowcastNative === 'undefined' || !NarrowcastNative || !NarrowcastNative.save) return;
  window.__narrowcastNativeSave = true;

  function downloadAnchor(node) {
    while (node && node !== document) {
      if (node.tagName === 'A' && node.hasAttribute && node.hasAttribute('download')) return node;
      node = node.parentNode;
    }
    return null;
  }

  document.addEventListener(
    'click',
    function (ev) {
      var a = downloadAnchor(ev.target);
      if (!a) return;

      var href = a.getAttribute('href') || '';
      if (href.lastIndexOf('blob:', 0) !== 0 && href.lastIndexOf('data:', 0) !== 0) return;

      ev.preventDefault();
      ev.stopPropagation();

      var name = a.getAttribute('download') || 'narrowcast-backup.json';

      fetch(href)
        .then(function (r) {
          return r.blob();
        })
        .then(function (blob) {
          return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
              var s = String(reader.result || '');
              var comma = s.indexOf(',');
              resolve({ type: blob.type, base64: comma < 0 ? '' : s.slice(comma + 1) });
            };
            reader.onerror = function () {
              reject(reader.error || new Error('unreadable'));
            };
            reader.readAsDataURL(blob);
          });
        })
        .then(function (out) {
          NarrowcastNative.save(name, out.type || 'application/json', out.base64);
        })
        .catch(function (err) {
          NarrowcastNative.failed(String(err && err.message ? err.message : err));
        });
    },
    true
  );
})();
