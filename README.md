# @struggler/vite-plugin-mpa

> **中文** · [README_ZH.md](./README_ZH.md)

[![npm version](https://img.shields.io/npm/v/@struggler/vite-plugin-mpa.svg)](https://www.npmjs.com/package/@struggler/vite-plugin-mpa)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Vite](https://img.shields.io/badge/Vite-Plugin-646CFF?logo=vite)](https://vitejs.dev)

## When to use it

- **Multiple independent frontends in one repo** — e.g. several folders each with `index.html` + app entry, without merging them into one SPA bundle: landing pages, admin vs marketing, or several “mini sites” in a single Vite project.
- **Shared components, separate “projects”** — e.g. `components/`, `shared/`, or `utils/` imported from more than one entry folder. Each product stays its **own HTML entry and JS bundle**, but you reuse the same UI kit, theme, or hooks. Good for one design system with **multiple deployable surfaces** (not the same as one SPA with many routes — here each entry is built separately; this plugin keeps dev/build URL rules consistent for all of them).
- **URLs you control** — deployment paths like `/main/`, `/login/` come from the **`input` key**, while the **value** is still the real `*.html` on disk; no need to mirror the source tree (see [`input` → where files land](#input--where-files-land-in-dist)).
- **Same rules in dev and build** — virtual paths, `config.base`, and optional **startup log of key → page URL** on `pnpm run dev` (`logInputMap`).

This plugin augments Vite’s multi-page flow so dev and build stay aligned, relative scripts keep working, and the special `index` key maps to a single root `index.html`. Details: [What it does](#what-it-does).

### When you might skip it

*Compared to a single-page app, plain MPA, or a multi-package monorepo:*

| Situation | Notes |
|-----------|--------|
| **Classic SPA** | One `index.html`, one entry, client-side routes — you usually **don’t** need this plugin. |
| **Plain Vite MPA** | If you don’t care about **dev URL vs `dist` layout** matching the “key rules” below, try **without** the plugin first; add it if relative assets or path mismatch bite you. |
| **pnpm / npm monorepo** | One Vite app per package, each with its own `index.html` — that’s a **multi-package** setup; you often **don’t** need this plugin unless you want **one project, several HTML entries** with virtual paths. |
| **This plugin** | **Several `input` entries in one Vite app**, each its **own main bundle**; you can still share `components/`, but it is **not** the same as “one big SPA, many routes”. |

**npm:** [`@struggler/vite-plugin-mpa`](https://www.npmjs.com/package/@struggler/vite-plugin-mpa) · **GitHub:** [`strugglerx/vite-mpa-plugin`](https://github.com/strugglerx/vite-mpa-plugin) · [CHANGELOG.md](./CHANGELOG.md)

|  |  |
|--|--|
| Key → output | [Key rules](#rollup-input-keys-and-virtual-paths): only the literal key `index` maps to a **root** `index.html` (not `index/index.html`); any other key like `main` or `login` uses `key/index.html`. `writeBundle` relayouts when Vite first emits under the source tree. |
| Same file, many keys | Multiple `input` keys can target one `*.html`; each key gets its own output path. |
| Dev | `configureServer` with `order: 'pre'`, URL shape close to production; `base` stripping. |
| `./main.js` | Optional rewrite of relative `script` / `link` URLs to root-based paths (`rewriteHtmlRelativeToRoot`, on by default). |
| More | `inject`, `styleInline`, `createMpaPlugin` + `htmlMinify`. |

**Example** [example/](example/): two Vue 3 MPA apps under `app/page1/` and `app/page2/`; shows multiple keys to one page (`index` and `main` → same HTML) and `login` to the other, plus a root `public/index.html` for navigation. See `example/dist` and the [`input` section](#input--where-files-land-in-dist).

## Contents

- [When to use it](#when-to-use-it)
- [When you might skip it](#when-you-might-skip-it)
- [What it does](#what-it-does)
- [Requirements](#requirements)
- [Install](#install)
- [`input` → where files land](#input--where-files-land-in-dist)
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

## `input` → where files land in `dist`

(`build.outDir` defaults to `dist`; paths below are relative to it.)

| | Meaning |
|--|---------|
| **`input` value** | The **real** `*.html` on disk — Vite bundles from that file; script/asset resolution uses that file’s directory. |
| **`input` key** | Chooses the **output** path for that entry’s built HTML in `dist` (the virtual path, which can differ from the value’s folder). |

**Key → built HTML** (with default `indexHtml: "index.html"`; keys that end in `.html` are [listed below](#rollup-input-keys-and-virtual-paths)):

| Key | Output (relative to `outDir`) |
|-----|------------------------------|
| `index` | `index.html` only at the root (**not** `index/index.html`) |
| Other one-segment keys, e.g. `main`, `login` | `key/index.html` |

**Example (see [example/vite.config.js](example/vite.config.js) for `output` and optional multi-key / same file):**

```js
// build.rollupOptions.input
{
  index: "app/page1/index.html",
  main:  "app/page1/index.html", // two keys → two URLs, same file on disk
  login: "app/page2/index.html",
}
```

Key `index` → root `index.html`; `main` / `login` → `main/index.html`, `login/index.html` (see [virtual-path rules](#rollup-input-keys-and-virtual-paths)). A root `public/index.html` is also copied to `index.html` — that can **clash** with an `index` key; resolve by renaming the key, moving `public`, or similar (see [Dev server and `base`](#dev-server-and-base)).

**Sample tree** after `vite build` in `example/`: **chunk layout** (`assets/` vs `static/js/`, etc.) is controlled by `build.rollupOptions.output` (the example uses `static/…`); file names with hashes can change every build.

```text
example/dist/
├── index.html          # often from public; conflicts with `index` key if both set
├── main/index.html     # key main
├── login/index.html    # key login
└── static/             # example’s custom `output`; default is often `assets/`
    ├── js/…
    └── css/…
```

Vite may emit HTML under the **source** path first; this plugin then **moves** it in `writeBundle` to match the table. **Several keys** for the **same** `*.html` produce one output per key. If you change Rollup `output` options, verify with a real build. **Plain Vite (no plugin)** often uses `key.html` at the **root** of `dist` — different from the table. See [Vite — MPA](https://vitejs.dev/guide/build.html#multi-page-app) and the [virtual-path table](#rollup-input-keys-and-virtual-paths).

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
| `logInputMap` | same | On **dev** (`vite`, `pnpm run dev`), logs each `input` **key** → page URL (with `base`) ← source `*.html`. Default `true`; set `false` to silence. No print on `build`. |
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

(Assuming the plugin’s **`indexHtml`** option matches your entries—default is `index.html`. If you set `MpaPlugin({ indexHtml: "main.html" })`, replace `index.html` below with that filename.)

| Key | Virtual path (relative to `root`) |
|-----|-----------------------------------|
| Ends with `.html` | Same as the key, e.g. `entry.html` |
| **Exactly the string `index`** | A **single file at the project root**: `<indexHtml>` (default `index.html`). **Not** `index/index.html`. |
| Anything else | `${key}/<indexHtml>` (e.g. `main/index.html`, `login/index.html` by default) |

**Why `index` is special:** Only when the rollup input key is the literal string `index` does the virtual path point to one HTML file **directly under** `root` (e.g. `index.html`). For any other short key like `main` or `login`, the path is **`<key>/<indexHtml>`** (a “folder + file” under `root`). So the main MPA at key `index` lines up with `/index.html` at the site root, while other apps use `/main/index.html`, `/login/index.html`, etc. If you need the “main” app to also live at `myapp/index.html`, don’t use the key `index`—use e.g. `myapp` or `app` as the key.

**`public/index.html`:** The root `index.html` is often used for a static landing page. If the MPA also uses the key `index`, both target the same path—use another key (e.g. `main` for the first app) or change `public`, as in the [example](example/).

**Key `index` vs key `index.html`:** A key literally named `index.html` (first table row) also resolves to a path ending in `index.html`, but the `key` passed to `inject` / `transformHtml` is the string `index.html`, not `index`. Pick one convention and stay consistent.

On `load`, besides matching a key that equals a relative path, the plugin can strip a trailing `/<indexHtml>` and match by key; **`replaceIndexStyle` runs only on that “directory-style” path** (unless `styleInline: false`).

## Dev server and `base`

After ignoring paths that contain `@` (Vite internals), the middleware **strips** [`config.base`](https://vitejs.dev/config/shared-options.html#base) from the URL (e.g. `base: '/app/'` and request `/app/about` → match `input` key `about`). Path shape rules (empty, `.html`, or extensionless) align with the [`input` → output](#input--where-files-land-in-dist) section above; the **new** part here is `base` handling.

**Dev URLs match the virtual paths** (same rules as the [virtual-path table](#rollup-input-keys-and-virtual-paths) and the built `dist` layout, e.g. key `index` → `/index.html`, key `login` → `/login/index.html`). The middleware is registered with **`configureServer` + `order: 'pre'`** so it usually runs **before** static `public` files, and you can open those paths without relying on a deep source-only URL. If both `public/index.html` and an MPA `index` key exist, they compete for `/index.html`—use another key (e.g. `main`) for the app, or adjust `public`.

## Inline styles (`replaceIndexStyle`)

When a `load` only matches by stripping the trailing `index.html` segment, `<style>` blocks are moved into a runtime `<script>` that creates a `<style>` element, using `textContent` and `JSON.stringify` so CSS with backticks / `${` does not break the script. Set `styleInline: false` to skip, or use a “direct” match so this branch is not used.

## Exports

| Name | Description |
|------|-------------|
| `MpaPlugin` | Returns a Vite plugin. Options in the [table](#options). |
| `createMpaPlugin` | Returns an array of plugins; can append minify. `htmlMinify` is not passed to `MpaPlugin`. |

## Changelog

[CHANGELOG.md](./CHANGELOG.md) (notable changes between versions).

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
