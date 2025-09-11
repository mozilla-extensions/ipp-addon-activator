# IPP Add-on Activator

Firefox WebExtension designed as a system add-on to enable and handle IP Protection (IPP) behaviors starting from Firefox 143. When it detects domains known for potential incompatibilities, it shows a browser notification with options to quickly exclude the site from IPP.

## Requirements

- Node.js `>= 24` (see `.nvmrc`)
- npm (or pnpm/yarn if you prefer)
- Firefox 143+ (Developer Edition or Nightly recommended) with WebExtensions Experiments enabled

Note: the dev command already sets the needed prefs at runtime.

## Installation

1. Clone the repository
2. Install dependencies:
   - `npm ci` (recommended in CI) or `npm install`

## Scripts

- `npm run start`: launches Firefox with the add-on in development via `web-ext run` and enables the needed Experiment prefs.
- `npm run build`: produces the `.xpi` at `web-ext-artifacts/ipp-addon-activator.xpi`.
- `npm run lint`: runs ESLint.
- `npm run lint:fix`: runs ESLint with autofix.
- `npm run format`: formats files with Prettier.

## Development

Run:

```
npm run start
```

This launches Firefox with:

- `extensions.experiments.enabled=true`
- console logging enabled for Chrome/Content

Alternatively, you can load the add-on temporarily from `about:debugging#/runtime/this-firefox` by selecting the `src` folder or the generated `.xpi`.

## Build

To create the XPI for local install or signing:

```
npm run build
```

The resulting file is placed at `web-ext-artifacts/ipp-addon-activator.xpi`.

## Tests

Run:

```
npm run build
npm run test
```

Optionally set the Firefox binary path:

```
FIREFOX_BINARY="/path/to/firefox-nightly" npm run test
```

## Configure breakage domains (BREAKAGES)

Domains and messages live in `src/breakages.js` under the `BREAKAGES` constant. Each entry looks like:

```js
{
  id: 'youtube',
  domains: ['youtube.com', 'example.com'],
  message: 'Notification text to show to the user',
}
```

Guidelines:

- `id`: unique identifier for the breakage kind (used to remember “Don’t show again”).
- `domains`: list of hosts for which to show the notification.
- `message`: text displayed in the browser notification bar.

To reset “Don’t show again” choices, clear the add-on’s local storage or reinstall the extension.

## License

MPL-2.0. See file headers and `package.json`.
