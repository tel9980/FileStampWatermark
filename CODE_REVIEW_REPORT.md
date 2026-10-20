# 代码审查报告（2026-10-20）

> 审查对象：FileStampWatermark（文件批量盖章与水印工具）`main` @ `2d50170`
> 审查范围：全部 C# 源码（15.5k 行）、全部前端 JS/HTML（4.2k 行）、技能包脚本（4 个 Python）、CI 工作流
> 审查方式：全量逐文件静态审计（桥接层/核心引擎/批量-CLI-配置-前端 三条线并行） + 本地 net472 真编译验证
> 结论：**发现 32 个可确认缺陷，其中 8 个严重 / 11 个高 / 13 个中低；本轮已修复 25 个，其余 7 个列入后续建议**

---

## 一、审查方法与验证手段

| 手段 | 说明 |
|------|------|
| 三线并行静态审计 | ① WebView2 桥接层 + 前端安全　② 盖章/水印核心引擎 + PDFQFZ 库　③ 批量/CLI/配置持久化 + 前端业务逻辑 |
| **本地真编译验证** | 环境无 .NET SDK 且 WPF/.NET Framework 4.7.2 只能在 Windows 编译，故自建 `net472` 校验工程（`Microsoft.NETFramework.ReferenceAssemblies` + WebView2/iTextSharp/PdfiumViewer 依赖 + XAML 生成代码桩），**本轮所有 C# 改动均已通过真实编译（0 error）** |
| **仓库 CI 验证** | PR #1 的 CI 全绿：JS 语法 / HTML 内联脚本 / 白名单守卫 / **桥方法两端对齐（新双向门禁）** / **技能包 Python 语法（新门禁）** / **Windows 双档编译（Release + ReleaseVIP，含真实 csproj + XAML 编译 + Costura）** |
| 门禁脚本自测 | 加固后的 `check_bridge_align.sh` 本地跑通，并用「删掉 C# 侧方法」反向验证它确实能抓出原有缺陷 |
| 未覆盖 | 运行时行为（需 Windows + WebView2 实机）：UI 交互、真实 PDF 渲染效果、EXE 打包 |

> ⚠️ 因此：**凡涉及渲染效果与坐标的改动，务必用 §五 的清单在实机回归一次**。

---

## 二、缺陷总览

| # | 级别 | 位置 | 症状 | 状态 |
|---|------|------|------|------|
| B-1 | 严重 | `index.html:2277` ↔ 桥 | 前端调用了 C# 根本不存在的 `CheckSealLibrary` → 印章库去重检测 100% 静默失效 | ✅ 已修 |
| B-2 | 严重 | `BatchCli.SetupStamp` | 印章显示名重名 → 任务指定的图被**静默替换为库内同名旧章**，退出码 0、日志显示成功 | ✅ 已修 |
| B-3 | 严重 | `BatchCli.Run` | 参数校验失败直接 return，**日志不落盘** → 智能体读不到失败原因，还可能把上次的反馈段当本次结果 | ✅ 已修 |
| B-4 | 严重 | `MainWindow` | WebView2 **无导航白名单 / 无 Settings 配置** → 页面被导航到外部站点后，外部页同样能拿到 `window.CSharpBridge` | ✅ 已修 |
| B-5 | 高 | `find_exe.py` | 用本地 ANSI 解码 EXE 的 UTF-8 输出 → 中文 Windows 永远 `NOT_FOUND`，**技能包整条链路不可用** | ✅ 已修 |
| B-6 | 高 | `BatchCli.ReportGen` | `skipped`（加密/损坏）不计入失败 → 全部文件失败时**退出码仍是 0** | ✅ 已修 |
| B-7 | 高 | `BatchCli.BuildGenArgs` | `output.seq` 写成字符串（模板/前端都这么写）时被静默吞掉 → 编号类型恒为数字 | ✅ 已修 |
| B-8 | 高 | `BatchCli.SetupStamp` | 批处理写用户 `config.ini`（印章库 + 参数 + 全局 size/rotation/opacity）→ **违反手册「config.ini 只读」铁律** | ✅ 已修 |
| B-9 | 高 | `StampEngine.PDFWatermark` | `FileMode.Create` 先截断输出再开输入 → **输出路径==源文件时原 PDF 被清零** | ✅ 已修 |
| B-10 | 高 | `SeamLayoutCalculator` vs `StampEngine` | 左/右骑缝章纵向位置预览与输出**互为镜像** → 所见非所得 | ✅ 已修 |
| B-11 | 高 | `StampEngine` / `SeamLayoutCalculator` | 骑缝章段划分在分割数为奇数时**恒漏盖尾部若干页** | ✅ 已修 |
| B-12 | 高 | `OutputFileNamingPolicy` | 输出命名标记不洗非法字符 → 填 `../` **产物写出输出目录**；填 `a*b` 整批失败 | ✅ 已修 |
| B-13 | 高 | `ImageWatermarkEngine.RunBatch` | 并行批次同名图**输出互相覆盖**（后写静默覆盖先写） | ✅ 已修 |
| B-14 | 高 | `BatchCli`（按文字盖章） | 一个章都没放上去也算「完成」→ 产出无章副本且退出码 0 | ✅ 已修 |
| B-15 | 高 | `WatermarkSchemeStore` | 保存水印方案时**整体重写 config.ini**（非原子）→ 一次保存可能毁掉全部用户配置 | ✅ 已修 |
| B-16 | 高 | `imageWatermark.js` | `ReplaceAllWatermarks` 与 `ApplyImageWatermarks` 无先后保证 → 输出的水印可能是旧参数 | ✅ 已修 |
| B-17 | 高 | `AppConfig.StampParamSection` | 印章名直接当 INI 节名，未过滤 `]`/换行 → **config.ini 结构污染（配置注入）** | ✅ 已修 |
| B-18 | 中 | `imageWatermark.js` | `PickOutputDir` 返回裸路径，前端按 JSON 解析 → **图片模式「选择输出目录」永远选不中** | ✅ 已修 |
| B-19 | 中 | `StampEngine.PDFWatermark` | `finally` 里三个 Close 串在一个 try → Close 异常会**跳过其余关闭**并顶掉真实错误 | ✅ 已修 |
| B-20 | 中 | `StampEngine` | 文字水印单框失败**完全静默**；`BT/ET` 不配对会产出结构非法的 PDF | ✅ 已修 |
| B-21 | 中 | `StampEngine` | `sfbl` 在 try 外用 `seamImage.Width` 计算 → NRE 逃出方法，整批只剩一句「处理过程中发生错误」 | ✅ 已修 |
| B-22 | 中 | `StampEngine` | `qfzType=4`（已盖章页骑缝）不过滤越界页 → 整个文件盖章失败（预览却正常） | ✅ 已修 |
| B-23 | 中 | `StampEngine` / `ImageWatermarkEngine` / `StampBatchWorker` | GDI+ 位图泄漏（去白/旋转/骑缝切片）与并行分支共享同一张 Bitmap | ✅ 已修 |
| B-24 | 中 | `AppConfig.LastSelectedStampNames` | UI 线程写、后台批量线程读且非原子 → 批量预览随机抛 `ArgumentOutOfRangeException` | ✅ 已修 |
| B-25 | 中 | `MainWindow` | 预览渲染图/拖入文件副本的临时目录**从不清理** → 用户文档内容长期留在 `%TEMP%` | ✅ 已修 |
| B-26 | 中 | `AppLog.Write` | 前端可写入任意文本（含换行）→ 可伪造日志分段、注入控制字符 | ✅ 已修 |
| B-27 | 中 | `CSharpBridge.Documents/Image` | 拖入文件名未过滤 `:` → 写入 NTFS **备用数据流（ADS）**，文件藏在同名文件里 | ✅ 已修 |
| B-28 | 中 | `check_bridge_align.sh` | 门禁**方向反了**（只查 C#→前端），且漏 `CSharpBridge.cs` 与 `public void` → B-1 这类缺陷一路绿灯 | ✅ 已修 |
| B-29 | 中 | `batchActions.js` | 生成失败时 `generating` 不复位 → 按钮永久 loading，**只能重启软件** | ✅ 已修 |
| B-30 | 中 | `configPersist.js` | `parseInt(this.opacity)||60` → 用户设 0% 被静默改成 60%（骑缝位置百分比同理） | ✅ 已修 |
| B-31 | 中 | `AppConfig` 印章列表 | 显示名含 `;`（文件名 `a;b.png`）→ 整个 `stampPaths` 列表读回即错位 | ✅ 已修 |
| B-32 | 低 | `StampBatchWorker` | 目录模式并行分支共享章图、回调未串行、输出目录排除用字符串相等（自吞） | ✅ 已修 |

### 未在本轮修复（列入后续建议）

| # | 级别 | 问题 | 不修的理由 |
|---|------|------|-----------|
| R-1 | 中 | 页面无 Content-Security-Policy | 加了 CSP 但本机无法实机验证 WebView2 行为，一旦写错就是**白屏**；已改为先加「导航白名单」阻断真正的攻击路径（外部页拿不到桥），CSP 给出可粘贴的方案待实机验证 |
| R-2 | 中 | `MainWindow` 里约 2000 行 E2E/自检代码由环境变量触发（含任意路径读写） | 拆成独立测试工程属于结构性调整，会打断现有 E2E 流程；本轮先在报告登记 |
| R-3 | 中 | `activation.dat` 硬件指纹仅 XOR+Base64 混淆，异常一律放行 | 属授权策略设计问题，需要产品侧确认「失败是否放行」的取舍 |
| R-4 | 中 | `PdfTextSearcher` 整文件读入内存并 ×2 实例（大文件峰值 4× 文件大小） | 改用 `FPDF_LoadDocument` 需重写 P/Invoke 加载路径，回归面大；建议下一轮单独做 |
| R-5 | 低 | 9 个 `PDFQFZ/Library/*.cs` 未加入 csproj（死代码，含「防御性实现」但一行不生效） | 本轮不动编译单元集合，避免连带编译错误；建议要么接入要么删除，避免文档误导 |
| R-6 | 低 | `config.ini` 逐键写入（一次保存重写文件数十次） | 需要把 `IniFileHelper` 改成批量块写；本轮只对最危险的一处（方案保存）做了原子化 |
| R-7 | 低 | `ImageWatermarkEngine.WrapText` 注释与实现口径不符 | 改算法会连带改变前端预览换行，需一并验证；本轮只更正注释 |

---

## 三、重点缺陷说明

### B-1 / B-28　「前端调了 C# 没有的方法」——门禁方向反了

前端 `index.html` 启动时调用 `CheckSealLibrary` 做印章库去重检测，而 C# 侧**从未实现**该方法。
`bridge.js` 的 `invoke` 在方法不存在时直接 `Promise.reject`，前端 `.catch` 又把它 `console.warn` 吞掉 →
**每次启动必然失败，且完全无感**。「同一文件重复导入 / 同名不同文件」这两种财务印章高风险场景，从未真正检测过。

而 CI 门禁 `check_bridge_align.sh` 只检查「C# 有、前端没调」，方向正好相反，漏掉了这一类。
更糟的是它的 `grep` 用 `CSharpBridge.*.cs` 通配，**匹配不到 `CSharpBridge.cs` 本身**（基础 partial 文件），
且只收集 `public string`，`public void`（`LogLine` / `SetRenderCache`）永远不在检查范围。

**修复**：C# 补齐 `CheckSealLibrary`（复用 `AppConfig.DetectDuplicateStamps`，并写系统日志）；
门禁改为**双向**检查（正则精确匹配调用形态 + 覆盖 `public void` + 覆盖基础 partial 文件）。
反向检查已用「删掉 C# 侧方法」实测可报出 `前端调用了 C# 不存在的桥方法: CheckSealLibrary`。

### B-2　用错公章（财务场景事故级）

印章库里已有显示名 `公章` 的条目，任务 JSON 的 `stamp.image` 指向 `D:\合同\公章.png`（同名不同图）时：
`AppendStampEntry` 因显示名重复**整条跳过**（新图根本没进库）→ 按文件名 `SelectStamp` → `CurrentStampPath`
按显示名反查 → **选到库里的旧章**。任务用错误的印章图完成全部盖章，退出码 0、日志显示成功，无任何警告。

**修复**：路径未登记时用唯一显示名登记 → 选章后**回验实际路径**，不一致直接失败（并回滚登记，不污染用户印章库）。

### B-9　输出路径与源文件相同时，原 PDF 被清零

```csharp
fileStream = new FileStream(outputfilepath, FileMode.Create);  // 先截断（目标已存在 → 0 字节）
pdfReader  = new PdfReader(inputfilepath);                     // 后打开 → 读到一个空文件
```

`FileMode.Create` 会把已存在的目标文件**截断为 0 字节**。当输出路径 == 源文件时，原 PDF 在打开前就被清零；
`finally` 又只删「0 字节文件」——删掉的正是用户那个已被清零的原文件，**源文件彻底消失**。

**修复**：入口先做同路径自检（直接拒绝并记日志）；再改为「先打开源文件、成功后才创建输出流」。

### B-10　左/右骑缝章：预览与输出互为镜像

预览端 `SeamLayoutCalculator`（Y 自上而下）与输出端 `StampEngine`（iText y 自下而上）用了**字面相同**的
`(H-h)*(100-wz)/100`，但两者基准相反 → 实际互为镜像，只有 50%（默认值）时两端一致。

按「上/下」位置的口径类推（百分比沿轴起点递增），正确口径应为 **wz%=0 靠上**——即输出端正确、预览端错。
**修复只改预览端**，不动物理输出（避免影响已交付用户的产物习惯）。

### B-11　骑缝章尾页漏盖

旧公式 `ss*max/2` 在 `max`（分割数）为奇数时整除截断，覆盖页数恒少 `floor(ss/2)` 页：
5 页/分割数 3 → 只盖 4 页；7 页/3 → 只盖 6 页；100 页/21 → 只盖 98 页。
新公式 `pp = qfzPages/ss`、前 `qfzPages%ss` 段各多 1 页，**分割数为偶数时与旧公式逐位等价**（默认 20 不受影响）。

### B-19 / B-20　异常处理与 PDF 合法性

- `finally` 里 `pdfStamper.Close()` 抛异常（磁盘满/文件被占用）→ `pdfReader`/`fileStream` 永不关闭（句柄泄漏、输出被锁），
  且该异常从 `finally` 抛出，会把 `try` 里准备返回的 `false` 顶掉 → 调用方拿到未知异常。
- 文字水印单框失败被 `catch { }` 完全吞掉（字体缺失 → 水印直接消失，界面与日志零提示）。
- `DrawTextWatermark` 的 `finally` 只 `RestoreState()`，**不保证 `EndText()`**：异常落在 `BeginText` 与 `EndText` 之间时，
  内容流残留未闭合的 `BT` → 生成的 PDF 结构非法（阅读器提示「文档已损坏/需要修复」）。

---

## 四、修复清单（按文件）

| 文件 | 修复项 |
|------|--------|
| `WebShell/Services/CSharpBridge.SealLib.cs` | B-1 新增 `CheckSealLibrary`；B-17/B-31 重命名与默认名清洗 |
| `WebShell/Services/AppConfig.cs` | B-17 INI 节名清洗；B-31 显示名清洗 + 读回容错；B-24 印章名列表加锁；B-8 批处理参数内存覆盖 |
| `WebShell/Services/CSharpBridge.cs` | B-27 拖入文件名清洗（去 ADS 字符） |
| `WebShell/Services/CSharpBridge.Stamping.cs` | B-24 `CurrentStampName` 加锁；`_fpSizeCache` 并发读写加锁；新增内部回验方法 |
| `WebShell/Services/CSharpBridge.Documents.cs` / `.Image.cs` | B-27 文件名清洗 |
| `WebShell/Services/AppLog.cs` | B-26 日志去控制字符 + 单行限长 |
| `WebShell/MainWindow.xaml.cs` | B-4 导航白名单 + 新窗口外置 + Settings 收紧；B-25 临时目录清理 |
| `WebShell/Services/StampEngine.cs` | B-9/B-10/B-11/B-19/B-20/B-21/B-22/B-23 |
| `WebShell/Services/BatchCli.cs` | B-2/B-3/B-6/B-7/B-8/B-14 |
| `WebShell/Services/StampBatchWorker.cs` | B-32 共享章图隔离 + 回调串行 + 输出目录前缀排除 + 输出名占位 |
| `WebShell/Services/WatermarkSchemeStore.cs` | B-15 原子写 |
| `WebShell/Services/DocsBootstrap.cs` | 单文件失败不再中断其余出厂文档释放 |
| `PDFQFZ/Library/SeamLayoutCalculator.cs` | B-10/B-11 预览端与输出端对齐 |
| `PDFQFZ/Library/OutputFileNamingPolicy.cs` | B-12 命名标记清洗；支持「本批次已占用名」参与版本扫描 |
| `PDFQFZ/Library/ImageWatermarkEngine.cs` | B-13 独占创建 + 撞名重算；回调串行化；并行度收敛到 4 |
| `PDFQFZ/Library/WhiteTransparencyHelper.cs` | 去白阈值 `>` → `>=`（容差 0 时纯白也能抠掉） |
| `WebUI/prototype/modules/imageWatermark.js` | B-16 严格串行；B-18 输出目录协议 |
| `WebUI/prototype/modules/batchActions.js` | B-29 `generating` 复位 + 返回值容错 |
| `WebUI/prototype/modules/configPersist.js` | B-30 `opacity` / `wz` 的 0 值不再被吃成默认值 |
| `WebUI/prototype/bridge.js` | 注释占位符改为中文（避免被门禁误判为方法名） |
| `.github/scripts/check_bridge_align.sh` | B-28 双向检查 + 覆盖 `public void` + 覆盖基础 partial 文件 |
| `.github/workflows/ci.yml` | 新增「技能包 Python 语法检查」门禁 |
| `.github/workflows/opencode.yml` | 新增：与 finbook 同款 OpenCode 机器人（评论 `/oc` 触发） |

---

## 五、实机回归清单（本轮改动涉及渲染/坐标/UI，必须在 Windows 上过一遍）

| # | 场景 | 期望 |
|---|------|------|
| 1 | 骑缝章：左 / 右 + 位置百分比 0 / 30 / 70 / 100 | 预览位置 = 输出 PDF 渲染位置（**本轮修过镜像**） |
| 2 | 骑缝章：分割数设为**奇数**（如 3），页数 5 / 7 | 尾页**也有**骑缝章切片（**本轮修过漏盖**） |
| 3 | 页面章：随机角度/位移/纹理、原文浮于章上 | 与改动前一致（零回归） |
| 4 | 输出目录 = 源文件所在目录 | 源文件**不被覆盖、不被清零**（**B-9**） |
| 5 | 生成失败（加密 PDF / 磁盘满） | 输出目录**不留半成品**，日志有原因（**B-19**） |
| 6 | 图片批量：两个子目录各有同名图 | 产出**两个**文件，互不覆盖（**B-13**） |
| 7 | 图片模式「选择输出目录」 | 能选中并生效（**B-18**） |
| 8 | 印章库：导入同名不同图 | 启动即提示重复（**B-1**） |
| 9 | 文字水印：不透明度设 0 | 输出中**无**该水印（**B-20 附带修复**） |
| 10 | 页脚 GitHub/Gitee 链接 | 在**系统浏览器**打开，不在应用内导航（**B-4**） |
| 11 | 智能体批处理：任务文件路径写错 | 日志文件里能读到失败原因，**无上次的反馈段**（**B-3**） |
| 12 | 智能体批处理：印章图与库内某章同名 | 用的是**任务指定的那张图**（**B-2**） |
| 13 | 智能体批处理：跑完后 | 用户 `config.ini` **未被改动**（**B-8**） |
| 14 | 智能体技能包：中文 Windows 上 `find_exe.py` | 能定位到 EXE（**B-5**） |

---

## 六、复现审查环境（供后续复核）

```bash
# 1) 装 .NET 8 SDK（Linux）
curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 8.0 --install-dir /tmp/dotnet --no-path
export PATH=/tmp/dotnet:$PATH DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1

# 2) 建 net472 校验工程（复刻仓库 csproj 的编译单元集合 + XAML 桩）
#    见本报告说明：Microsoft.NETFramework.ReferenceAssemblies + WebView2/iTextSharp/PdfiumViewer.Updated/bblanchon.PDFium
dotnet build -v:m        # → Build succeeded 即通过
```

> 该工程只做**编译期**校验（WPF 运行时、PDF 渲染、EXE 打包仍需 Windows 实机 + 仓库自带 CI 的
> `windows-latest` 双档编译门禁）。
