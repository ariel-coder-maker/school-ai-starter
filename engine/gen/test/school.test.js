// Reading and editing the school layer, in a throwaway copy of the kit folder.
//   node --test test/school.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REAL_KIT = path.resolve(__dirname, '..', '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-school-'));
fs.cpSync(path.join(REAL_KIT, '00_school', '_templates'), path.join(TMP, '00_school', '_templates'), { recursive: true });
process.env.KIT_DIR = TMP;
const school = require('../school.js');

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('listSchoolFiles returns templates for missing files', () => {
  const files = school.listSchoolFiles();
  assert.deepEqual(files.map(f => f.name), school.SCHOOL_FILES);
  assert.ok(files.every(f => f.missing === true && f.text.length > 0));
});

test('saveSchoolFile writes and keeps the old version', () => {
  school.saveSchoolFile('calendar.md', '# First\n', 'Admin');
  school.saveSchoolFile('calendar.md', '# Second\n', 'Admin');
  assert.equal(fs.readFileSync(path.join(TMP, '00_school', 'calendar.md'), 'utf8'), '# Second\n');
  const versions = fs.readdirSync(path.join(TMP, '00_school', '.versions'));
  assert.equal(versions.length, 1);
  assert.equal(fs.readFileSync(path.join(TMP, '00_school', '.versions', versions[0]), 'utf8'), '# First\n');
  assert.equal(school.listSchoolFiles().find(f => f.name === 'calendar.md').missing, false);
});

test('saveSchoolFile refuses names outside 00_school', () => {
  for (const name of ['../engine/.env', '_templates/calendar.md', 'notes.js', 'CALENDAR.md']) {
    assert.throws(() => school.saveSchoolFile(name, 'x', 'Admin'), /not a school file/, name);
  }
  assert.equal(fs.existsSync(path.join(TMP, 'engine')), false);
});

test('saveSchoolFile refuses text over 200 KB', () => {
  assert.throws(() => school.saveSchoolFile('policies.md', 'x'.repeat(200 * 1024 + 1), 'Admin'), /too long/);
});
