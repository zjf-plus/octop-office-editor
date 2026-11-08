# Octop 的 Office / PDF 查看与编辑插件

在 [Octop](https://github.com/TencentCloud/Octop) 的工作区和对话中，原地查看、编辑 Word / Excel / PPT / CSV / PDF 文件，
保存后写回原文件、保持原格式。

编辑器基于 [ONLYOFFICE Docs](https://github.com/ONLYOFFICE/DocumentServer) 9.3（原始开发者：Ascensio System SIA），
通过 [ranuts/document](https://github.com/ranuts/document) 的离线包在浏览器中运行（x2t 以 WebAssembly 完成格式转换），
不需要文档服务器，断网可用，文件不离开本机。

## 功能

- 支持 docx / xlsx / pptx / csv / pdf 等格式，打开后可直接编辑，⌘S / Ctrl+S 保存写回原路径
- 有未保存的修改时，关闭或切换文件前会提示保存
- 大窗口与侧栏两种模式；手机上一律使用大窗口
- CSV 保存后仍是不带 BOM 的纯文本
- 内置常用中英文字体，不从外部下载任何资源
- 不使用 Service Worker

## 宿主要求

插件依赖宿主提供的文件查看扩展点，契约见 `ui/src/types.ts`：

- 前端：插件宿主对象提供 `registerFileViewer`，向查看器传入 `file.read` / `file.write`、`publicBaseUrl` 等
- 后端：`GET /api/plugin-public/<插件 id>/<路径>` 免登录提供插件 `public/` 目录下的静态文件；
  保存接口覆盖原文件

## 构建

```bash
# 1. 构建 ranuts/document：checkout patches/BASE 记录的基线，再应用本仓库的补丁
git clone https://github.com/ranuts/document.git ranuts-document
cd ranuts-document
git checkout $(awk '{print $3}' <本仓库>/patches/BASE)
git apply <本仓库>/patches/ranuts.patch
corepack pnpm@11.4.0 install --frozen-lockfile
corepack pnpm@11.4.0 run build

# 2. 构建插件：裁剪编辑器资源并拷入 public/，再构建插件界面
cd <本仓库>
npm install
RANUTS_DOCUMENT_DIST=<ranuts-document>/dist npm run build
```

产物是 `public/editor-<内容哈希>/`（编辑器）和 `ui/dist/index.js`（插件界面）。把整个目录放到
`$OCTOP_HOME/plugins/octop-office-editor` 后重启 Octop 即可。

## 目录

| 路径 | 内容 |
|---|---|
| `ui/src/` | 插件界面：外壳（标题栏、保存、窗口模式、关于对话框）与编辑器的消息通信；品牌在 `brand.ts` |
| `scripts/vendor-editor.mjs` | 把 ranuts 构建产物裁剪、打补丁后拷进 `public/`：去掉多余语言和模型、关闭 Service Worker、调整样式、精简字体、gzip 压缩 |
| `patches/` | 对 ranuts/document 的补丁及其基线 commit |
| `plugin.yaml`、`main.py` | Octop 插件清单与（空的）后端入口 |

## 对上游的修改

本项目是 ONLYOFFICE Docs 及 ranuts/document 的修改版本，修改始于 2026 年 11 月，主要包括：

- 嵌入模式下保存写回宿主文件，不触发浏览器下载；区分保存、打印与"下载为"
- 禁止执行文档宏；不注册 Service Worker；支持挂载在子路径下
- 界面：紧凑标题栏、白色主题、按文件类型着色、隐藏工具栏中的保存与打印按钮组
- 字体：只内置常用中英文字体，字体列表只保留 12 个常用名称，其余字体映射到同类内置字体
- 补全部分别名字体缺失的粗体 / 斜体字形
- 窄屏下自动收起 PPT 缩略图后同步左侧按钮状态

完整改动见 `patches/ranuts.patch` 与 `scripts/vendor-editor.mjs`。

## 许可证

本项目按 [GNU AGPL v3](LICENSE) 授权，并适用 ONLYOFFICE 依 AGPL 第 7 条附加的条款（见编辑器包内的 `LICENSE.txt`、`NOTICE.txt`）。
插件界面中的"关于"对话框列出原始开发者、版权、修改说明、免责声明与许可证信息；被修改的编辑器文件开头带有修改说明，
编辑器包内的 `NOTICE.txt` 末尾列出全部修改。

## 商标

- ONLYOFFICE 是 Ascensio System SIA 的商标。本项目与 Ascensio System SIA 无隶属关系，也未获其认可。
- 标题栏和关于对话框里的产品名称与图标在 `ui/src/brand.ts`，可替换为自己的品牌。
