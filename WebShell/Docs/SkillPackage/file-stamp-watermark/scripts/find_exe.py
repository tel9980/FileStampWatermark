# -*- coding: utf-8 -*-
"""find_exe.py —— 定位「文件批量盖章与水印工具」主程序。

用法:
    python find_exe.py "<软件文件夹路径>"

输出:
    找到 -> 主程序绝对路径（一行）
    未找到 -> NOT_FOUND

定位规则（与官方手册一致）:
    1. 软件文件夹根目录下的 .exe 逐个运行 --version；
    2. 输出包含「文件批量盖章与水印工具」即为正确程序；
    3. 多个命中取版本号最大者（X.Y.Z.W 按数字逐段比较，不按字符串排序）。
仅用 Python 标准库，零第三方依赖，跨平台智能体可跑。
"""
import os
import re
import subprocess
import sys


def _version_key(s):
    """把 '文件批量盖章与水印工具 1.0.0.1' 中的版本号转成可比较的元组。"""
    m = re.search(r'(\d+)\.(\d+)\.(\d+)\.(\d+)', s or '')
    if not m:
        return (-1, -1, -1, -1)
    return tuple(int(x) for x in m.groups())


def find_exe(root):
    """返回主程序绝对路径；找不到返回 None。"""
    if not root or not os.path.isdir(root):
        return None
    candidates = []
    for name in os.listdir(root):
        p = os.path.join(root, name)
        if os.path.isfile(p) and name.lower().endswith('.exe'):
            candidates.append(p)
    if not candidates:
        return None
    best = None
    best_key = (-1, -1, -1, -1)
    for exe in candidates:
        try:
            # 缺陷修复：EXE 的 --version 输出是 UTF-8 字节（App.xaml.cs 显式按 UTF-8 写出），
            # 而 text=True 会按系统本地代码页解码——中文 Windows 是 cp936(GBK)，
            # 11 个汉字的 UTF-8 字节按 GBK 解码会抛 UnicodeDecodeError（被下面 except 吞掉），
            # 即便不抛也匹配不到「文件批量盖章与水印工具」→ 中文 Windows 上永远 NOT_FOUND，
            # 整个技能包（方式 B）不可用。现固定按 UTF-8 解码并对异常字节做替换。
            out = subprocess.run(
                [exe, '--version'], capture_output=True,
                timeout=15, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
            )
            text = (out.stdout or b'').decode('utf-8', errors='replace') + \
                   (out.stderr or b'').decode('utf-8', errors='replace')
        except Exception:
            continue
        if '文件批量盖章与水印工具' in text:
            key = _version_key(text)
            if key > best_key:
                best = exe
                best_key = key
    return best


def main():
    if len(sys.argv) < 2:
        print('用法: python find_exe.py "<软件文件夹路径>"')
        sys.exit(1)
    root = sys.argv[1].strip().strip('"')
    exe = find_exe(root)
    if exe:
        print(exe)
    else:
        print('NOT_FOUND')


if __name__ == '__main__':
    main()
