#!/usr/bin/env python3
"""
build_singlefile.py — re-inline the FRONT PAGE into one portable HTML file.

    python3 build_singlefile.py                    # -> ../adeptio_paybill_live_dashboard.html
    python3 build_singlefile.py out.html           # explicit path
    python3 build_singlefile.py --check out.html   # build, then verify the result

This folder is the source of truth; the one-file dashboard is a build product.
The build takes index.html and, in document order:

  * inlines every  <link rel="stylesheet" href="...">  as  <style>…</style>
  * inlines every  <script src="...">                  as  <script>…</script>
  * drops everything between  <!--SF-STRIP-START-->  and  <!--SF-STRIP-END-->
    and between  /*SF-STRIP-START*/  and  /*SF-STRIP-END*/  inside the inlined
    JS — the cross-page links and the Menus launcher, which would dangle in a
    file that ships on its own
  * drops the ADEPTIO-LOGS block entirely: seeded replay rebuilds the identical
    week from ADEPTIO_SEED, so the build stays ~190 KB instead of ~1.4 MB

Only page 1 is bundled. Pages 2 and 3 (flow-instrumentation.html,
incident-trace.html) and the menus/ + admin/ screens stay multi-file BY DESIGN:
they are a site, not a widget, and they cross-link to each other by relative
path. Nothing is minified or reordered, so the single file behaves identically
to the folder: same statuses, same values, same timeline, same #t= deep links.

No third-party modules — standard library only, Python 3.8+.
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "index.html")
DEFAULT_OUT = os.path.join(os.path.dirname(HERE), "adeptio_paybill_live_dashboard.html")

LINK_RE = re.compile(r'[ \t]*<link[^>]*rel=["\']stylesheet["\'][^>]*>[ \t]*\n?', re.I)
HREF_RE = re.compile(r'href=["\']([^"\']+)["\']', re.I)
SCRIPT_RE = re.compile(r'[ \t]*<script[^>]*\bsrc=["\']([^"\']+)["\'][^>]*>\s*</script>[ \t]*\n?', re.I)
HTML_STRIP_RE = re.compile(r'<!--SF-STRIP-START-->.*?<!--SF-STRIP-END-->', re.S)
JS_STRIP_RE = re.compile(r'/\*SF-STRIP-START\*/.*?/\*SF-STRIP-END\*/', re.S)
LOGS_RE = re.compile(r'<!--ADEPTIO-LOGS-START.*?ADEPTIO-LOGS-END-->\n?', re.S)
LOGS_LIVE_RE = re.compile(r'<!--ADEPTIO-LOGS-START.*?-->\n?(.*?)<!--ADEPTIO-LOGS-END-->\n?', re.S)


def read(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def strip_logs(html):
    """Remove the day-log block in either mode.

    Seeded replay (what the site ships): the seven tags live inside ONE comment
    running START -> END, so the whole comment goes.
    Materialised mode: the comment is cut in two and the tags are live between
    the halves; the span from START to END still covers them.
    """
    out, n = LOGS_RE.subn("", html)
    if n:
        return out, n
    return LOGS_LIVE_RE.subn("", html)


def inline_css(html, missing):
    def repl(m):
        tag = m.group(0)
        href = HREF_RE.search(tag)
        if not href:
            return tag
        src = href.group(1)
        if src.startswith(("http:", "https:", "//", "data:")):
            return tag                                  # nothing external ships, but be safe
        path = os.path.join(HERE, src)
        if not os.path.isfile(path):
            missing.append(src)
            return tag
        return "<style>/* %s */\n%s\n</style>\n" % (src, read(path).rstrip())
    return LINK_RE.sub(repl, html)


def inline_js(html, missing):
    def repl(m):
        src = m.group(1)
        if src.startswith(("http:", "https:", "//", "data:")):
            return m.group(0)
        path = os.path.join(HERE, src)
        if not os.path.isfile(path):
            missing.append(src)
            return m.group(0)
        body = JS_STRIP_RE.sub("", read(path).rstrip())
        return "<script>/* %s */\n%s\n</script>\n" % (src, body)
    return SCRIPT_RE.sub(repl, html)


def build():
    html = read(SRC)
    missing = []

    html, dropped_logs = strip_logs(html)
    html, dropped_spans = HTML_STRIP_RE.subn("", html)      # cross-page chips + launcher
    html = inline_css(html, missing)
    html = inline_js(html, missing)

    left = re.findall(r'<(?:link[^>]*rel=["\']stylesheet["\']|script[^>]*\bsrc=)[^>]*>', html, re.I)
    return html, missing, dropped_logs, dropped_spans, left


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    check = "--check" in argv
    out = os.path.abspath(args[0]) if args else DEFAULT_OUT

    if not os.path.isfile(SRC):
        print("no index.html beside this script (%s)" % SRC, file=sys.stderr)
        return 2

    html, missing, dropped_logs, dropped_spans, left = build()

    if missing:
        print("MISSING sources, left as external references:", file=sys.stderr)
        for m in missing:
            print("  " + m, file=sys.stderr)
        return 1

    d = os.path.dirname(out)
    if d and not os.path.isdir(d):
        os.makedirs(d)
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(html)

    kb = os.path.getsize(out) / 1024.0
    print("built %s  (%.0f KB)" % (out, kb))
    print("  inlined      %d stylesheet(s) + %d script(s)"
          % (html.count("<style>/*"), html.count("<script>/*")))
    print("  stripped     %d SF-STRIP span(s), %d day-log block(s)" % (dropped_spans, dropped_logs))
    print("  remaining external references: %d" % len(left))
    if left:
        for tag in left:
            print("    " + tag.strip())
        return 1

    if check:
        bad = []
        if "ADEPTIO_SEED" not in html:
            bad.append("no seeded-replay path in the bundle")
        if re.search(r'<script[^>]*src=["\'][^"\']*log_day', html, re.I):
            bad.append("a day-log <script src> survived the strip")
        if 'class="plaunch-mount"' in html or 'class="navchip' in html:
            bad.append("an SF-STRIP span (nav chips / Menus launcher) survived the strip")
        for b in bad:
            print("  CHECK FAIL: " + b, file=sys.stderr)
        if bad:
            return 1
        print("  check        ok — self-contained, seeded, no page-1 nav chips")
        # engine.js is a protected file and carries ONE unmarked cross-page anchor
        # (the RCA panel's "flow map ->"). It rides along in the bundle and dangles
        # if the single file is shipped without the site — documented in README.md.
        if 'href="flow-instrumentation.html"' in html:
            print("  note         the RCA panel's 'flow map ->' anchor comes from "
                  "assets/engine.js (unmarked, protected) and only resolves beside the site")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
