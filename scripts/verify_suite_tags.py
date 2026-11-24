# -*- coding: utf-8 -*-
"""用 Robot Framework 运行时逐个 test case 核对提取结果。

让 RF 自己加载整个测试套件目录（这样父目录 __init__.robot 里的 tag 才会像真实运行时
那样继承下来），把每个 test case 实际带的 tag 与 test_suite_tags.json 里的
effective_tags 逐个比对。全部一致时退出码为 0，否则为 1。

用法：
    python scripts/verify_suite_tags.py [--suite-dir DIR] [--json FILE]

依赖：robotframework
"""
import argparse
import collections
import contextlib
import io
import json
import os
import sys

from robot.running import TestSuite

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SUITE_DIR = os.path.normpath(os.path.join(REPO_ROOT, "..", "..", "Case", "test_suite"))
DEFAULT_JSON = os.path.join(REPO_ROOT, "output", "test_suite_tags.json")


def norm(tags):
    return set(t for t in tags if not t.lower().startswith("robot:"))


def extractor_cases(tree):
    """(文件相对路径, test case 名) -> [effective_tags, ...]"""
    cases = collections.defaultdict(list)

    def walk(node, path):
        here = f"{path}/{node['name']}" if path else node["name"]
        for tf in node["test_files"]:
            for c in tf["test_cases"]:
                cases[(f"{here}/{tf['name']}", c["name"])].append(set(c["effective_tags"]))
        for sub in node["sub_suites"]:
            walk(sub, here)

    for suite in tree["suites"]:
        walk(suite, "")
    for tf in tree["root_test_files"]:
        for c in tf["test_cases"]:
            cases[(tf["name"], c["name"])].append(set(c["effective_tags"]))
    return cases


def runtime_cases(suite_dir):
    """(文件相对路径, test case 名) -> [实际生效的 tag 集合, ...]"""
    cases = collections.defaultdict(list)

    def visit(suite):
        rel = os.path.relpath(suite.source, suite_dir).replace(os.sep, "/")
        for test in suite.tests:
            cases[(rel, test.name)].append(norm(test.tags))
        for child in suite.suites:
            visit(child)

    with contextlib.redirect_stderr(io.StringIO()):
        visit(TestSuite.from_file_system(suite_dir))
    return cases


def main():
    parser = argparse.ArgumentParser(description="用 RF 运行时核对提取出的 tag")
    parser.add_argument("--suite-dir", default=DEFAULT_SUITE_DIR, help="测试套件目录")
    parser.add_argument("--json", default=DEFAULT_JSON, help="extract_suite_tags.py 输出的 JSON")
    args = parser.parse_args()
    suite_dir = os.path.abspath(args.suite_dir)
    if not os.path.isdir(suite_dir):
        parser.error(f"测试套件目录不存在: {suite_dir}")
    with open(args.json, encoding="utf-8") as f:
        tree = json.load(f)

    mine = extractor_cases(tree)
    rt = runtime_cases(suite_dir)
    total = sum(len(v) for v in mine.values())
    rt_total = sum(len(v) for v in rt.values())
    mism = [k for k, v in mine.items() if sorted(map(sorted, v)) != sorted(map(sorted, rt.get(k, [])))]
    missing = [k for k in rt if k not in mine]

    print(f"test case 数：提取 {total}，RF 运行时 {rt_total}")
    print(f"effective_tags 与 RF 运行时一致：{total - sum(len(mine[k]) for k in mism)} / {total}")
    for k in mism[:20]:
        print(f"    不一致：{k[0]} :: {k[1][:60]}\n         提取={sorted(mine[k][0])}\n         运行时={rt.get(k)}")
    for k in missing[:20]:
        print(f"    只在 RF 运行时出现：{k[0]} :: {k[1][:60]}")
    dup = {k: v for k, v in mine.items() if len(v) > 1}
    if dup:
        print(f"同一文件内重名的 test case（{len(dup)} 组）：")
        for k, v in dup.items():
            print(f"    {k[0]} :: {k[1]!r} × {len(v)}，各自的 tag：{[sorted(s) for s in v]}")
    ok = not mism and not missing and total == rt_total
    print("结果：一致" if ok else "结果：存在差异")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
