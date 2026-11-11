package app.hanziflow;

import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

/**
 * Hanzi Flow for Android: the web app, bundled in the APK, shown full screen in a WebView.
 *
 * Chinese pronunciation comes from the phone's text-to-speech engine through the
 * {@code AndroidTTS} bridge, because the WebView has no Web Speech voices of its own.
 * The engine does not speak directly: it writes each word to a small audio file in the app's
 * cache and the app plays that file itself. That way the sound belongs to Hanzi Flow, so the
 * phone's per-app volume and "separate app sound" settings apply to it, and a word that was
 * spoken once plays instantly the next time. If anything in that path fails, the engine
 * speaks directly instead, so there is always sound.
 */
public class MainActivity extends Activity {
    private static final String START_URL = "https://appassets.androidplatform.net/assets/www/index.html";

    private WebView web;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;
    private File ttsDir;               // cache of spoken words, one .wav per text + speed
    private MediaPlayer player;        // plays the cached file; main thread only
    private int ttsSeq = 0;            // makes every synthesis request's temp file unique
    private String wantedKey = null;   // cache key of the newest request; older results are dropped
    private String wantedId = null;    // utterance id the newest request is waiting for, if any
    private String wantedText = null;
    private float wantedRate = 1f;
    private int wantedReq = 0;         // number of the newest app-audio request
    private int startedReq = 0;        // number of the last request whose playback really started
    private final Handler main = new Handler(Looper.getMainLooper());
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

        ttsDir = new File(getCacheDir(), "tts");
        ttsDir.mkdirs();
        trimSpeechCache();

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(Locale.SIMPLIFIED_CHINESE);
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String id) {
                    }

                    @Override
                    public void onDone(String id) {
                        onSynthesized(id, true);
                    }

                    @Override
                    public void onError(String id) {
                        onSynthesized(id, false);
                    }

                    @Override
                    public void onError(String id, int errorCode) {
                        onSynthesized(id, false);
                    }

                    @Override
                    public void onStop(String id, boolean interrupted) {
                        File part = partFile(id);
                        if (part != null) part.delete();
                    }
                });
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
        stopSpeech();
        web.onPause();
    }

    // ---------------------------------------------------------------- speech

    /** Utterance ids for file synthesis look like "<key>#<n>"; direct speech uses "direct". */
    private File partFile(String utteranceId) {
        if (utteranceId == null || utteranceId.indexOf('#') < 0) return null;
        return new File(ttsDir, utteranceId.replace('#', '.') + ".part");
    }

    private static String cacheKey(String text, float rate) {
        String raw = Math.round(rate * 100) + "|" + text;
        try {
            byte[] d = MessageDigest.getInstance("SHA-1").digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format(Locale.US, "%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return "h" + Integer.toHexString(raw.hashCode()) + "_" + raw.length();
        }
    }

    /** Main thread. Speak {@code text}: from the cache if it is there, else synthesize it first. */
    private void speakNow(final String text, final float rate) {
        releasePlayer();
        String key = cacheKey(text, rate);
        wantedKey = key;
        wantedText = text;
        wantedRate = rate;
        final int req = ++wantedReq;
        // Safety net: if the word is not audibly under way soon, let the engine speak it itself.
        main.postDelayed(() -> {
            if (wantedReq == req && startedReq != req && wantedKey != null) fallBack(text, rate);
        }, 2500);
        wantedId = null;
        try {
            tts.stop(); // silence a direct-speech fallback and drop whatever is still queued
        } catch (Exception ignored) {
        }
        File ready = new File(ttsDir, key + ".wav");
        if (ready.isFile() && ready.length() > 44) {
            play(ready, text, rate);
            return;
        }
        try {
            ttsDir.mkdirs(); // the cache may have been cleared while the app was open
            tts.setSpeechRate(rate);
            String id = key + "#" + (++ttsSeq);
            wantedId = id;
            int res = tts.synthesizeToFile(text, null, partFile(id), id);
            if (res != TextToSpeech.SUCCESS) fallBack(text, rate);
        } catch (Exception e) {
            fallBack(text, rate);
        }
    }

    /**
     * Main thread. The app-audio path did not work for this word: forget the request (so a
     * late file or the safety net cannot speak it a second time) and let the engine speak.
     */
    private void fallBack(String text, float rate) {
        wantedKey = null;
        releasePlayer();
        speakDirect(text, rate);
    }

    /** Called by the engine on its own thread when a file is finished (or failed). */
    private void onSynthesized(String id, boolean ok) {
        final File part = partFile(id);
        if (part == null) return; // direct speech, nothing to play
        final String key = id.substring(0, id.indexOf('#'));
        final File ready = new File(ttsDir, key + ".wav");
        final boolean usable = ok && part.isFile() && part.length() > 44 && part.renameTo(ready);
        if (!usable) part.delete();
        runOnUiThread(() -> {
            // Only the newest request counts: the learner may have moved on, or asked again.
            if (!key.equals(wantedKey) || !id.equals(wantedId)) return;
            if (usable) play(ready, wantedText, wantedRate);
            else fallBack(wantedText, wantedRate);
        });
    }

    /** Main thread. Play a cached file as this app's own media audio. */
    private void play(final File file, final String text, final float rate) {
        releasePlayer();
        try {
            final MediaPlayer mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
            mp.setDataSource(file.getAbsolutePath());
            final int req = wantedReq;
            mp.setOnPreparedListener(p -> {
                if (player != p) return;
                startedReq = req;
                p.start();
            });
            mp.setOnCompletionListener(p -> {
                if (player == p) player = null;
                p.release();
            });
            mp.setOnErrorListener((p, what, extra) -> {
                boolean current = player == p;
                if (current) player = null;
                p.release();
                file.delete();
                if (current) fallBack(text, rate);
                return true;
            });
            player = mp;
            mp.prepareAsync();
        } catch (Exception e) {
            file.delete();
            fallBack(text, rate);
        }
    }

    /** Fallback: let the engine speak by itself (this is the engine's audio, not the app's). */
    private void speakDirect(String text, float rate) {
        if (!ttsReady || text == null) return;
        try {
            tts.setSpeechRate(rate);
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "direct");
        } catch (Exception ignored) {
        }
    }

    private void releasePlayer() {
        if (player != null) {
            try {
                player.release();
            } catch (Exception ignored) {
            }
            player = null;
        }
    }

    private void stopSpeech() {
        wantedKey = null;
        releasePlayer();
        if (tts != null) {
            try {
                tts.stop();
            } catch (Exception ignored) {
            }
        }
    }

    /** Keep the speech cache small: clear leftovers, and start over when it grows past 40 MB. */
    private void trimSpeechCache() {
        File[] files = ttsDir.listFiles();
        if (files == null) return;
        long total = 0;
        for (File f : files) {
            if (f.getName().endsWith(".part")) f.delete();
            else total += f.length();
        }
        if (total > 40L * 1024 * 1024 || files.length > 2000) {
            for (File f : files) f.delete();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        stopSpeech();
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }

    /** Called from JavaScript as window.AndroidTTS.* (see js/04-audio.js). */
    private class TtsBridge {
        @JavascriptInterface
        public boolean isReady() {
            return ttsReady;
        }

        /** The phone's voice speaks directly, at the phone's media volume. */
        @JavascriptInterface
        public void speak(final String text, final float rate) {
            speakVia(text, rate, false);
        }

        /**
         * viaApp = true: the app plays the word itself (cached file), so the app's own volume
         * applies. viaApp = false: the engine speaks directly.
         */
        @JavascriptInterface
        public void speakVia(final String text, final float rate, final boolean viaApp) {
            if (!ttsReady || text == null || text.trim().isEmpty()) return;
            final float r = rate > 0 ? rate : 1f;
            runOnUiThread(() -> {
                if (viaApp) {
                    speakNow(text, r);
                } else {
                    wantedKey = null;
                    releasePlayer();
                    speakDirect(text, r);
                }
            });
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(() -> stopSpeech());
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
