# J.A.R.V.I.S.

A voice assistant you run from your phone's browser. Tap the glowing core, speak, and Jarvis answers out loud using Claude.

## Use it
1. Open the GitHub Pages link on your phone (Chrome on Android or Safari on iPhone).
2. Paste your Anthropic API key in Settings (get one at https://console.anthropic.com). It stays on your device only.
3. Add it to your home screen: Chrome menu → "Add to Home screen", or Safari Share → "Add to Home Screen".

## Files
- `index.html`, `style.css`, `app.js`: the app (Web Speech API for voice, Claude Messages API for answers)
- `sw.js`, `manifest.webmanifest`: makes it installable
- `.github/workflows/pages.yml`: publishes to GitHub Pages on every push to `main`
