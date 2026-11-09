// The school layer (00_school/), read and edited from the Admin page.
//
// Only the six school files can be written, never anything else in the kit.
// Before a file is replaced, its current text is kept in 00_school/.versions/,
// so an edit can always be undone by hand.
'use strict';
const fs = require('fs');
const kit = require('./lib/kit.js');
const { Refused } = require('./step.js');

const SCHOOL_FILES = ['school_profile.md', 'calendar.md', 'assessment.md', 'policies.md', 'house_style.md', 'setup_log.md'];
const MAX_BYTES = 200 * 1024;

function listSchoolFiles() {
  return SCHOOL_FILES.map(name => {
    const text = kit.read(`00_school/${name}`);
    return text != null ? { name, text, missing: false }
      : { name, text: kit.read(`00_school/_templates/${name}`) || '', missing: true };
  });
}

function saveSchoolFile(name, text, by) {
  if (!SCHOOL_FILES.includes(name)) throw new Refused(`"${name}" is not a school file. School files: ${SCHOOL_FILES.join(', ')}.`);
  const body = String(text == null ? '' : text);
  if (Buffer.byteLength(body) > MAX_BYTES) throw new Refused('That text is too long for a school file (over 200 KB).');
  const current = kit.read(`00_school/${name}`);
  let savedVersion = null;
  if (current != null) {
    savedVersion = `00_school/.versions/${name.replace(/\.md$/, '')}.${Date.now()}.md`;
    kit.write(savedVersion, current);
  }
  kit.write(`00_school/${name}`, body);
  return { name, savedVersion, by };
}

module.exports = { SCHOOL_FILES, listSchoolFiles, saveSchoolFile };
