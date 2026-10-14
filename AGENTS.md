# AGENTS.md — 文件批量盖章与水印工具（File Stamp Watermark）

本文件是仓库级行为规范，供在此仓库工作的 AI 智能体与协作者执行。

## 一、线上仓库白名单（铁律，2026-09-27 事故后确立）

本仓库同时推送 GitHub（gggg312/FileStampWatermark）与 Gitee（gaopeng262/file-stamp-watermark）。**线上只允许出现主程序源码与开源合规文件**，任何测试、过程、交付、备份、印章资产一律禁止入库。

- **允许入库**：`WebShell/`、`WebUI/prototype/`、`PDFQFZ/`、`README.md`、`LICENSE`、`LICENSES/`、`LICENSING.md`、`THIRD-PARTY-NOTICES.md`、`.gitignore`、`.gitattributes`、`封面图.png`、`赞赏码_small.jpg`。（V1.0.0.37：弃用的 `PDFQFZ.WPF/` 项目已移入本地 `备份文件夹\PDFQFZ.WPF_弃用_1.0.0.37\`，不入库；其被 WebShell 编译的 `Services/StampEngine.cs`、`StampBatchWorker.cs`、`StampBatchRequest.cs` 已并入 `WebShell/Services/`）
- **禁止入库**（`.gitignore` 已排除，文件保留在本地工作区，不入 git）：`交付版本/`、`备份文件夹/`、`备份/`、`E2E/`、`PDFQFZ.Tests/`、`工具脚本/`、`输出记录*.md`、`Web交付版本/`、一切 `*.exe`、一切印章/公章图片（如 `WebShell/Assets/公章.png`）、`*debug_page.pdf`、`app_icon_raw.png`、`运行组件/`。
- **公章铁律**：软件正式版默认不携带任何印章；EXE 不内嵌公章（已移除 `EmbeddedResource` 与释放逻辑）。任何人不得重新把公章图片加入源码、资源或提交。

## 二、每次 push 前的强制检查

1. 先运行本地守卫脚本（不入库，位于 `工具脚本\pre-push_guard.ps1`），暂存区/已跟踪文件命中黑名单即报错阻断；
2. `git ls-files` 人工复核：不得出现 公章/印章/交付版本/备份/E2E/输出记录/.exe；
3. 推送前确认线上仓库历史对象库干净——git 历史对象同样会泄露，一旦推过敏感对象，唯一彻底解法是删除线上仓库重建，因此**发现已推送敏感内容必须先重建线上仓库再推**；
4. 新仓库从 1.0.0.34 起，历史已清空重写，禁止用 `git fetch/pull` 把旧远端历史拉回本地。

## 三、版本与交付约定

- 每次代码改动后：单测回归（`dotnet test PDFQFZ.Tests\PDFQFZ.Tests.csproj`，基线 242）→ 编译双档（免费 TRACE / 赞助 TRACE;VIP_PAID）→ 版本号 +1 → 交付 EXE 放 `交付版本\<版本>_免费版与赞助版\`（该目录不入库）。
- EXE 文件名不带"免费版"字样（发布用名）；赞助版加 `_赞助版` 后缀。
- 用户手动修改过的文件作为后续修订母版，不得回退。

### 版本记录

- **1.1.1.0**（2026-10-13）：新增「盖章叠字」——手动盖章时顺带在章上叠一行文字。
  - 实现要点：文字复用既有「文字水印框」渲染管线（`StampEngine` 先画章后画水印），**未改渲染代码**；
    新增桥方法 `CSharpBridge.Stamping.AddManualStampWithText(float,float,int)` + 页尺寸辅助 `TryGetPagePt`。
  - 参数随章记忆存 `config.ini` 的 `[stamp_章名]` 节：`textOverlayEnabled/Text/Pos/ColorArgb/Size` 五键。
  - 前端入口：印章参数卡「叠字」分区（`navSectOn('stamp','textov')`，需在 `navGroups` 与 `stampSect` 双侧注册）。
  - 兼容性：① 老壳无新桥方法时前端探测 `window.CSharpBridge.AddManualStampWithText` 自动降级普通盖章
    （为此 `bridge.js` 需暴露 `window.CSharpBridge`，此前该宿主对象只是闭包局部变量，前端无法探测）；
    ② 叠字包独立 try/catch，失败只回传 `textOverlay.error`，不影响盖章结果；
    ③ 叠字成功后必须额外调 `refreshPageWatermarks()`——`refreshPageStamps()` 只刷章不刷水印，否则预览看不到刚叠的字。
  - 仅手动盖章生效（按文字/范围批量不加）。

- **1.1.1.1**（2026-10-13）：修复「盖章叠字」输出——叠字框此前受「文字水印」开关闸门（`_watermarkEnabled`），
  未开启文字水印导航时输出 PDF 丢弃叠字框（PDF 只剩章没有字）。叠字框加 `IsTextOverlay` 标记，输出端让叠字框始终通过。

- **1.1.1.2**（2026-10-13）：批量处理并行化——`StampBatchWorker.Run` 目录模式改 `Parallel.ForEach`（并行度 = CPU 核心数），
  多核机器处理文件夹 PDF 吞吐提升 3–8×；输出命名 `GetNextOutputPath` 天然线程安全，回调线程安全由前端 `Dispatcher.Invoke` 保证。

- **1.1.1.3**（2026-10-13）：图片批量水印并行化——`ImageWatermarkEngine.RunBatch` 改 `Parallel.ForEach`（并行度 = CPU 核心数），
  拖入图片文件夹加水印吞吐提升 3–8×；`GetNextOutputPath` 与 `_watermarks` 均线程安全。

- **1.1.1.4**（2026-10-14）：新增「原文浮于章上」——印章参数卡显示参数区开关 `stampUnderText`（随章记忆，默认关）。
  开启后输出 PDF 时章画到文字层之下（`GetUnderContent`，页面章+骑缝章统一），合同原文压在章图案之上；
  预览仍显示章在上（以输出文件为准）；扫描件整页图片无文字层时请勿开启，否则章会被图片盖住看不见。

- **1.1.1.5**（2026-10-14）：「原文浮于章上」安全阀——输出时检测整页图片（扫描件/OCR件/整页底图），
  此类页自动回落章压字（否则章被图片盖住完全看不见），并在日志提示一次，保证印章始终可见。
- **1.1.1.6**（2026-10-14）：修复 v1.1.1.5 安全阀的**误判**——用户实测「原文浮于章上」在合同/Word 导出件上完全失效，根因是 `PageCoveredByFullImage` 只看图片**像素尺寸**（≥页面点数即判整页覆盖），而 Word 导出的合同常带大尺寸 JPG 底图/logo，被误判成扫描件 → 章被静默回落成压字 → 用户设置形同虚设。两项收紧：
    1. 带透明通道（`/SMask` 软掩码）的图片不再算整页覆盖——半透明 logo/水印底图不会完全遮住衬于其下的章；
    2. 覆盖判定从「像素尺寸」改为「**实际绘制尺寸**」：新增 `TryGetImageDrawSize` 自包含内容流扫描器（跟踪 `q`/`Q`/`cm` 累乘 CTM，遇 `Do` 时取图片固有像素 × 当前 CTM），仅当绘制尺寸 ≥ 页面 98% 才判整页覆盖。刻意**不使用** `PdfContentParserTool.Tokenizer` 等 iTextSharp 内部 parser 类型（跨小版本可见性不稳定），改为手扫 `PdfReader.GetPageContent` 已解码字节，避免编译风险。
    解析失败一律 `return false`（保守不回落），**绝不静默推翻用户开关**。真正扫描件（1:1 铺满、无透明）仍正常回落。
    另新增 `wm_debug.log` 分层诊断日志（`config.ini` 段 `[config]` 下 `diagWatermark=1` 开启，无需重编译）：`[COVER]` 打印每个图片 XObject 的像素/绘制/页面尺寸与判定依据，`[LAYER-SEAM]`/`[LAYER-PAGE]`/`[LAYER-WM]` 分别打印骑缝章、页面章、文字框最终落在 `GetUnderContent` 还是 `GetOverContent`。
    **踩坑**：诊断用的中间标记不要写成 `static` 字段——批处理是多文件并发，静态可变状态会跨页/跨文件串扰，必须用方法内局部变量。

- **1.1.1.7**（2026-10-14）：印章库去重检测 + 手动撤销栈——`AppConfig.DetectDuplicateStamps()`（同文件不同名/同名不同文件警示，不阻断）；`StampPlacementCollection.UndoLastManual()`（仅撤回手动章 `batchId=0/type=manual`，LIFO）；桥方法 `CheckSealLibrary`/`UndoManualStamp`（前端按钮「撤销上次盖章」）；启动时异步检查提示（`sealDupTip` 前端变量）。财务场景保障：印章记忆不混乱、误盖可撤回。

## 四、线上历史与本地调试历史分离（2026-10-08 确立）

- 线上 main 只保留发布 commit：每个发布一个 commit（`发布 1.0.0`、`发布 1.1.0`…），并打对应 tag（v1.0.0、v1.1.0…）。线上 commit 历史必须保持"只有发布节点"的干净结构，**禁止把调试 commit 推上线上**。
- 完整调试历史保留在本地 `main-full` 分支（59 条 V1.0.0.x 记录），**禁止推送到 GitHub/Gitee**。
- 日常开发在本地 main-full（或临时分支）提交，message 写"修复xxx / 新增xxx / 优化xxx"，不带版本号。
- 发布流程：生成发布版 → 在 main 上追加一个"发布 x.x.x" commit（树 = 该发布代码状态）+ 打 tag vx.x.x → push main 与 tag 到双远程。
- push 前检查：`git log --oneline main` 应只看到发布节点；确认调试历史只在本地（`main-full`）。任何情况下不得 `git push origin main-full`、`git push gitee main-full` 或把调试历史并入 main。
- 仓库级文档（AGENTS.md/README 等）的内容修订先在 main-full 提交，随下次发布 commit 一并上线上；不得在 main 上单独新增非发布 commit。
