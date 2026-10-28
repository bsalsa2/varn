"""Copy the state of VARN's Kaggle notebooks into the Command Center.

Runs on GitHub Actions (.github/workflows/kaggle-sync.yml). For each notebook it asks Kaggle for
the run status and downloads the run's output, keeps only report.md / report.json, and writes
platform/public/data/kaggle.json, which the Command Center reads. The Kaggle key stays in
GitHub secrets; the public site only ever sees this file.

The file is rewritten only when something in it changed, so a quiet notebook makes no commit
(each commit to main rebuilds the site).

    python training/automation/kaggle_sync.py              # write the file
    python training/automation/kaggle_sync.py --print      # show what would be written

Needs KAGGLE_USERNAME and KAGGLE_KEY. If either is missing it says so and exits cleanly.
"""
import argparse
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import run_pipeline as rp  # noqa: E402

OUT_FILE = HERE.parent.parent / "platform" / "public" / "data" / "kaggle.json"
KEEP = ("report.md", "report.json")
MAX_TEXT = 20_000          # characters kept per report; reports are a few hundred


def kernel_refs(environ):
    """Notebooks to sync: KAGGLE_KERNELS (comma separated) or the two VARN uses today."""
    listed = [k.strip() for k in environ.get("KAGGLE_KERNELS", "").split(",") if k.strip()]
    return listed or ["varnlabs/varn-train", f"{environ['KAGGLE_USERNAME']}/{rp.KERNEL_SLUG}"]


def read_reports(folder):
    """report.md / report.json from a downloaded output folder (first match of each)."""
    found = {}
    for name in KEEP:
        hit = next(iter(sorted(Path(folder).rglob(name))), None)
        if hit:
            found[name] = hit.read_text(errors="replace")[:MAX_TEXT]
    return found


def kernel_entry(ref, status_text, reports):
    entry = {"ref": ref, "url": f"https://www.kaggle.com/code/{ref}", "status": rp.parse_status(status_text)}
    entry["report_md"] = reports.get("report.md")
    raw = reports.get("report.json")
    try:
        entry["report_json"] = json.loads(raw) if raw else None
    except ValueError:
        entry["report_json"] = None
    return entry


def build(entries, previous, now):
    """The new file contents, keeping the old timestamp when nothing changed."""
    body = {"source": "Kaggle API via .github/workflows/kaggle-sync.yml", "kernels": entries}
    if previous and {k: previous.get(k) for k in body} == body:
        return previous
    return {"changed_at": now.isoformat(timespec="seconds").replace("+00:00", "Z"), **body}


def fetch(ref):
    """Status text and kept reports for one notebook (live Kaggle calls)."""
    status_text = rp.sh(["kaggle", "kernels", "status", ref], check=False)
    with tempfile.TemporaryDirectory(prefix="kaggle-sync-") as tmp:
        rp.sh(["kaggle", "kernels", "output", ref, "-p", tmp], check=False)
        return status_text, read_reports(tmp)


def main(argv=None, environ=None, fetcher=fetch, out_file=OUT_FILE, now=None):
    parser = argparse.ArgumentParser(description="Sync Kaggle notebook status into the Command Center.")
    parser.add_argument("--print", action="store_true", help="print the result; write nothing")
    args = parser.parse_args(argv)
    environ = os.environ if environ is None else environ
    missing = [n for n in ("KAGGLE_USERNAME", "KAGGLE_KEY") if not environ.get(n, "").strip()]
    if missing:
        print("Not set up yet, so nothing was synced. Missing: " + ", ".join(missing))
        return 0

    entries = []
    for ref in kernel_refs(environ):
        status_text, reports = fetcher(ref)
        entry = kernel_entry(ref, status_text, reports)
        print(f"  {ref}: {entry['status']}, report: {'yes' if entry['report_md'] or entry['report_json'] else 'none'}")
        entries.append(entry)

    out_file = Path(out_file)
    try:
        previous = json.loads(out_file.read_text())
    except (OSError, ValueError):
        previous = None
    result = build(entries, previous, now or datetime.now(timezone.utc))
    text = json.dumps(result, indent=1, ensure_ascii=False) + "\n"
    if args.print:
        print(text)
    elif result is previous:
        print("No change since the last sync.")
    else:
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(text)
        print(f"Wrote {out_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
