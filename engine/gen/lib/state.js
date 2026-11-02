// Where a file stands: not made, draft, approved, changed since approval, or
// out of date (a step it was built on, or a step THAT was built on, has
// changed since).
'use strict';
const kit = require('./kit.js');
const DB = require('./db.js');

async function stateOf(rel, depth = 0) {
  const md = kit.read(rel);
  if (md == null) return { state: 'not made' };
  const h = kit.header(md);
  const stale = [];
  for (const dep of (h.built_on && h.built_on !== '-' ? h.built_on.split(',') : [])) {
    const [depRel, depHash] = dep.split('@');
    const a = await DB.approvalOf(depRel);
    const cur = kit.read(depRel);
    const moved = !a || cur == null || a.content_hash !== kit.approvalHash(cur) || !a.content_hash.startsWith(depHash);
    const upstreamStale = !moved && depth < 6 && (await stateOf(depRel, depth + 1)).state === 'out of date';
    if (moved || upstreamStale) stale.push(depRel);
  }
  const a = await DB.approvalOf(rel);
  const current = a && a.content_hash === kit.approvalHash(md);
  let state = current ? 'approved' : a ? 'changed since approval' : 'draft';
  if (stale.length) state = 'out of date';
  const checksMd = kit.read(rel.replace(/\.md$/, '.checks.md')) || '';
  const failed = (checksMd.match(/\*\*FAIL\*\*/g) || []).length;
  return { state, stale, approvedBy: current ? a.approved_by : null, model: h.kind ? h.model : null, failedChecks: failed };
}

module.exports = { stateOf };
