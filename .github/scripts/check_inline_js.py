#!/usr/bin/env python3
"""检查 index.html 里内联 <script> 块的 JS 语法（node --check）。

原 ci.yml 把 python heredoc 顶格写在 YAML 块里会导致 YAML 语法错误，
故抽成独立脚本。ci.yml 调用：python3 .github/scripts/check_inline_js.py
（需在 WebUI/prototype 目录下运行，或传 html 路径参数）。
"""
import re
import sys
import tempfile
import subprocess
import os

html_path = sys.argv[1] if len(sys.argv) > 1 else "index.html"
html = open(html_path, "r", encoding="utf-8").read()
# 找所有不带 src= 的 <script>...</script>
blocks = re.findall(
    r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, flags=re.DOTALL | re.IGNORECASE
)
if not blocks:
    print("无内联 script，跳过")
    sys.exit(0)
for i, block in enumerate(blocks):
    # 去掉可能的 type=module 等
    block = block.strip()
    if not block:
        continue
    # 写临时文件跑 node --check
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".js", delete=False, encoding="utf-8"
    ) as f:
        f.write(block)
        tmp = f.name
    try:
        r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
        if r.returncode != 0:
            print(f"FAIL: {html_path} 内联 script #{i+1}")
            print(r.stderr)
            sys.exit(1)
    finally:
        os.unlink(tmp)
print(f"✅ {html_path} {len(blocks)} 个内联 script 语法通过")
