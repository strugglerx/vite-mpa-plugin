# Changelog

## 1.2.2

仅文档与说明。

- **适用场景**后增加 **「何时不必用、与别种形态怎么分」**（单页、纯多页、多包 monorepo、与本插件形态对照）。
- **`input` 与 `dist` 树**：与 [example](example/) 的 `index`+`main`+`login` 及 `rollup output` 下 `static/` 布局示例对齐；说明 chunk 目录取决于 `build.rollupOptions.output`。

## 1.2.1

### 新增

- **开发启动日志**：`vite` / `pnpm run dev` 时（默认）在控制台打印 `build.rollupOptions.input` 各键对应的页面 URL（已拼 `config.base`）与源 `*.html` 路径。关闭：`MpaPlugin({ logInputMap: false })`。

### 文档

- 文首增加**适用场景**；完善「`input` 怎么配、产物在哪里」、示例 `dist` 与配置说明。

## 1.2.0

**相对 1.1.x 的重要变更**：产物 HTML 的**相对 `dist` 路径**由 `rollupOptions.input` 的**键**按 [虚拟路径规则](README_ZH.md#rollupoptionsinput-的键与虚拟路径)决定，不再强制与源码目录一致；构建时若与 Vite 先写出的路径不同，插件会在 `writeBundle` 中**移动/复制** HTML。从 1.1.x 升级请检查线上 URL、导航链接与 `public` 里是否已有与键同名的 `index.html`。

### 新增与行为

- **`input` 键名即「展示用」路径**：如键 `login` → `dist/login/index.html`；**值**仍指向磁盘上真实 `*.html`（可绝对路径）。
- **开发**：`configureServer` 使用 `order: 'pre'`，便于用与构建一致的虚拟 URL（如 `/main/index.html`）访问；支持 `config.base` 剥前缀。
- **`rewriteHtmlRelativeToRoot`（默认开启）**：把各页 HTML 里 `./`、`../` 的 `script[src]` / `link[href]` 改写成相对项目 `root` 的 URL，避免键与源码目录脱钩时 `./main.js` 解析失败；可设 `false` 关闭。
- **多键共指同一 `*.html`**：会生成多份产物；从 Vite 写出的一份源文件复制到各键对应路径后再删源（见文档）。

### 其它

- 依赖与测试方式不变；`createMpaPlugin` + `htmlMinify` 仍可选。

## 1.1.1 及更早

见 [git 历史](https://github.com/strugglerx/vite-mpa-plugin/commits) 与 npm 版本说明。
