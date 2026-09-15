import json, tempfile, unittest
from pathlib import Path
from benchmark import canonical, display, distance, normalize_input, score, render

class BenchmarkChecks(unittest.TestCase):
    def test_style_equivalence_does_not_hide_wrong_vowels(self):
        self.assertEqual(canonical('Khaab, khoob; gharib!'),canonical('khab khub qarib'))
        self.assertNotEqual(canonical('mard'),canonical('mord'))
        self.assertNotEqual(canonical('omid'),canonical('emid'))
        self.assertNotEqual(canonical('gharib'),canonical('gharibe'))
    def test_alphabets_are_not_interchangeable(self):
        self.assertEqual(display('salAm xoS','negara'),'salaam khosh')
        self.assertEqual(display('s/lam xoS','homo'),'salaam khosh')
        self.assertEqual(display('ketabe1','homo'),'ketaabe')
        self.assertEqual(display('ce$mat @em$/b','homo'),"cheshmaat 'emshab")
        self.assertEqual(display('CeSmAt emSab','negara'),'cheshmaat emshab')
    def test_missing_added_words_count(self):
        self.assertEqual(score('delam tang shode',['delam barat tang shode'])['word_edits'],1)
        self.assertEqual(score('delam kheili barat tang shode',['delam barat tang shode'])['word_edits'],1)
    def test_reference_variants(self):
        self.assertTrue(score('delash',['delesh','delash'])['exact'])
    def test_normalization_preserves_colloquial_and_zwnj(self):
        self.assertEqual(normalize_input('  مي‌خوام   كنار تو  '),'می‌خوام کنار تو')
    def test_distance(self):
        self.assertEqual(distance('kitten','sitting'),3)
        self.assertEqual(distance([],['a']),1)
    def test_fixture_integrity(self):
        rows=json.loads(Path(__file__).with_name('suite.json').read_text())['cases']
        self.assertEqual(len(rows),68)
        self.assertEqual(sum(r['split']=='holdout' for r in rows),16)
        self.assertEqual(len(set(r['id'] for r in rows)),len(rows))
        for row in rows:
            self.assertTrue(row['references']);self.assertTrue(normalize_input(row['persian']))
            self.assertTrue(all(canonical(ref) for ref in row['references']))
        dev={r['persian'] for r in rows if r['split']=='dev'}
        self.assertFalse(dev & {r['persian'] for r in rows if r['split']=='holdout'})
    def test_incomplete_runs_and_html_are_safe(self):
        with tempfile.TemporaryDirectory() as folder:
            s=render(Path(folder),[{'id':'x','persian':'<script>','references':['a'],'model':'homo','beams':1,'repeat':0,'category':'test','error':'failed'}])
            self.assertEqual(s[0]['errors'],1)
            self.assertIsNone(s[0]['median_ms'])
            self.assertIn('&lt;script&gt;',(Path(folder)/'review.html').read_text())

if __name__=='__main__':unittest.main()
