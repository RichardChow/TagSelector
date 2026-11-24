# -*- coding: utf-8 -*-
"""扫描测试套件目录，导出 suite / 次级 suite / test 文件 / test case 四层结构和每一层的 tag。

解析交给 Robot Framework 自带的解析器（robot.parsing），注释、续行、空 [Tags] 等
语法细节都与 RF 的处理保持一致。层级与磁盘目录完全一致：

    suite（一级目录） -> 次级 suite（更深的目录） -> test 文件（.robot） -> test case

每个节点记录：
    tags            本层自己写的 tag
    effective_tags  继承所有上层 tag 之后，RF 实际运行时生效的 tag
    default_tags    文件级 Default Tags（只作用于没有自带 [Tags] 的 test case）

robot:* 保留 tag（如 robot:recursive-continue-on-failure）一律排除。

用法：
    python scripts/extract_suite_tags.py [--suite-dir DIR] [--out-dir DIR]

依赖：robotframework、openpyxl
输出：<out-dir>/test_suite_tags.json（主数据）、test_suite_tags.xlsx（人工查看）
"""
import argparse
import json
import os
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from robot.parsing import get_model
from robot.parsing.model.blocks import TestCase

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SUITE_DIR = os.path.normpath(os.path.join(REPO_ROOT, "..", "..", "Case", "test_suite"))
DEFAULT_OUT_DIR = os.path.join(REPO_ROOT, "output")
EXCLUDE_DIRS = {"config", "resource", "resources", "profile", "Test case design", "__pycache__"}

ROOT = DEFAULT_SUITE_DIR
OUT_DIR = DEFAULT_OUT_DIR


def keep(tag):
    """True for real tags. Only reserved 'robot:*' tags are dropped, so the
    output matches exactly what Robot Framework applies at runtime."""
    return not tag.lower().startswith("robot:")


def union(*lists):
    seen, out = set(), []
    for lst in lists:
        for t in lst:
            if t not in seen:
                seen.add(t)
                out.append(t)
    return out


def parse_file(path):
    """-> (settings_tags, default_tags, [{name, tags, line}])"""
    settings_tags, default_tags, cases = [], [], []
    for sec in get_model(path).sections:
        sec_type = type(sec).__name__
        if sec_type == "SettingSection":
            for st in sec.body:
                st_type = type(st).__name__
                if st_type in ("ForceTags", "TestTags"):
                    settings_tags = [t for t in st.values if keep(t)]
                elif st_type == "DefaultTags":
                    default_tags = [t for t in st.values if keep(t)]
        elif sec_type == "TestCaseSection":
            for block in sec.body:
                if not isinstance(block, TestCase):
                    continue
                own = []
                for st in block.body:
                    if type(st).__name__ == "Tags":
                        own.extend(t for t in st.values if keep(t))
                cases.append({"name": block.name, "tags": own, "line": block.lineno})
    return settings_tags, default_tags, cases


def dir_tags(dir_path):
    init = os.path.join(dir_path, "__init__.robot")
    if not os.path.isfile(init):
        return []
    return parse_file(init)[0]


def build_file(name, path, inherited):
    settings_tags, default_tags, cases = parse_file(path)
    file_eff = union(inherited, settings_tags)
    for c in cases:
        c["effective_tags"] = union(file_eff, c["tags"] if c["tags"] else default_tags)
    return {
        "name": name,
        "tags": settings_tags,
        "default_tags": default_tags,
        "effective_tags": file_eff,
        "test_cases": cases,
    }


def build_suite(name, dir_path, inherited):
    own = dir_tags(dir_path)
    eff = union(inherited, own)
    sub_suites, test_files = [], []
    for entry in sorted(os.listdir(dir_path), key=str.lower):
        full = os.path.join(dir_path, entry)
        if os.path.isdir(full):
            if entry in EXCLUDE_DIRS or entry.startswith("__pycache__"):
                continue
            sub_suites.append(build_suite(entry, full, eff))
        elif entry.lower().endswith(".robot") and entry.lower() != "__init__.robot":
            test_files.append(build_file(entry, full, eff))
    return {"name": name, "tags": own, "effective_tags": eff,
            "sub_suites": sub_suites, "test_files": test_files}


def build_tree():
    root_tags = dir_tags(ROOT)
    suites, root_files = [], []
    for entry in sorted(os.listdir(ROOT), key=str.lower):
        full = os.path.join(ROOT, entry)
        if os.path.isdir(full):
            if entry in EXCLUDE_DIRS or entry.startswith("__pycache__"):
                continue
            suites.append(build_suite(entry, full, root_tags))
        elif entry.lower().endswith(".robot") and entry.lower() != "__init__.robot":
            root_files.append(build_file(entry, full, root_tags))
    return {"root_force_tags": root_tags, "suites": suites, "root_test_files": root_files}


def walk_dir(node, path=""):
    """Yield (node, path, depth) for a suite dir and every suite dir below it."""
    here = f"{path}/{node['name']}" if path else node["name"]
    yield node, here, 0
    for sub in node["sub_suites"]:
        for item in walk_dir(sub, here):
            yield item[0], item[1], item[2] + 1


def write_json(tree):
    path = os.path.join(OUT_DIR, "test_suite_tags.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(tree, f, ensure_ascii=False, indent=2)
    return path


def write_xlsx(tree):
    wb = Workbook()
    hdr_font = Font(bold=True, color="FFFFFF")
    hdr_fill = PatternFill("solid", fgColor="4472C4")
    own_fill = PatternFill("solid", fgColor="FCE4D6")
    lvl_fill = {1: PatternFill("solid", fgColor="DDEBF7"),
                2: PatternFill("solid", fgColor="E2EFDA"),
                3: PatternFill("solid", fgColor="FFF2CC")}

    def header(ws, widths):
        for c in ws[1]:
            c.font, c.fill = hdr_font, hdr_fill
            c.alignment = Alignment(horizontal="center", vertical="center")
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions

    # 每个节点一行，任何层级
    ws = wb.active
    ws.title = "tree"
    ws.append(["Level", "Suite", "Sub-Suite", "Test File", "Test Case",
               "Own Tags", "Effective Tags (inherited)", "Path", "Line"])
    for suite in tree["suites"]:
        for node, p, depth in walk_dir(suite):
            level = 1 + depth
            sub = p[len(suite["name"]):].lstrip("/")
            ws.append([level, suite["name"] if level == 1 else "", sub, "", "",
                       " ".join(node["tags"]), " ".join(node["effective_tags"]), p, ""])
            for tf in node["test_files"]:
                fp = f"{p}/{tf['name']}"
                ws.append([3, suite["name"], sub, tf["name"], "",
                           " ".join(tf["tags"]), " ".join(tf["effective_tags"]), fp, ""])
                for c in tf["test_cases"]:
                    ws.append([4, suite["name"], sub, tf["name"], c["name"],
                               " ".join(c["tags"]), " ".join(c["effective_tags"]), fp, c["line"]])
    for tf in tree["root_test_files"]:
        fp = tf["name"]
        ws.append([3, "(root)", "", tf["name"], "",
                   " ".join(tf["tags"]), " ".join(tf["effective_tags"]), fp, ""])
        for c in tf["test_cases"]:
            ws.append([4, "(root)", "", tf["name"], c["name"],
                       " ".join(c["tags"]), " ".join(c["effective_tags"]), fp, c["line"]])
    for r in ws.iter_rows(min_row=2, max_row=ws.max_row):
        if r[0].value in lvl_fill:
            r[0].fill = lvl_fill[r[0].value]
        if r[5].value:
            r[5].fill = own_fill
    header(ws, [7, 22, 48, 50, 55, 40, 48, 95, 7])

    # 每个 tag 写在哪些位置
    ws2 = wb.create_sheet("tags")
    ws2.append(["Tag", "Level", "Suite", "Sub-Suite", "Test File", "Test Case", "Count"])
    rows = []

    def add(tag, level, suite, sub, tf, tc):
        rows.append((tag, level, suite, sub, tf, tc))

    for suite in tree["suites"]:
        for node, p, depth in walk_dir(suite):
            sub = p[len(suite["name"]):].lstrip("/")
            for t in node["tags"]:
                add(t, "suite" if depth == 0 else "sub-suite", suite["name"], sub if depth else "", "", "")
            for tf in node["test_files"]:
                for t in tf["tags"]:
                    add(t, "test file", suite["name"], sub, tf["name"], "")
                for c in tf["test_cases"]:
                    for t in c["tags"]:
                        add(t, "test case", suite["name"], sub, tf["name"], c["name"])
    for tf in tree["root_test_files"]:
        for t in tf["tags"]:
            add(t, "test file", "(root)", "", tf["name"], "")
        for c in tf["test_cases"]:
            for t in c["tags"]:
                add(t, "test case", "(root)", "", tf["name"], c["name"])
    rows.sort(key=lambda r: (r[0].lower(), r[1], r[2].lower(), r[3].lower(), r[4].lower(), r[5].lower()))
    for r in rows:
        ws2.append(list(r))
    header(ws2, [32, 12, 22, 44, 48, 55, 7])

    # tag 汇总
    ws3 = wb.create_sheet("tag_summary")
    ws3.append(["Tag", "Total", "At suite", "At sub-suite", "At test file", "At test case", "Suites"])
    grouped = {}
    for tag, level, suite, *_ in rows:
        a = grouped.setdefault(tag, {"n": 0, "lv": {}, "s": set()})
        a["n"] += 1
        a["lv"][level] = a["lv"].get(level, 0) + 1
        a["s"].add(suite)
    for tag in sorted(grouped, key=lambda k: (-grouped[k]["n"], k.lower())):
        a = grouped[tag]
        ws3.append([tag, a["n"], a["lv"].get("suite", 0), a["lv"].get("sub-suite", 0),
                    a["lv"].get("test file", 0), a["lv"].get("test case", 0), ", ".join(sorted(a["s"]))])
    header(ws3, [32, 8, 10, 13, 13, 14, 80])

    wb.save(os.path.join(OUT_DIR, "test_suite_tags.xlsx"))


def main():
    global ROOT, OUT_DIR
    parser = argparse.ArgumentParser(description="导出测试套件目录的结构与 tag")
    parser.add_argument("--suite-dir", default=DEFAULT_SUITE_DIR, help="测试套件目录")
    parser.add_argument("--out-dir", default=DEFAULT_OUT_DIR, help="输出目录")
    args = parser.parse_args()
    ROOT = os.path.abspath(args.suite_dir)
    OUT_DIR = os.path.abspath(args.out_dir)
    if not os.path.isdir(ROOT):
        parser.error(f"测试套件目录不存在: {ROOT}")
    os.makedirs(OUT_DIR, exist_ok=True)

    tree = build_tree()
    tree["meta"] = {"source_root": ROOT, "generated": datetime.now().isoformat(timespec="seconds")}
    json_path = write_json(tree)
    write_xlsx(tree)

    n_sub = n_file_tag = n_case = n_case_tag = 0
    n_file = len(tree["root_test_files"])
    n_file_tag += sum(bool(tf["tags"]) for tf in tree["root_test_files"])
    for suite in tree["suites"]:
        for node, _, depth in walk_dir(suite):
            if depth:
                n_sub += 1
            n_file += len(node["test_files"])
            n_file_tag += sum(bool(tf["tags"]) for tf in node["test_files"])
            for tf in node["test_files"]:
                for case in tf["test_cases"]:
                    n_case += 1
                    n_case_tag += bool(case["tags"])
    for tf in tree["root_test_files"]:
        for case in tf["test_cases"]:
            n_case += 1
            n_case_tag += bool(case["tags"])
    print(f"suites={len(tree['suites'])} sub_suites={n_sub} test_files={n_file} test_cases={n_case}")
    print(f"suites with own tags={sum(1 for s in tree['suites'] if s['tags'])}/{len(tree['suites'])}"
          f" | test_files with own tags={n_file_tag}/{n_file}"
          f" | test_cases with own tags={n_case_tag}/{n_case}")
    print(f"root force tags={tree['root_force_tags']}")
    print(f"json -> {json_path}")


if __name__ == "__main__":
    main()
