# @struggler/vite-plugin-mpa

> **中文** · [README_ZH.md](./README_ZH.md)

[![npm version](https://img.shields.io/npm/v/@struggler/vite-plugin-mpa.svg)](https://www.npmjs.com/package/@struggler/vite-plugin-mpa)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Vite](https://img.shields.io/badge/Vite-Plugin-646CFF?logo=vite)](https://vitejs.dev)

A [Vite](https://vitejs.dev) plugin for **multi-page (MPA)** apps. For each `build.rollupOptions.input` entry, the **key** chooses the **virtual** HTML path (and thus the usual `dist/…` layout), while the **value** points at the real `*.html` on disk (absolute paths are fine). Virtual module resolution keeps dev and build consistent; optional build-time HTML minify. See [CHANGELOG.md](./CHANGELOG.md) for release notes.

**npm:** [`@struggler/vite-plugin-mpa`](https://www.npmjs.com/package/@struggler/vite-plugin-mpa) · **GitHub:** [`strugglerx/vite-mpa-plugin`](https://github.com/strugglerx/vite-mpa-plugin)

|  |  |
|--|--|
| Key → output | Virtual path per [key rules](#rollup-input-keys-and-virtual-paths); `writeBundle` relayout to match when Vite first emits under the source tree. |
| Same file, many keys | Multiple `input` keys can target one `*.html`; each key gets its own output path. |
| Dev | `configureServer` with `order: 'pre'`, URL shape close to production; `base` stripping. |
| `./main.js` | Optional rewrite of relative `script` / `link` URLs to root-based paths (`rewriteHtmlRelativeToRoot`, on by default). |
| More | `inject`, `styleInline`, `createMpaPlugin` + `htmlMinify`. |

**Example** [example/](example/): two Vue 3 mini-apps under `app/page1/` and `app/page2/`; keys `main` and `login` → `dist/main/index.html`, `dist/login/index.html`. A root `public/index.html` is the nav; the first app is not keyed `index` to avoid clashing with `/index.html`.

## Contents

- [What it does](#what-it-does)
- [Requirements](#requirements)
- [Install](#install)
- [Build output in `dist`](#build-output-in-dist)
- [Usage](#usage)
- [Options](#options)
- [TypeScript](#typescript)
- [Rollup `input` keys and virtual paths](#rollup-input-keys-and-virtual-paths)
- [Dev server and `base`](#dev-server-and-base)
- [Inline styles (`replaceIndexStyle`)](#inline-styles-replaceindexstyle)
- [Exports](#exports)
- [Links](#links)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [License](#license)

## What it does

With several HTML entry points, Rollup and the Vite dev server can disagree on how virtual entries map to files. This plugin:

- Rewrites `options.input` to prefixed virtual IDs, then uses `resolveId` + `load` to read the real `*.html` files;
- In dev, maps request URLs to the correct `input` entry, stripping [`config.base`](https://vitejs.dev/config/shared-options.html#base) from the path when needed.

You can add **build-only** HTML minification via [html-minifier-terser](https://github.com/terser/html-minifier-terser) (`transformIndexHtml`, `enforce: "post"`).

## Requirements

- **Vite** `>=3` (peer dependency — install in your app)
- **Node.js 18+** recommended (uses `structuredClone`, etc.)

## Install

```bash
npm install @struggler/vite-plugin-mpa
# or
pnpm add @struggler/vite-plugin-mpa
# or
yarn add @struggler/vite-plugin-mpa
```

## Build output in `dist`

By default, `build.outDir` is `dist`. If you have **not** customized HTML naming in `build.rollupOptions.output`, each **rollup `input` key** usually becomes one `.html` at the **root** of the output directory.

Example:

```js
// vite.config.js (excerpt)
export default {
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
        about: "src/pages/about/index.html",
      },
    },
  },
}
```

| `input` **key** | Typical file (`outDir: 'dist'`) | Note |
|-----------------|--------------------------------|------|
| `index` | `dist/index.html` | Main entry, matches `index: "index.html"` on disk |
| `about` | `dist/about.html` | Named from the key — **not** `dist/about/index.html` unless you change Rollup output options |

**With this plugin:** the **virtual** HTML path (and, after a built-in relayout step, the `dist/…` layout) follow the **rollup `input` key** and the [virtual-path table](#rollup-input-keys-and-virtual-paths) (e.g. key `main` + file `app/page1/index.html` → `main/index.html` at `dist/…`). The **value** in `input` is the real `*.html` on disk; script and asset resolution use that file’s real directory. (Vite may first emit under the source path; the plugin then moves the file to the key path when they differ, without an `outHtml` option.)

**Multiple keys for the same `*.html`:** you get one built HTML per key (same content, different output paths). The plugin copies from Vite’s single emitted file under the source path to **each** target path, then deletes the source once. If you open the project by the deep source URL in dev, the first matching key wins for `inject` / context.

If you set `entryFileNames`, extra output dirs, or other Rollup options, your layout may differ; run `npx vite build` and inspect. See [Vite — Multi-page app](https://vitejs.dev/guide/build.html#multi-page-app).

## Usage

### `MpaPlugin` — MPA only

```js
// vite.config.js
import { MpaPlugin } from "@struggler/vite-plugin-mpa"

export default {
  plugins: [MpaPlugin()],
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
        about: "src/pages/about/index.html",
      },
    },
  },
}
```

- The **key** in `input` controls the virtual path rule (table below). The **value** is the real HTML path relative to project root.

### `createMpaPlugin` — MPA + build-time HTML minify

```js
import { createMpaPlugin } from "@struggler/vite-plugin-mpa"

export default {
  plugins: createMpaPlugin({ htmlMinify: true }),
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
        about: "src/pages/about/index.html",
      },
    },
  },
}
```

- `htmlMinify: true` uses the plugin’s default minify options.
- `htmlMinify: { ... }` shallow-merges with [html-minifier-terser](https://github.com/terser/html-minifier-terser#options-quick-reference) (see [html-minify.js](./html-minify.js) defaults and `...options`).

`createMpaPlugin` is `[MpaPlugin(rest)]` when `htmlMinify` is off, or `[MpaPlugin(rest), htmlMinifyPlugin(opts)]` when on. The `htmlMinify` key is **not** passed to `MpaPlugin`.

## Options

| Option | Where | Description |
|--------|--------|-------------|
| `indexHtml` | `MpaPlugin` / `createMpaPlugin` | Main entry filename (default `index.html`). You can pass `main` or `main.html`; it joins with keys as `key/indexHtml`. |
| `inject` | same | Object for global `<%=%>` replacement, **or** a function `({ key }) => object` merged with `injectPages`. |
| `injectPages` | same | e.g. `{ about: { title: 'a' } }` — per-entry key overrides on top of `inject`. |
| `styleInline` | same | For “directory” `load` paths (e.g. `about/index.html` → `about` key), whether to inject `<style>` via a script. Default `true`; set `false` to skip. |
| `transformHtml` | same | `(html, { key, phase: 'load' \| 'serve' }) =>` HTML. See pipeline below. |
| `debug` | same | `true` logs resolution under `[vite-plugin-mpa]`. |
| `rewriteHtmlRelativeToRoot` | same | Default `true`: rewrites `./` / `../` in `script[src]` and `link[href]` to a path from project `root` (with `config.base`), so `./main.js` still works when `input` keys do not mirror the source folder and `dist` HTML is moved to the key path. Set `false` if you only use fixed or root-absolute URLs. |
| `htmlMinify` | `createMpaPlugin` only | `true` (defaults), an options object, or unset (no minify plugin). |

**`load` pipeline (directory / nested entry):** read disk → `transformHtml` (`phase: 'load'`) → optional `rewriteHtmlRelativeToRoot` → if `styleInline !== false`, `replaceIndexStyle` → `replaceInject`.  
**“Direct” entry (key is `*.html`-style as resolved):** read → `transformHtml` → `replaceInject` (no `replaceIndexStyle`).  
**Dev server:** read → `transformHtml` (`phase: 'serve'`) → `replaceInject` (no `replaceIndexStyle`).

### Inject example

`index.html`:

```html
<title><%= pageTitle %></title>
```

```js
MpaPlugin({
  inject: { pageTitle: "My site" },
  injectPages: {
    about: { pageTitle: "About" },
  },
})
```

## TypeScript

Types are in [index.d.ts](./index.d.ts). `vite` is a peer; add `npm i -D vite` if your IDE does not resolve `import type { Plugin } from "vite"`.

## Rollup `input` keys and virtual paths

(Assuming default `indexHtml` of `index.html`.)

| Key | Virtual path (relative to `root`) |
|-----|-----------------------------------|
| Ends with `.html` | Same as the key, e.g. `entry.html` |
| Exactly `index` | Your `indexHtml` (default `index.html`) |
| Anything else | `${key}/<indexHtml>` (e.g. `about/index.html` by default) |

On `load`, besides matching a key that equals a relative path, the plugin can strip a trailing `/<indexHtml>` and match by key; **`replaceIndexStyle` runs only on that “directory-style” path** (unless `styleInline: false`).

## Dev server and `base`

After ignoring paths that contain `@` (Vite internals), the middleware **strips** [`config.base`](https://vitejs.dev/config/shared-options.html#base) from the URL (e.g. `base: '/app/'` and request `/app/about` → match `input` key `about`). Path shape rules (empty, `.html`, or extensionless) align with the [build key table](#build-output-in-dist) above; the **new** part here is `base` handling.

**Dev URLs match the virtual paths** (same rules as the [virtual-path table](#rollup-input-keys-and-virtual-paths) and the built `dist` layout, e.g. key `index` → `/index.html`, key `login` → `/login/index.html`). The middleware is registered with **`configureServer` + `order: 'pre'`** so it usually runs **before** static `public` files, and you can open those paths without relying on a deep source-only URL. If both `public/index.html` and an MPA `index` key exist, they compete for `/index.html`—use another key (e.g. `main`) for the app, or adjust `public`.

## Inline styles (`replaceIndexStyle`)

When a `load` only matches by stripping the trailing `index.html` segment, `<style>` blocks are moved into a runtime `<script>` that creates a `<style>` element, using `textContent` and `JSON.stringify` so CSS with backticks / `${` does not break the script. Set `styleInline: false` to skip, or use a “direct” match so this branch is not used.

## Exports

| Name | Description |
|------|-------------|
| `MpaPlugin` | Returns a Vite plugin. Options in the [table](#options). |
| `createMpaPlugin` | Returns an array of plugins; can append minify. `htmlMinify` is not passed to `MpaPlugin`. |

## Changelog

[CHANGELOG.md](./CHANGELOG.md) (breaking changes on major bumps).

## Links

- **npm** — <https://www.npmjs.com/package/@struggler/vite-plugin-mpa>
- **Repository** — <https://github.com/strugglerx/vite-mpa-plugin>
- **Issues** — <https://github.com/strugglerx/vite-mpa-plugin/issues>
- **Vite** — <https://vitejs.dev>

## Contributing

Issues and pull requests are welcome. For larger changes, please open an issue first.

**Tests:** `npm test` ([Vitest](https://vitest.dev/)).

## License

**MIT** — see [LICENSE](./LICENSE).

*Copyright (c) 2026 moqi (str@li.cm)*. The full text of the MIT License is in the `LICENSE` file; it must be included in redistributions. This short note is not legal advice.
