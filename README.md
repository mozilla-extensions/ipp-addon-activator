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
   - `npm install`

## Scripts

- `npm run start`: launches Firefox with the add-on in development via `web-ext run` and enables the needed Experiment prefs.
- `npm run build`: produces the `.xpi` at `web-ext-artifacts/ipp-addon-activator.xpi`.
- `npm test`: no-op in CI (intentionally disabled).
- `npm run experimentaltests`: runs the Mocha test suite locally.
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

Tests are disabled by default in CI; locally you can run them with:

```
npm run build
npm run experimentaltests
```

Firefox binary selection:

- If `FIREFOX_BINARY` is set, tests use that Firefox binary.
- Otherwise, Selenium will try the system default Firefox in PATH.

Examples:

```
FIREFOX_BINARY="/path/to/firefox-nightly" npm run experimentaltests
# or just rely on system Firefox
npm run experimentaltests
```

## Configure breakage domains

Breakage definitions are JSON files under `src/breakages/` and are split by trigger:

- `src/breakages/tab.json`: entries used when the top-level tab URL changes or the tab becomes active.
- `src/breakages/webrequest.json`: entries used when matching network activity occurs (webRequest).

Each entry has the shape:

```json
{
  "domains": ["example.com"],
  "message": "Notification text to show to the user",
  "condition": {
    /* optional Condition */
  }
}
```

Notes:

- `domains`: list of hostnames or registrable domains (eTLD+1).
  - If an entry equals the page host (e.g. `api.example.com`), it matches only that host.
  - If an entry equals the base domain (eTLD+1, e.g. `example.com`), it matches that domain and all its subdomains.
- `message`: can be either a string or an array of parts to render rich content.
  - String example: `"Simple message"`.
  - Array example:
    ```json
    [
      { "text": "Important: ", "modifier": ["strong"] },
      { "text": "additional details." }
    ]
    ```
    Supported modifiers: `strong`.
- `condition` (optional): a Condition object that controls when to show the notification. If omitted, the rule always matches when the domain matches.
- Testing mode is detected via the pref `extensions.ippactivator.testMode` (set to true by tests and by `npm run start`).
- Runtime prefs (all values are JSON strings):
  - `extensions.ippactivator.dynamicTabBreakages`: array for tab-triggered breakages.
  - `extensions.ippactivator.dynamicWebRequestBreakages`: array for webRequest-triggered breakages.
  - `extensions.ippactivator.notifiedDomains`: array of base domains (eTLD+1) that were already notified; used to suppress repeat notifications for the same domain. Clearing or removing this pref resets suppression.
    The background listens for dynamic breakage changes and updates immediately.

Examples (from tests, via Selenium running in chrome context):

```
// Set dynamic TAB breakages only
await setDynamicTabBreakages(driver, [
  {
    domains: ["www.example.com"],
    message: "Test message",
    condition: { "type": "test", "ret": true }
  }
]);

// Set dynamic WEBREQUEST breakages only
await setDynamicWebRequestBreakages(driver, [
  {
    domains: ["api.example.com"],
    message: "Matched request",
    condition: { "type": "url", "pattern": "https://api\\.example\\.com/" }
  }
]);
```

## Conditions

- Location: implementations live under `src/conditions/` and are referenced by breakages via the `condition` field.
- Shape: a condition is an object with a `type` plus type-specific fields. Conditions can be composed with logical operators.

Supported types

- **and**: logical AND over an array of sub-conditions.
  - Fields: `conditions: [Condition, ...]`
  - Result: true only if all sub-conditions return true. Empty array → true.
  - Example:
    ```json
    { "type": "and", "conditions": [{ "type": "test", "ret": true }] }
    ```

- **or**: logical OR over an array of sub-conditions.
  - Fields: `conditions: [Condition, ...]`
  - Result: true if any sub-condition returns true. Empty array → false.
  - Example:
    ```json
    {
      "type": "or",
      "conditions": [
        { "type": "test", "ret": false },
        { "type": "test", "ret": true }
      ]
    }
    ```

- **not**: logical negation of a single sub-condition.
  - Fields: `condition: Condition`
  - Result: negates the result of the given condition. If `condition` is omitted, defaults to `true`.
  - Example:
    ```json
    { "type": "not", "condition": { "type": "test", "ret": false } }
    ```

- **test**: helper for simple boolean checks in examples/tests.
  - Fields: `ret: boolean`
  - Result: returns `ret` as-is.
  - Example:
    ```json
    { "type": "test", "ret": true }
    ```

- **cookie**: checks for the existence (and optional value) of a cookie for a given domain.
  - Fields:
    - `domain` (string, required): domain to query (e.g. `"example.com"`).
    - `name` (string, required): cookie name to match.
    - `value` (string, optional): requires exact value match.
    - `value_contain` (string, optional): requires cookie value to contain this substring.
  - Result: true if a cookie with `name` exists for `domain` and, if provided, both `value` and `value_contain` conditions are satisfied.
  - Notes:
    - Requires the `"cookies"` permission (already included in this add-on’s manifest).
    - `domain` should be a host like `example.com` (no scheme/path). Matching follows the browser’s cookie domain rules.
  - Examples:
    ```json
    { "type": "cookie", "domain": "example.com", "name": "sessionid" }
    ```
    ```json
    {
      "type": "cookie",
      "domain": "example.com",
      "name": "sessionid",
      "value": "abc123"
    }
    ```

- **url**: matches a URL against a regular expression.
  - Fields:
    - `pattern` (string, required): JavaScript RegExp pattern (without flags) tested against a URL string.
  - Example:
    ```json
    { "type": "url", "pattern": "https://example\\.com/api" }
    ```
    ```json
    {
      "type": "cookie",
      "domain": "example.com",
      "name": "sessionid",
      "value_contain": "abc"
    }
    ```

Composing conditions

- You can nest `and`/`or` with other conditions to express complex logic, e.g.:

  ```json
  {
    "type": "and",
    "conditions": [
      { "type": "cookie", "domain": "example.com", "name": "session" },
      {
        "type": "or",
        "conditions": [
          {
            "type": "cookie",
            "domain": "example.com",
            "name": "flags",
            "value_contain": "beta"
          },
          { "type": "test", "ret": true }
        ]
      }
    ]
  }
  ```

- You can also use `not` to invert checks, for example:
  ```json
  {
    "type": "and",
    "conditions": [
      {
        "type": "not",
        "condition": {
          "type": "cookie",
          "domain": "example.com",
          "name": "opt_out"
        }
      },
      { "type": "cookie", "domain": "example.com", "name": "session" }
    ]
  }
  ```

Notes: the notification is informational only (no action buttons). Once shown for a given base domain, it won’t be shown again for that domain unless suppression is reset (see below).

### Reset suppression (tests/QA)

- Clear the pref `extensions.ippactivator.notifiedDomains` (remove the user value) to reset per-domain suppression.
- From tests using the browser helper, call `clearNotifiedDomains()` defined in `browser/head.js`.

## License

MPL-2.0. See file headers and `package.json`.
