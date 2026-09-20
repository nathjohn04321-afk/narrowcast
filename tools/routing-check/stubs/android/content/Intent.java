package android.content;
import android.net.Uri;
public class Intent {
  public static final String ACTION_VIEW = "android.intent.action.VIEW";
  public static final String CATEGORY_BROWSABLE = "android.intent.category.BROWSABLE";
  public static final int FLAG_ACTIVITY_NEW_TASK = 1;
  public Intent(){}
  public Intent(String action, Uri uri){}
  public Intent addCategory(String c){ return this; }
  public Intent addFlags(int f){ return this; }
  public void setSelector(Intent s){}
}
