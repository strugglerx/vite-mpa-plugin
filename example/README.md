# vite-plugin-mpa 示例

演示在**同一代码库**里放两套互不相混的 Vue 3 多页应用（各带 `vue-router`），通过 `build.rollupOptions.input` 多入口打包。

## 目录结构

```
example/
├── vite.config.js          # root 为 example/；input 键 main、login
├── public/index.html       # 开发/构建后根路径导航（不要与 MPA 键 `index` 抢 /index.html）
├── app/
│   ├── page1/              # 第一套：index.html + main.js + App.vue + router
│   └── page2/              # 第二套：同上
└── dist/                   # 构建输出（已加入父级 .gitignore，勿提交）
```

## 脚本

| 命令 | 说明 |
|------|------|
| `npm install` | 安装依赖（插件用 `file:..` 指向父目录，改发版后可换 npm 版本号） |
| `npm run dev` | 开发，默认 <http://localhost:5173/> |
| `npm run build` | 生产构建，生成 `dist/` |
| `npm run preview` | 本地预览构建结果 |

## 访问地址（开发）

- 根导航：`/` → `public/index.html`
- 虚拟路径（与产物键一致）：`/main/index.html`、`/login/index.html`
- 源码真实路径（亦可打开，便于对照）：`/app/page1/index.html`、`/app/page2/index.html`

## 构建产物（默认 `outDir: dist`）

- `dist/index.html` — 来自 `public/`
- `dist/main/index.html`、`dist/login/index.html` — 各 MPA 入口；静态资源在 `dist/assets/`

主入口用键名 **`main`** 而不是 `index`，避免与根 `index.html` 冲突。若你确实要键 `index` + 另有 `public/index.html`，需二选一或改名（见主 README「开发服务器与 base」节）。

## 多键指向同一页（可选）

若两个 `input` 键指向**同一** `app/.../index.html`，会打出**两份** HTML（如 `index.html` 与 `xxoo/index.html`），插件在父包 `writeBundle` 中从同一份 Vite 输出复制到各目标；详见 [CHANGELOG.md](../CHANGELOG.md)。

## 与仓库根目录

在仓库根执行 `make test` 或 `npm test` 可测插件主包。本目录仅作集成示例，不参与发布 npm 的 `files` 列表。
