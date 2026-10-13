#!/usr/bin/env bash
# 桥方法两端对齐检查：
#   CSharpBridge.*.cs 里 public string Xxx( 的方法，前端（WebUI/prototype 的 *.js/*.html）
#   必须有同名调用（Bridge.invoke('Xxx') / window.CSharpBridge.Xxx 等）。
#   新增方法若不在豁免名单且前端未调用 → 失败（防止新增桥方法忘记接前端）。
# 用法：bash .github/scripts/check_bridge_align.sh   （在仓库根目录运行）
set -euo pipefail
cd "$(dirname "$0")/../.."

# 豁免名单：已确认不需要前端调用的方法（理由见 AGENTS.md / 各方法注释）
#   GetVersion        — MainWindow 内部调用（shell-ready 事件）+ 命令行 EXE --version
#   GetAppPath        — 诊断/支持信息用，非前端入口
#   GetIniPath        — 诊断/支持信息用，非前端入口
#   ClosePdf          — 预留：文档关闭（前端暂无关闭入口）
#   RemoveImageAt     — 预留：前端用 ClearImages 整体清空，不走单个删除
#   CalcImageWrapLines— 预留：图片水印换行计算（C# 内部）
is_exempt() {
  case "$1" in
    GetVersion|GetAppPath|GetIniPath|ClosePdf|RemoveImageAt|CalcImageWrapLines) return 0 ;;
    *) return 1 ;;
  esac
}

echo "收集 C# 桥公开方法..."
CS_METHODS=$(grep -rhoE 'public string [A-Za-z]+\s*\(' WebShell/Services/CSharpBridge.*.cs 2>/dev/null \
  | sed -E 's/.*public string ([A-Za-z]+)\s*\(.*/\1/' | sort -u)
echo "C# 方法: $(echo $CS_METHODS | wc -w) 个"

FRONT_FILES=$(find WebUI/prototype -type f \( -name '*.js' -o -name '*.html' \))
MISS=0
for m in $CS_METHODS; do
  if is_exempt "$m"; then
    echo "⚠️  豁免（内部/预留）: $m"
    continue
  fi
  if ! grep -rqE "\b$m\b" $FRONT_FILES 2>/dev/null; then
    echo "❌ 前端未见调用: $m"
    MISS=1
  fi
done

if [[ $MISS -eq 1 ]]; then
  echo "❌ 存在前端未调用的桥方法（可能是新增忘记接前端，或已废弃）"
  echo "若是新功能，请在 stampActions.js / configPersist.js 等对应模块接入；"
  echo "若确为内部/预留方法，请把方法名加入本脚本 is_exempt() 豁免名单。"
  exit 1
fi
echo "✅ 桥方法两端对齐通过"
