"""Tests for training/automation/kaggle_sync.py. Kaggle is faked; nothing touches a network."""
import contextlib
import io
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "training" / "automation"))
import kaggle_sync as ks  # noqa: E402

ENV = {"KAGGLE_USERNAME": "someone", "KAGGLE_KEY": "k"}
T1 = datetime(2026, 10, 27, 12, 0, tzinfo=timezone.utc)
T2 = datetime(2026, 10, 27, 18, 0, tzinfo=timezone.utc)


def fake(status, reports):
    return lambda ref: (f'{ref} has status "KernelWorkerStatus.{status}"', reports, None)


def run(out, fetcher, now, env=ENV):
    with contextlib.redirect_stdout(io.StringIO()):
        return ks.main([], environ=env, fetcher=fetcher, out_file=out, now=now)


class KaggleSyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.out = Path(self.tmp.name) / "data" / "kaggle.json"

    def tearDown(self):
        self.tmp.cleanup()

    def test_default_kernels(self):
        self.assertEqual(ks.kernel_refs(ENV), ["varnlabs/varn-train", "someone/skynode-train"])
        self.assertEqual(ks.kernel_refs({**ENV, "KAGGLE_KERNELS": "a/b, c/d"}), ["a/b", "c/d"])

    def test_missing_secrets_writes_nothing(self):
        self.assertEqual(run(self.out, fake("COMPLETE", {}), T1, env={}), 0)
        self.assertFalse(self.out.exists())

    def test_writes_status_and_reports(self):
        run(self.out, fake("COMPLETE", {"report.md": "Verdict: KEEP v3", "report.json": '{"status": "kept"}'}), T1)
        data = json.loads(self.out.read_text())
        self.assertEqual(data["changed_at"], "2026-10-27T12:00:00Z")
        first = data["kernels"][0]
        self.assertEqual(first["status"], "COMPLETE")
        self.assertEqual(first["report_md"], "Verdict: KEEP v3")
        self.assertEqual(first["report_json"], {"status": "kept"})
        self.assertEqual(first["url"], "https://www.kaggle.com/code/varnlabs/varn-train")

    def test_unchanged_keeps_timestamp(self):
        run(self.out, fake("RUNNING", {}), T1)
        run(self.out, fake("RUNNING", {}), T2)
        self.assertEqual(json.loads(self.out.read_text())["changed_at"], "2026-10-27T12:00:00Z")
        run(self.out, fake("COMPLETE", {}), T2)
        self.assertEqual(json.loads(self.out.read_text())["changed_at"], "2026-10-27T18:00:00Z")

    def test_bad_report_json_is_dropped(self):
        entry = ks.kernel_entry("a/b", "status RUNNING", {"report.json": "{nope"})
        self.assertIsNone(entry["report_json"])
        self.assertEqual(entry["status"], "RUNNING")

    def test_error_is_recorded(self):
        run(self.out, lambda ref: ("", {}, "403 Client Error: Forbidden"), T1)
        first = json.loads(self.out.read_text())["kernels"][0]
        self.assertEqual(first["status"], "UNREACHABLE")
        self.assertEqual(first["error"], "403 Client Error: Forbidden")

    def test_short_error(self):
        self.assertEqual(ks.short_error("Traceback...\n\nkaggle.rest.ApiException: (404)\n"), "kaggle.rest.ApiException: (404)")

    def test_reads_nested_reports(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "out").mkdir()
            (Path(tmp) / "out" / "report.md").write_text("hello")
            self.assertEqual(ks.read_reports(tmp), {"report.md": "hello"})


if __name__ == "__main__":
    unittest.main()
