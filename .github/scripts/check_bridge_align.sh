#!/usr/bin/env bash
# 桥方法两端对齐检查（双向）：
#   正向（C# → 前端）：CSharpBridge 里的 public 方法，前端必须有同名调用
#                      （新增桥方法忘记接前端 → 失败）
#   反向（前端 → C#）：前端调用的方法名，C# 桥里必须存在
#                      （前端调了 C# 根本没有的方法 → 失败；此前脚本只查正向，这类缺陷完全检不出：
#                       例如 V1.1.1.6 的 CheckSealLibrary 前端一直在调、C# 侧从未实现，
#                       「印章库去重检测」100% 失效却一路绿灯）
#   返回类型不止 string：public void（如 LogLine / SetRenderCache）同样要纳入检查。
# 用法：bash .github/scripts/check_bridge_align.sh   （在仓库根目录运行）
set -euo pipefail
cd "$(dirname "$0")/../.."

# 豁免名单：已确认不需要前端调用的方法（理由见各方法注释）
#   GetVersion        — MainWindow 内部调用（shell-ready 事件）+ 命令行 EXE --version
#   GetAppPath        — 诊断/支持信息用，非前端入口
#   GetIniPath        — 诊断/支持信息用，非前端入口
#   ClosePdf          — 预留：文档关闭（前端暂无关闭入口）
#   RemoveImageAt     — 预留：前端用 ClearImages 整体清空，不走单个删除
#   CalcImageWrapLines— 预留：图片水印换行计算（C# 内部）
#   SetRenderCache    — MainWindow 启动时注入预览缓存目录，非前端入口
#   EscapeJson        — 壳层拼事件 JSON 用，非前端入口
EXEMPT="GetVersion GetAppPath GetIniPath ClosePdf RemoveImageAt CalcImageWrapLines SetRenderCache EscapeJson"

is_exempt() {
  case " $EXEMPT " in
    *" $1 "*) return 0 ;;
    *) return 1 ;;
  esac
}

echo "收集 C# 桥公开方法..."
# 注意：必须同时列 CSharpBridge.cs（基础 partial 文件）——此前 glob 只匹配 CSharpBridge.*.cs，
# 漏掉了基础文件里的方法（DeleteStampBatch / DeleteStampBatchOnPage / EscapeJson / LogLine / SetRenderCache）
CS_METHODS=$(grep -rhoE 'public (string|void) [A-Za-z]+\s*\(' \
             WebShell/Services/CSharpBridge.cs WebShell/Services/CSharpBridge.*.cs 2>/dev/null \
  | sed -E 's/.*public (string|void) ([A-Za-z]+)\s*\(.*/\2/' | sort -u)
echo "C# 方法: $(echo $CS_METHODS | wc -w) 个"

FRONT_FILES=$(find WebUI/prototype -type f \( -name '*.js' -o -name '*.html' \))
MISS=0

# ── 正向：C# → 前端 ──────────────────────────────────────────────
for m in $CS_METHODS; do
  if is_exempt "$m"; then
    echo "⚠️  豁免（内部/预留）: $m"
    continue
  fi
  # 方法名必须在前端以「字符串字面量」形式出现（覆盖 Bridge.invoke('X') / _callBridge('X') 等各种调用封装）。
  # 不再用裸子串匹配（此前 grep -rqE "\b$m\b" 会在注释/字符串里命中，几乎没有约束力）
  if ! grep -rqE "['\"]${m}['\"]" $FRONT_FILES 2>/dev/null; then
    echo "❌ 前端未见调用: $m"
    MISS=1
  fi
done

# ── 反向：前端 → C# ──────────────────────────────────────────────
FRONT_CALLS=$(grep -rhoE "((window\.)?Bridge\.invoke|_callBridge)\(\s*['\"][A-Za-z]+['\"]" $FRONT_FILES 2>/dev/null \
  | sed -E "s/.*['\"]([A-Za-z]+)['\"].*/\1/" | sort -u)
for c in $FRONT_CALLS; do
  if is_exempt "$c"; then
    continue
  fi
  if ! echo "$CS_METHODS" | grep -qx "$c"; then
    echo "❌ 前端调用了 C# 不存在的桥方法: $c"
    MISS=1
  fi
done

if [[ $MISS -eq 1 ]]; then
  echo "❌ 桥方法两端未对齐"
  echo "  · 「前端未见调用」= 新增桥方法忘记接前端，或已废弃（可加入 is_exempt 名单）"
  echo "  · 「前端调用了 C# 不存在的桥方法」= 前端调用名与 C# 方法名不一致（拼写/未实现）"
  echo "    —— 此类缺陷会让功能 100% 静默失效（桥方法缺失 → 前端 Promise reject 被 catch 吞掉）"
  exit 1
fi
echo "✅ 桥方法两端对齐通过"
