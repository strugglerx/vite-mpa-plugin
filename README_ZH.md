# @struggler/vite-plugin-mpa

> **English** · [README.md](./README.md)

[![npm version](https://img.shields.io/npm/v/@struggler/vite-plugin-mpa.svg)](https://www.npmjs.com/package/@struggler/vite-plugin-mpa)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Vite](https://img.shields.io/badge/Vite-Plugin-646CFF?logo=vite)](https://vitejs.dev)

## 适用场景

适合这些情况：

- **一个仓库里多套互相独立的前端**（如多个子目录各有一套 `index.html` + 入口 JS/Vue，彼此之间不必打进同一个单页 bundle）：活动页、管理端与官网后台、**同一 Vite 项目里多个「小站点」**等。
- **多入口、但共用通用组件与基建**（`components/`、`shared/`、`utils/` 等被多个子应用引用）：每个「项目」仍是**独立 HTML 入口与打包产物**，却可复用同一套 UI、主题或业务组件，实现**不同形态/不同路由应用**而不必拆成多个仓库；与单页里拆 route 不同，这里是**多套独立 bundle**，由本插件把各入口的 dev/build 路径对齐。
- 希望 **线上或静态托管时的访问路径** 由你自定义（`main/login/promo` 等），**不强制** 与源码目录一一对应；`rollupOptions.input` 的 **键** 决定 `dist` 里 HTML 落在哪、**值** 仍指向真实 `*.html`（见下节 [`input` 与产物](#input-怎么配产物在哪里)）。
- 需要 **开发 `pnpm run dev` 与 `vite build` 用同一套规则**（虚拟路径、`base` 一致），并可选在启动 dev 时 **打印「键 → 页面 URL」映射**（`logInputMap`）。

本插件不替代 Vite 自带的多页配置，而是补上 **多入口在 dev/build 下路径一致、相对脚本可写、键 `index` 在根上单独成页** 等 MPA 常见痛点。更细的机制见 [它解决什么问题](#它解决什么问题)。

### 何时不必用、与别种形态怎么分

| 形态 | 说明 |
|------|------|
| **标准单页（SPA）** | 一个 `index.html`、一个入口，用 vue-router 等切页面——**一般不需要**本插件。 |
| **纯多页、且不在意 dev URL 与 `dist` 结构是否和「键名规则」一致** | 可先用**不带**本插件的 Vite 多页；遇到相对资源、dev/build 路径不一致再考虑接入。 |
| **pnpm / npm 多包 monorepo** | 每个包各自一个 Vite 工程、各自 `index.html` 时，是**多仓库式**组织，通常**不依赖**本插件的「同仓多入口虚拟路径」能力；只有当你**坚持单包多 HTML 入口**时才相关。 |
| **本插件对应的形态** | **同一份 Vite 配置里多个 `input`、多份独立主 bundle**；可与 **共用 `components/`** 等并存，但**不是**「一个大 SPA 里多路由」的同一件事。 |

**npm 包：** [`@struggler/vite-plugin-mpa`](https://www.npmjs.com/package/@struggler/vite-plugin-mpa) · **源码仓库：** [`strugglerx/vite-mpa-plugin`](https://github.com/strugglerx/vite-mpa-plugin) · 更新说明 [CHANGELOG.md](./CHANGELOG.md)

**特性一览**

|  |  |
|--|--|
| 键名 → 产物路径 | 虚拟 HTML 按 [键与虚拟路径](#rollupoptionsinput-的键与虚拟路径) 生成；**仅键名为 `index` 时**在根下为单个 `index.html`（无 `index/` 目录），其它短键为 `键名/index.html`（如 `login` → `login/index.html`）。 |
| 多键同页 | 多个键可指向同一 `*.html`，打多份到各自虚拟路径。 |
| 开发体验 | 中间件 `order: 'pre'`，用与生产相近的「虚拟」URL 访问；支持 `base` 剥前缀。 |
| `./main.js` | 默认将相对 `src` / `href` 改写为相对项目根路径（`rewriteHtmlRelativeToRoot`），可关。 |
| 其它 | 占位符 `inject`、目录型页的 `styleInline`、可扩展 `createMpaPlugin` + `htmlMinify`。 |

**示例项目** [example/](example/)：两套独立 Vue 3 多页子应用（`app/page1/`、`app/page2/`）；演示 `index` / `main` 同指一页、`login` 指向另一套，并含根导航 `public/index.html`。构建后见 `example/dist` 与 [上文说明](#input-怎么配产物在哪里)。

## 目录

- [适用场景](#适用场景)
- [何时不必用、与别种形态怎么分](#何时不必用与别种形态怎么分)
- [它解决什么问题](#它解决什么问题)
- [要求](#要求)
- [安装](#安装)
- [`input` 怎么配、产物在哪里](#input-怎么配产物在哪里)
- [用法](#用法)
- [配置项](#配置项)
- [TypeScript](#typescript)
- [`rollupOptions.input` 的键与虚拟路径](#rollupoptionsinput-的键与虚拟路径)
- [开发服务器与 `base`](#开发服务器与-base)
- [内联样式与 replaceIndexStyle](#内联样式与-replacestyle)
- [导出](#导出)
- [更新日志](#更新日志)
- [相关链接](#相关链接)
- [贡献](#贡献)
- [许可证](#许可证)

## 它解决什么问题

仅配置多个 HTML 入口时，Rollup 与 dev server 对「虚拟入口 / 路径」的解析可能不一致。本插件会：

- 在 `options` 里把各入口改写为带前缀的虚拟 id，再经 `resolveId` + `load` 读回真实磁盘上的 `*.html`；
- 在开发服务器中按 URL 路径选择对应的 `input` 条目并返回内容，并**按 Vite 的 `base` 去掉前缀**后再匹配，便于子路径部署。

可选依赖 [html-minifier-terser](https://github.com/terser/html-minifier-terser) 做**仅构建时**的 `transformIndexHtml` 压缩（`enforce: "post"`）。

## 要求

- **Vite** `>=3`（`peerDependencies`，需自行安装）
- 建议使用 **Node.js 18+**（实现中使用了 `structuredClone` 等较新能力）

## 安装

```bash
npm install @struggler/vite-plugin-mpa
# 或
pnpm add @struggler/vite-plugin-mpa
# 或
yarn add @struggler/vite-plugin-mpa
```

## `input` 怎么配、产物在哪里

约定（`build.outDir` 默认可理解为 `dist`，下文路径均相对它）：

| | 含义 |
|--|------|
| `input` 的**值** | 磁盘上**真实**的 `*.html` 路径，Vite 从这份文件进打包；脚本/资源按该文件所在目录解析。 |
| `input` 的**键** | 决定**打包后**那份 HTML 在 `dist` 里落在哪（**虚拟路径**；与「值」的目录可以完全不同）。 |

**键 → 产出的 HTML 路径**（默认 `indexHtml` 为 `index.html` 时；键名以 `xxx.html` 形式结尾时见 [下表详列](#rollupoptionsinput-的键与虚拟路径)）：

| 键 | 产物（相对 `outDir`） |
|----|------------------------|
| `index` | `index.html`（**仅根下这一份**，没有 `index/` 目录） |
| 其它单段键，如 `main`、`login` | `键名/index.html`，如 `main/index.html` |

**配置与结果示例**（与 [example/vite.config.js](example/vite.config.js) 一致时可含多键同页）：

```js
// build.rollupOptions.input
{
  index: "app/page1/index.html",
  main:  "app/page1/index.html", // 与 index 同页，打两份到不同 URL
  login: "app/page2/index.html",
}
```

→ 键 `index` → 根上 `index.html`；`main` / `login` → `main/index.html`、`login/index.html`（见 [键与虚拟路径](#rollupoptionsinput-的键与虚拟路径)）。`public/index.html` 若存在也会复制到根上 `index.html`，与是否再配键 `index` 可能**冲突**，需二选一或改名（见 [开发服务器与 `base`](#开发服务器与-base)）。

`dist` 实勘树（在 `example/` 下 `vite build`；**JS/CSS 等 chunk 目录**由 `build.rollupOptions.output` 决定，默认多为 `assets/`，[example](example/) 内为 `static/js/`、`static/css/` 等；带 hash 的文件名每次构建可能变）：

```text
example/dist/
├── index.html                 # 根页：常来自 public；若同时用键 index 会与 public 争路径
├── main/index.html            # 键 main
├── login/index.html           # 键 login
└── static/                    # example 自定义 output；默认无此层则为 assets/
    ├── js/…
    └── css/…
```

Vite 可能先把 HTML 按源码位置写出，插件再在 `writeBundle` 里**挪**到上表对应路径。**多个键**指向**同一份** `*.html` 时，会打多份，各落一路径；你改了 `rollupOptions.output` 等时以实勘为准。无插件时纯 Vite 多页常是 `dist/键名.html`，与上表**不同**。[Vite 多页说明](https://cn.vitejs.dev/guide/build.html#multi-page-app)。

## 用法

### `MpaPlugin`：仅 MPA 行为

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

- `input` 的**键**用于虚拟路径规则（见下表）；**值**为相对项目根的真实 HTML 路径。

### `createMpaPlugin`：MPA + 构建期 HTML 压缩

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

- `htmlMinify: true` 时使用内置默认压缩选项。
- `htmlMinify: { ... }` 时在该默认之上合并（浅合并到 `minify` 的选项，见 [html-minify.js](./html-minify.js) 中的默认项与 `...options`）。

`createMpaPlugin` 在未开启 `htmlMinify` 时等价于 `[MpaPlugin(其余配置)]`；开启时等价于 `[MpaPlugin(...), htmlMinifyPlugin(选项)]`。`htmlMinify` 会先从配置里拆出，不会传给 `MpaPlugin`。

## 配置项

| 选项 | 适用 | 说明 |
|------|------|------|
| `indexHtml` | `MpaPlugin` / `createMpaPlugin` | 主入口 HTML 文件名，默认 `index.html`。可写 `main` 或 `main.html`；会参与虚拟路径 `键/indexHtml` 的拼法。 |
| `inject` | 同上 | 对象：全局 `<%=%>` 替换；**或**函数 `( { key } ) => 对象`（`key` 为 `input` 的键），再与 `injectPages` 合并。 |
| `injectPages` | 同上 | 形如 `{ about: { title: 'a' } }`，对指定入口键在全局 `inject` 之上**覆盖/补充**。 |
| `styleInline` | 同上 | 仅影响「目录型」`load` 路径（如 `about/index.html` 解析到 `about` 键时）是否对 `<style>` 做脚本注入。默认 `true`；设 `false` 可关闭。 |
| `transformHtml` | 同上 | `(html, { key, phase: 'load' \| 'serve' }) =>` 返回 HTML；`load` 在构建；`serve` 在 dev 中间件。在 `load` 链中于 `styleInline` 之前、**之后**为 `replaceInject`（见下顺序）。 |
| `debug` | 同上 | `true` 时向控制台输出 `[vite-plugin-mpa]` 解析日志。 |
| `logInputMap` | 同上 | 默认在 **dev**（`vite` / `pnpm run dev`）启动时打印各 `input` **键** → 页面 URL（含 `base`）← 源 `*.html`；设 `false` 可关闭。`build` 不打印。 |
| `rewriteHtmlRelativeToRoot` | 同上 | 默认 `true`：把各页 `script[src]`、`link[href]` 里以 `./`、`../` 开头的路径改写成相对项目 `root` 的 URL（并带 `config.base`），这样在 `input` 键与源码目录不一致、且产物落在 `dist/index.html` 等键名路径时，仍可在 HTML 里写 `./main.js`。若你已全部使用根路径或绝对地址，可设 `false`。 |
| `htmlMinify` | 仅 `createMpaPlugin` | `true` 使用默认压缩；`object` 为 [html-minifier-terser](https://github.com/terser/html-minifier-terser#options-quick-reference) 选项；未设置不压缩。 |

**`load` 链顺序（子页/目录型入口）：** 读盘 → `transformHtml`（`phase: 'load'`）→ 可选 `rewriteHtmlRelativeToRoot` → 若 `styleInline !== false` 则 `replaceIndexStyle` → `replaceInject`。  
**仅「键为 `*.html` 的直连型」入口：** 读盘 → `transformHtml` → `rewriteHtmlRelativeToRoot`（默认可用）→ `replaceInject`（无 `replaceIndexStyle`）。  
**开发服务器：** 读盘 → `transformHtml`（`phase: 'serve'`）→ `replaceInject`（**不做** `replaceIndexStyle`）。

### 注入示例

`index.html` 中写：

```html
<title><%= pageTitle %></title>
```

```js
MpaPlugin({
  inject: { pageTitle: "我的站点" },
  injectPages: {
    about: { pageTitle: "关于" },
  },
})
```

## TypeScript

包内提供 [index.d.ts](./index.d.ts)。`vite` 为 peer，IDE 会解析 `import type { Plugin } from "vite"`；若只安装本包而未装 `vite`，请补上 `npm i -D vite`。

## `rollupOptions.input` 的键与虚拟路径

（以下默认主入口文件名为 `index.html`，与插件选项 **`indexHtml`** 一致；若你配置了 `MpaPlugin({ indexHtml: "main.html" })`，下表中的「`index.html`」均指 `main.html`。）

| 键 | 虚拟路径（相对 `root` 的路径语义） |
|----|--------------------------------------|
| 以 `.html` 结尾 | 与键相同，例如 `entry.html` |
| 恰好为 `index` | **根下单独一个文件**：`<indexHtml>`（默认 `index.html`），**不是** `index/index.html` |
| 其他 | `${键}/<indexHtml>`（默认即 `${键}/index.html`） |

**为何单独强调键 `index`：** 只有键名**严格等于**字符串 `index` 时，虚拟路径是「`root` 下的一个同名 HTML 文件」——与「普通短键」不同。例如键 `main`、`login` 会落在 `main/index.html`、`login/index.html` 这种**目录 + 文件名**；而键 `index` 会落在 `index.html`（在 `root` 下），**没有**中间的 `index/` 目录。这样符合常见习惯：主站入口在站点的 `/index.html`（或带 `base` 的同构路径），其它子应用各占子路径。若你希望主应用也在 `myapp/index.html` 这种结构下，请不要用键 `index`，改用键名如 `myapp` 或 `app`。

**与 `public/index.html`：** 根路径 `index.html` 往往已被 `public/index.html` 或静态导航占用。若 MPA 主入口**也**用键 `index`，会与「根 `index.html`」争同一路径，典型做法是主应用改用键名如 `main`（见 [example](example/)），或不要同时放会冲突的 `public/index.html`。

**与键名 `index.html` 的区别：** 若 `input` 的键是 **`index.html`**（以 `.html` 结尾），按上表第一行，虚拟路径就是字面量 `index.html`；这与键 **`index`** 在默认 `indexHtml` 下结果相同，但 `inject` / `transformHtml` 的 `key` 参数分别是 `"index.html"` 与 `"index"`，请注意区分。

构建阶段 `load` 时，除直接按键名等于相对路径的条目匹配外，还会把路径去掉末尾的 `/<indexHtml>` 再按**键**匹配；**仅在后者**上默认执行 `styleInline` 对应的 `replaceIndexStyle`（若未关闭）。

## 开发服务器与 `base`

中间件在排除含 `@` 的路径后，**会先用 [Vite 的 `config.base`](https://cn.vitejs.dev/config/shared-options.html#base) 从 `pathname` 中剥掉子路径**（如 `base: '/app/'` 时，请求 `/app/about` 按 `about` 去匹配 `input`）。

空路径、`.html` 结尾、以及无扩展名路径的匹配与上文 [`input` 与产物](#input-怎么配产物在哪里) 一致，不再赘述；**本插件新增**的是按 `config.base` 从 URL 中剥掉子路径再匹配 `input`。

**开发时访问的 URL 与「虚拟路径」一致**（与 [键与虚拟路径](#rollupoptionsinput-的键与虚拟路径) 表、以及 `dist` 下最终 HTML 路径同一套规则，例如键 `index` → `/index.html`，键 `login` → `/login/index.html`）。中间件使用 Vite 的 `configureServer`，并设 **`order: 'pre'`**，在多数情况下会先于 `public` 下的静文件处理，这样上述地址能直接打开对应 MPA，而不必在开发时强制用源码目录深路径。若项目里同时存在 `public/index.html` 与 `input` 键为 `index` 的入口，两者会争 `/index.html`：可给主应用换键名（如 `main`）、或调整 `public` 下的文件名。

## 内联样式与 replaceIndexStyle

当某次 `load` 通过「去掉路径末尾的 `index.html`」才匹配到对应 `input` 键时，默认把 `<style>...</style>` 抽离并在 `</body>` 前以 `document.createElement('style')` + **`textContent` + `JSON.stringify` 内联**（避免旧版反引号模板导致 CSS 含 `` ` `` / `${` 时脚本破裂）。`styleInline: false` 时跳过。

若不需要该行为，可设 `styleInline: false`，或让入口键与虚拟相对路径以「整路径直配」方式命中（见上文）。

## 导出

| 名称 | 说明 |
|------|------|
| `MpaPlugin` | 工厂函数，返回 Vite 插件；选项见上表。 |
| `createMpaPlugin` | 返回插件数组，可附带 `htmlMinify`；`htmlMinify` 不传给 `MpaPlugin`。 |

## 更新日志

[CHANGELOG.md](./CHANGELOG.md)（各版本变更与升级注意说明）。

## 相关链接

- **npm 包页** — <https://www.npmjs.com/package/@struggler/vite-plugin-mpa>
- **源码与版本** — <https://github.com/strugglerx/vite-mpa-plugin>
- **问题反馈** — <https://github.com/strugglerx/vite-mpa-plugin/issues>
- **Vite 文档** — <https://vitejs.dev>

## 贡献

欢迎通过 [Issue](https://github.com/strugglerx/vite-mpa-plugin/issues) 反馈问题，或通过 Pull Request 提交改进。在发起较大变更前，可先开 Issue 简单对齐预期。

**测试**：`npm test`（[Vitest](https://vitest.dev/)）。

## 许可证

**MIT**（[SPDX: MIT](https://spdx.org/licenses/MIT.html) · [OSI 摘要](https://opensource.org/licenses/MIT)）

- **完整条款**：以仓库内 [**LICENSE**](./LICENSE) 为准（含英文原文）。
- **版权**：*Copyright (c) 2026 moqi (str@li.cm)*，与 [LICENSE](./LICENSE) 中署名及 `package.json` 的 `author` 一致。再分发时须保留版权声明与上述许可原文。

*中文说明仅便于理解；有歧义时以 [LICENSE](./LICENSE) 英文原文为准。*
