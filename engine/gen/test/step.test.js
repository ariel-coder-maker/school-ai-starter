// Where a step writes: only inside 01_curriculum/<subject>/units/ and 06_outputs/,
// whatever names a request carries.   node --test test/step.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-step-'));
fs.mkdirSync(path.join(TMP, '01_curriculum', 'science'), { recursive: true });
fs.mkdirSync(path.join(TMP, '01_curriculum', '_template'), { recursive: true });
process.env.KIT_DIR = TMP;
const { unitPaths } = require('../step.js');

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('a crafted unit name is refused', () => {
  for (const unit of ['../../../00_school', '..', 'a/b', 'grade 7', 'UPPER', 'x'.repeat(61)]) {
    assert.throws(() => unitPaths({ subject: 'science', unit }), /not a unit name/, unit);
  }
});

test('a subject that is not set up is refused', () => {
  for (const subject of ['../00_school', '_template', 'science/../..', 'history']) {
    assert.throws(() => unitPaths({ subject, unit: 'grade_7_t1_forces' }), /01_curriculum/, subject);
  }
});

test('ordinary names give paths inside the curriculum and output folders', () => {
  const p = unitPaths({ subject: 'science', unit: 'grade_7_t1_forces', lesson: 3, teacher: '../../Ann' });
  assert.equal(p.outline, '01_curriculum/science/units/grade_7_t1_forces/1_outline.md');
  assert.match(p.lesson, /^06_outputs\/[a-z0-9_]+\/science_grade_7_t1_forces\/L03_lesson\.md$/);
  const fromTopic = unitPaths({ subject: 'science', grade: 'Grade 7', term: 1, topic: 'Forces & Motion!' });
  assert.equal(fromTopic.unit, 'grade_7_t1_forces_motion');
});
