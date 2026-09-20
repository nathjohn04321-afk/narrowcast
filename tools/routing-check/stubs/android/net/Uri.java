package android.net;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
/** Test-only Uri backed by java.net.URI, close enough to Android's for routing checks. */
public class Uri {
  private final java.net.URI u;
  private Uri(java.net.URI u){ this.u = u; }
  public static Uri parse(String s){
    try { return new Uri(new java.net.URI(s)); }
    catch (Exception e) { throw new IllegalArgumentException(s, e); }
  }
  public static Uri fromParts(String scheme, String ssp, String fragment){
    return parse(scheme + ":" + ssp);
  }
  public String getScheme(){ return u.getScheme(); }
  public String getHost(){ return u.getHost(); }
  public String getPath(){ return u.getPath(); }
  public String getQueryParameter(String key){
    if (u.isOpaque()) throw new UnsupportedOperationException("opaque");
    String q = u.getRawQuery();
    if (q == null) return null;
    for (String pair : q.split("&")) {
      int eq = pair.indexOf('=');
      String k = eq < 0 ? pair : pair.substring(0, eq);
      if (k.equals(key)) {
        String v = eq < 0 ? "" : pair.substring(eq + 1);
        try { return URLDecoder.decode(v, "UTF-8"); }
        catch (UnsupportedEncodingException e) { return v; }
      }
    }
    return null;
  }
  @Override public String toString(){ return u.toString(); }
}
