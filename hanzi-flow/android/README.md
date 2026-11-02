# Hanzi Flow for Android

A thin native shell: the web app in `..` is copied into `app/src/main/assets/www/` at build
time and shown full screen in a WebView. Pronunciation uses the phone's own text-to-speech
engine through a small JavaScript bridge (`AndroidTTS`), because WebViews have no Web Speech
voices.

You do not need Android Studio. The GitHub workflow `.github/workflows/android.yml` builds a
signed APK on every push to `main` and attaches it to a release:
**Releases → Hanzi Flow for Android → HanziFlow.apk**. Open that link on your phone, download,
and allow the install when Android asks.

To build locally instead (Android SDK, Java 17 and Gradle 8.7 required):

```
rsync -a --delete --exclude android --exclude tools ../ app/src/main/assets/www/
gradle assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

If words are silent, install Chinese voice data: Android Settings → System → Languages →
Text-to-speech → Google Speech Services → Install voice data → Chinese (Mandarin).
