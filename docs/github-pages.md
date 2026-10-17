# Running the website

## Locally

From the repository root:

```sh
npm run dev
```

Open `http://127.0.0.1:4173/`. No npm packages need to be installed; Node.js 20+ is enough. You can use any static HTTP server with `site/` as its root, for example `python3 -m http.server 4173 --directory site`.

Opening `index.html` via `file://` is not supported: the browser blocks loading JSON and ES modules. On GitHub Pages they work over HTTP(S).

## GitHub Pages via Actions

The project includes `.github/workflows/pages.yml`. It checks the catalog and tests, copies only `site/` to `dist/` and publishes that static directory.

1. Push the project to your GitHub repository yourself. The agent did not run commit/push: only `git status` and `git diff` are allowed.
2. Open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. For the `main` or `master` branch, publishing starts after a push. To run it manually, open **Actions → Deploy Unlock Atlas to GitHub Pages → Run workflow**.
4. Wait for the Deploy job to succeed. The URL will appear in the `github-pages` environment and in Settings → Pages.

For a different default branch, change `on.push.branches` in the YAML. If the environment restricts deployment branches, check its settings in GitHub. The workflow follows the [official GitHub Pages instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

All paths are relative; the website works both at `https://user.github.io/repository/` and on a custom domain. Navigation uses the hash, so reloading the statistics or graph page does not require server-side routes. After a page reload, the save must be attached again: it is not stored on a server or between sessions. The website is in English by default; the RU / EN switch in the header changes the interface language, and the choice is stored in the browser's `localStorage` under the key `atlas-language`. See [Localization](i18n.md).

## Ready-made static package

```sh
npm run build
```

The contents of `dist/` can be placed at the root of a separate branch or a separate repository for publishing in the regular Pages "Deploy from a branch" mode. For this option, copy the **contents**, including `.nojekyll`, not the `dist` directory as a nested folder. Alternatively, unpack `artifacts/isaac-unlock-atlas.zip` into the website root.

Neither Python nor Node.js is needed on the host. These tools are used only for local development, preparing reference data and running checks.

## What gets published

The static package contains only HTML/CSS/JS, shared JSON reference data and local game sprites. It **does not include** `context/`, source `.dat` files, personal `reports/`, tests or tools. Do not add your own saves to a public GitHub repository: excluding them from the Pages package does not make the repository's own files private.

The website reads the selected `.dat` via the File API. `fetch` loads only shared JSON from the website's own directory; the save is never sent anywhere. Wiki links open only when the user explicitly clicks them. There are no analytics, cookies, remote fonts or CDN dependencies.

## Support

Repentance (638/496) and Repentance+ (642/523) are supported; for Rebirth (179/95), statistics for that version are available. The correct checksum of each edition is verified. persistentgamedata is required; gamestate (the current run) is not used and produces an explanation naming the correct neighbouring file. Afterbirth/Afterbirth+ and unverified schema variants are explicitly rejected. More details: [formats and choosing the file](save-formats.md). The priority guide has been updated for Repentance+, so some effect assessments may differ from Repentance.

Conditions that are not fully saved remain unknown and allow manual confirmation in the current tab only. Changing or forgetting the save resets these marks. Manual confirmations do not change the file and are not disguised as values read from the statistics.
