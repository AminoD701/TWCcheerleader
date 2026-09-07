import sys
import types
import unittest
import tempfile
import json
import hashlib
from pathlib import Path
from unittest.mock import patch

# Publishing tests do not need the optional network decoder.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
with patch.dict(sys.modules, {'googlenewsdecoder': types.SimpleNamespace(new_decoderv1=lambda *a, **k: {})}):
    import fetch_auto_news as core

class PublishingTests(unittest.TestCase):
    def test_sheet_headers_match_frontend_normalization(self):
        with patch.object(core, 'fetch_text', return_value='realName,nickname,team\n測試本名,小名,Si-ster\n'):
            names, teams = core.load_site_entities()
        self.assertIn('測試本名', names)
        self.assertIn('Si-ster', teams)

    def test_failure_preserves_last_success_and_timestamp(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            core.publish_news([{'title':'原新聞'}], succeeded=1, failed=0, directory=directory)
            before = {p.name:p.read_bytes() for p in directory.iterdir()}
            with self.assertRaises(RuntimeError):
                core.publish_news([], succeeded=0, failed=103, directory=directory)
            self.assertEqual(before, {p.name:p.read_bytes() for p in directory.iterdir()})

    def test_unchanged_data_keeps_update_time_and_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            items = [{'title':'新聞', 'date':'2026/09/06 18:06'}]
            core.publish_news(items, succeeded=1, failed=0, directory=directory)
            first = json.loads((directory/'auto-news-meta.json').read_text())
            core.publish_news(items, succeeded=1, failed=1, directory=directory)
            second = json.loads((directory/'auto-news-meta.json').read_text())
            self.assertEqual(first['updatedAt'], second['updatedAt'])
            self.assertEqual(second['status'], 'partial')
            self.assertEqual(second['sha256'], hashlib.sha256((directory/'auto-news.json').read_bytes()).hexdigest())

if __name__ == '__main__':
    unittest.main()
