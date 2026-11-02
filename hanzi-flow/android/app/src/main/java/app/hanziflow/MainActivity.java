package app.hanziflow;

import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.util.Locale;

/**
 * Hanzi Flow for Android: the web app, bundled in the APK, shown full screen in a WebView.
 * Chinese pronunciation comes from the phone's own text-to-speech engine through the
 * {@code AndroidTTS} bridge, because the WebView has no Web Speech voices of its own.
 */
public class MainActivity extends Activity {
    private static final String START_URL = "https://appassets.androidplatform.net/assets/www/index.html";

    private WebView web;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;
    private Boolean themeOverride = null; // null = follow the system

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);
        applyColors();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage keeps the learning progress
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("appassets.androidplatform.net".equals(url.getHost())) return false;
                // Links to other sites (data sources, licences) open in the browser.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception ignored) {
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new TtsBridge(), "AndroidTTS");

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(Locale.SIMPLIFIED_CHINESE);
                ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
            }
        });

        if (savedInstanceState == null) web.loadUrl(START_URL);
        else web.restoreState(savedInstanceState);
    }

    private void applyColors() {
        boolean dark = themeOverride != null
                ? themeOverride
                : (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                        == Configuration.UI_MODE_NIGHT_YES;
        int paper = dark ? Color.parseColor("#14171b") : Color.parseColor("#f1f2ee");
        web.setBackgroundColor(paper);
        getWindow().setStatusBarColor(paper);
        getWindow().setNavigationBarColor(paper);
        View decor = getWindow().getDecorView();
        int flags = decor.getSystemUiVisibility();
        if (dark) {
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        } else {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        decor.setSystemUiVisibility(flags);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyColors();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (tts != null) tts.stop();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        web.destroy();
        super.onDestroy();
    }

    /** Called from JavaScript as window.AndroidTTS.* (see js/04-audio.js). */
    private class TtsBridge {
        @JavascriptInterface
        public boolean isReady() {
            return ttsReady;
        }

        @JavascriptInterface
        public void speak(String text, float rate) {
            if (!ttsReady || text == null) return;
            tts.setSpeechRate(rate <= 0 ? 1f : rate);
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "hanziflow");
        }

        @JavascriptInterface
        public void stop() {
            if (ttsReady) tts.stop();
        }

        /** "dark", "light" or "system": recolour the status and navigation bars to match the page. */
        @JavascriptInterface
        public void setTheme(final String theme) {
            runOnUiThread(() -> {
                themeOverride = "dark".equals(theme) ? Boolean.TRUE : "light".equals(theme) ? Boolean.FALSE : null;
                applyColors();
            });
        }
    }
}
