# -*- coding: utf-8 -*-
"""把 tag 快照写进 suite-tag-tree.html。

读取 extract_suite_tags.py 生成的 test_suite_tags.json，压缩后替换页面里
id="suite-tag-data" 的数据块；页面其余部分（样式和逻辑）不受影响。

数据压缩方式（与页面里的脚本约定一致）：
    generated / source  快照时间和来源目录名
    p   用 \\n 拼接的字符串池（名字和 tag）
    t   根节点列表
        目录      [名字下标, tag 下标数组或 null, 子节点]
        test 文件 [名字下标, tag 下标数组或 null, test case 列表, 1]
        test case [名字下标, tag 下标数组或 null, 行号]

用法：
    python scripts/build_suite_tag_tree.py [--json FILE] [--html FILE]
"""
import argparse
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_JSON = os.path.join(REPO_ROOT, "output", "test_suite_tags.json")
DEFAULT_HTML = os.path.join(REPO_ROOT, "suite-tag-tree.html")
DATA_START = '<script id="suite-tag-data" type="application/json">'
DATA_END = "</script>"


def encode(tree):
    pool, index = [], {}

    def sid(text):
        i = index.get(text)
        if i is None:
            i = len(pool)
            index[text] = i
            pool.append(text)
        return i

    def tag_ids(tags):
        return [sid(t) for t in tags] if tags else None

    def enc_case(case):
        return [sid(case["name"]), tag_ids(case["tags"]), case["line"]]

    def enc_file(tf):
        return [sid(tf["name"]), tag_ids(tf["tags"]), [enc_case(c) for c in tf["test_cases"]], 1]

    def enc_dir(node):
        return [sid(node["name"]), tag_ids(node["tags"]),
                [enc_dir(s) for s in node["sub_suites"]] + [enc_file(tf) for tf in node["test_files"]]]

    children = [enc_dir(s) for s in tree["suites"]] + [enc_file(tf) for tf in tree["root_test_files"]]
    if any("\n" in s for s in pool):
        sys.exit("有名字或 tag 里含换行，无法用 \\n 作为分隔符")

    meta = tree.get("meta", {})
    data = {
        "generated": meta.get("generated", ""),
        "source": os.path.basename(meta.get("source_root", "").rstrip("\\/")) or "",
        "p": "\n".join(pool),
        "t": children,
    }
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    # 数据里不能出现 </script>，否则会提前结束脚本块
    blob = blob.replace("<", "\\u003c")
    json.loads(blob)
    return blob, children


def inject(html, blob):
    start = html.find(DATA_START)
    if start < 0:
        sys.exit(f"页面里找不到数据块起始标记：{DATA_START}")
    start += len(DATA_START)
    end = html.find(DATA_END, start)
    if end < 0:
        sys.exit("页面里找不到数据块的结束标记 </script>")
    return html[:start] + blob + html[end:]


def main():
    parser = argparse.ArgumentParser(description="把 tag 快照写进 suite-tag-tree.html")
    parser.add_argument("--json", default=DEFAULT_JSON, help="extract_suite_tags.py 输出的 JSON")
    parser.add_argument("--html", default=DEFAULT_HTML, help="要写入的页面")
    args = parser.parse_args()
    with open(args.json, encoding="utf-8") as f:
        tree = json.load(f)
    with open(args.html, encoding="utf-8") as f:
        html = f.read()

    blob, children = encode(tree)
    with open(args.html, "w", encoding="utf-8", newline="\n") as f:
        f.write(inject(html, blob))

    counts = {"suite": 0, "sub": 0, "file": 0, "case": 0}

    def walk(nodes, depth):
        for n in nodes:
            if len(n) == 4:
                counts["file"] += 1
                counts["case"] += len(n[2])
            else:
                counts["suite" if depth == 0 else "sub"] += 1
                walk(n[2], depth + 1)

    walk(children, 0)
    size = os.path.getsize(args.html)
    print(f"页面：{args.html}（{size:,} 字节）")
    print(f"suite {counts['suite']}，次级 suite {counts['sub']}，test 文件 {counts['file']}，test case {counts['case']}")


if __name__ == "__main__":
    main()
