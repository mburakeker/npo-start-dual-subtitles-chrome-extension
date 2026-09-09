# NPO Start Dual Subtitles

Chrome extension for language learners watching [NPO Start](https://npo.nl/start/). It shows a translation above the native Dutch subtitles, and lets you click a word for a dictionary lookup.

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/npo-start-dual-subtitles/fiaaicoacdjmcpnlainngknokhbkiogl), or load an unpacked build from this repo (see below). Current version: **0.5.1**.

## How to use

1. Open a video or live channel on [npo.nl/start](https://npo.nl/start/).
2. Click the NPO/EN toggle in the player’s bottom-right controls.
3. If Dutch subtitles (`Ondertiteling` → `Nederlands`) are available, they are turned on and the translation appears above the Dutch cue.
4. Click the same button to turn translation off.

The target language defaults to English. Change it from the extension popup (toolbar icon). Your choice is saved.

Dutch subtitles must exist for that title. If they do not, the toggle stays off and the button tooltip says so. Switching to another video turns the toggle off; it only comes back on if that video also has Dutch subtitles.

## Features

- Dual subtitles in the player: original Dutch plus a translation above it
- 30+ target languages via the popup
- Click a Dutch subtitle word for Wiktionary and Google Translate, plus links to DeepL, Forvo, Tatoeba, and others
- Optional pause-on-hover for subtitle words (on by default; can be disabled in the popup)
- Works on NPO Start live channels, shows, and films
- Adapted to NPO’s current `npoplayer` UI

## Development install

```sh
git clone https://github.com/mburakeker/npo-start-dual-subtitles-chrome-extension.git
cd npo-start-dual-subtitles-chrome-extension
npm i && npm run build
```

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist` folder

Reload the extension after each `npm run build`.

## Contributing

1. Fork the repository and create a branch.
2. Make your changes, build, and test on npo.nl.
3. Open a pull request.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

This project is for educational use. Translations are powered by Google Translate. Google disclaims all warranties related to the translations, express or implied, including accuracy, reliability, merchantability, fitness for a particular purpose, and noninfringement.

## Contact

Questions or issues: [mburakekerdev@gmail.com](mailto:mburakekerdev@gmail.com) or open a GitHub issue.
