# Signing key

`hanzi-flow.jks` signs every APK the GitHub workflow builds, so a new build installs over the
old one and keeps your progress. Password and alias are both `hanziflow`.

This key is only for installing the app on your own phone by hand (sideloading). If you ever
publish to Google Play, create a new private key, keep it out of the repository, and pass it to
the workflow as a repository secret instead.
