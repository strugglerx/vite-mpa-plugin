# @struggler/vite-plugin-mpa

> **English** · [README.md](./README.md)

[![npm version](https://img.shields.io/npm/v/@struggler/vite-plugin-mpa.svg)](https://www.npmjs.com/package/@struggler/vite-plugin-mpa)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Vite](https://img.shields.io/badge/Vite-Plugin-646CFF?logo=vite)](https://vitejs.dev)

基于 [Vite](https://vitejs.dev) 的多页面（MPA）辅助插件。在 `build.rollupOptions.input` 中配置多份 `index.html` 时，用**虚拟入口**对齐磁盘上的真实 HTML，让构建与 dev 的解析一致；`rollup` 的 **键名** 决定**产物在 `dist` 里的大致路径**（与源码目录可不同），`input` 的**值** 指向各页实际文件。可选在构建期压缩 HTML。更新说明见 [CHANGELOG.md](./CHANGELOG.md)。

**npm 包：** [`@struggler/vite-plugin-mpa`](https://www.npmjs.com/package/@struggler/vite-plugin-mpa) · **源码仓库：** [`strugglerx/vite-mpa-plugin`](https://github.com/strugglerx/vite-mpa-plugin)

**特性一览**

|  |  |
|--|--|
| 键名 → 产物路径 | 虚拟 HTML 按键生成规则（如 `index` → `index.html`，`login` → `login/index.html`），构建后在 `writeBundle` 中归位到与键一致的路径。 |
| 多键同页 | 多个键可指向同一 `*.html`，打多份到各自虚拟路径。 |
| 开发体验 | 中间件 `order: 'pre'`，用与生产相近的「虚拟」URL 访问；支持 `base` 剥前缀。 |
| `./main.js` | 默认将相对 `src` / `href` 改写为相对项目根路径（`rewriteHtmlRelativeToRoot`），可关。 |
| 其它 | 占位符 `inject`、目录型页的 `styleInline`、可扩展 `createMpaPlugin` + `htmlMinify`。 |

**示例项目** [example/](example/)：两个独立 Vue 3 子应用（`app/page1/`、`app/page2/`），`input` 键为 `main`、`login`，产物为 `dist/main/index.html` 与 `dist/login/index.html`；根目录另有 `public/index.html` 作导航。主入口不占用键名 `index`，避免与根 `index.html` 冲突。

## 目录

- [它解决什么问题](#它解决什么问题)
- [要求](#要求)
- [安装](#安装)
- [构建产物在 dist 哪里](#构建产物在-dist-哪里)
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

## 构建产物在 `dist` 哪里

Vite 多页构建时，**默认** `build.outDir` 为 `dist`；在**未**自定义 `build.rollupOptions.output` 里 HTML 的命名规则时，**每个入口键**通常对应**根目录**下一个 `.html` 文件。

例如：

```js
// vite.config.js（节选）
export default {
  build: {
    // outDir 默认 'dist'
    rollupOptions: {
      input: {
        index: "index.html",
        about: "src/pages/about/index.html",
      },
    },
  },
}
```

| `input` 的**键** | 典型输出路径（`outDir: 'dist'`） | 说明 |
|------------------|----------------------------------|------|
| `index` | `dist/index.html` | 主入口，对应你磁盘上的 `index: "index.html"` |
| `about` | `dist/about.html` | 与键名一致，**不是** `dist/about/index.html`（除非你在 Rollup 输出里自己改了 `entry`/`chunk` 的命名与目录） |

**使用本插件时：** 虚拟 HTML 路径与 **`input` 的键** 及下述 [键与虚拟路径](#rollupoptionsinput-的键与-虚拟路径) 规则一致。Vite 可能先按源码位置写出 HTML，插件在 `writeBundle` 中再**挪**到与键一致的路径；**无需** `outHtml` 配置。`input` 的**值**是磁盘上真实 `*.html`，脚本/资源按该文件所在目录解析。

**多个键指向同一 `*.html`：** 会生成多份 HTML（各键一条虚拟路径），构建时从 Vite 写出的一份源文件**复制**到多个目标；开发时若用源码深路径访问，该路径只与**先出现**的键关联（用于 `inject` 等页级上下文）。

若你在 `build.rollupOptions.output` 中配置了 `entryFileNames`、多输出目录、或 Vite 的其它产物策略，**以你最终配置为准**；上表是 Vite 多页、默认选项下的**常见**布局。

在仓库根运行 `npx vite build` 可在你项目里实勘生成文件；也可查阅 [Vite 多页应用构建说明](https://cn.vitejs.dev/guide/build.html#multi-page-app)。

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

（以下默认主入口文件名为 `index.html`，与 `indexHtml` 配置一致。）

| 键 | 虚拟路径（相对 `root` 的路径语义） |
|----|--------------------------------------|
| 以 `.html` 结尾 | 与键相同，例如 `entry.html` |
| 恰好为 `index` | 你的 `indexHtml`（默认 `index.html`） |
| 其他 | `${键}/<indexHtml>`（默认即 `${键}/index.html`） |

构建阶段 `load` 时，除直接按键名等于相对路径的条目匹配外，还会把路径去掉末尾的 `/<indexHtml>` 再按**键**匹配；**仅在后者**上默认执行 `styleInline` 对应的 `replaceIndexStyle`（若未关闭）。

## 开发服务器与 `base`

中间件在排除含 `@` 的路径后，**会先用 [Vite 的 `config.base`](https://cn.vitejs.dev/config/shared-options.html#base) 从 `pathname` 中剥掉子路径**（如 `base: '/app/'` 时，请求 `/app/about` 按 `about` 去匹配 `input`）。

空路径、`.html` 结尾、以及无扩展名路径的匹配与上文 [构建产物在 dist 哪里](#构建产物在-dist-哪里) 的入口键说明一致，不再赘述；**本插件新增**的是按 `config.base` 从 URL 中剥掉子路径再匹配 `input`。

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
