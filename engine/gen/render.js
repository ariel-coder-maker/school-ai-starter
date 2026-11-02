// Turn an approved Markdown file into the file a teacher opens.
//
//   node render.js 06_outputs/j_smith/sciences_grade_7_t1_forces/L03_worksheet.md
//
// Slides become PowerPoint (.pptx), with the teacher note in the speaker notes.
// Everything else becomes Word (.docx). The Markdown stays the source: edit
// it and render again, or edit the Word file by hand. The engine never
// overwrites a Word or PowerPoint file you have changed since it made it.
'use strict';
const fs = require('fs');
const path = require('path');
const kit = require('./lib/kit.js');

const renders = (rel) => /\.md$/.test(rel) && !/\.checks\.md$/.test(rel)
  && /(_lesson|_worksheet|_slides|3_assessment|3_rubric|2_sequence|1_outline|order_lists\/term\d+)\.md$/.test(rel);

const clean = (s) => String(s || '').replace(/<!--[\s\S]*?-->/g, '').replace(/`/g, '');

// "**bold** and plain" → runs
function runs(text, docx, base = {}) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(p => p.startsWith('**')
    ? new docx.TextRun({ ...base, text: p.slice(2, -2), bold: true })
    : new docx.TextRun({ ...base, text: p }));
}

async function toDocx(md, outAbs) {
  const docx = require('docx');
  const children = [];
  const lines = clean(md).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = [docx.HeadingLevel.HEADING_1, docx.HeadingLevel.HEADING_2, docx.HeadingLevel.HEADING_3, docx.HeadingLevel.HEADING_4][h[1].length - 1];
      children.push(new docx.Paragraph({ heading: level, children: runs(h[2], docx) }));
      continue;
    }
    if (/^\s*\|/.test(l)) {
      const block = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) block.push(lines[i++]);
      i--;
      const rows = block.filter(r => !/^\s*\|[\s:|-]+\|\s*$/.test(r))
        .map(r => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
      const width = Math.max(...rows.map(r => r.length));
      children.push(new docx.Table({
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
        rows: rows.map((r, ri) => new docx.TableRow({
          tableHeader: ri === 0,
          children: Array.from({ length: width }, (_, k) => new docx.TableCell({
            children: [new docx.Paragraph({ children: runs(r[k] || ' ', docx, ri === 0 ? { bold: true } : {}) })],
          })),
        })),
      }));
      children.push(new docx.Paragraph({ text: '' }));
      continue;
    }
    const bullet = l.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) { children.push(new docx.Paragraph({ bullet: { level: 0 }, children: runs(bullet[1], docx) })); continue; }
    if (/^---+\s*$/.test(l)) continue;
    children.push(new docx.Paragraph({ children: runs(l.replace(/^\s+/, ''), docx), spacing: { after: 80 } }));
  }
  const doc = new docx.Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  });
  fs.writeFileSync(outAbs, await docx.Packer.toBuffer(doc));
}

async function toPptx(md, outAbs) {
  const PptxGen = require('pptxgenjs');
  const pptx = new PptxGen();
  pptx.layout = 'LAYOUT_WIDE';
  const title = (clean(md).match(/^#\s+(.*)$/m) || [])[1] || 'Lesson';
  const blocks = clean(md).split(/^##\s+Slide\s+/m).slice(1);
  if (!blocks.length) throw new Error('no "## Slide n · purpose" headings to make slides from');
  for (const b of blocks) {
    const lines = b.split(/\r?\n/).slice(1);
    const cut = lines.findIndex(l => /^(Figure|Teacher note):/i.test(l));
    const screen = (cut === -1 ? lines : lines.slice(0, cut)).map(l => l.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim())
      .filter(l => l && !/^---+$/.test(l));
    const figure = (b.match(/^Figure:\s*(.+)$/mi) || [])[1];
    const note = ((b.match(/Teacher note:\s*([\s\S]*?)(?:\n---|$)/i) || [])[1] || '').trim();
    const s = pptx.addSlide();
    s.addText(screen[0] || title, { x: 0.5, y: 0.3, w: 12.3, h: 1.0, fontSize: 30, bold: true, color: '003C4B', fontFace: 'Calibri' });
    const body = screen.slice(1).map(t => ({ text: t.replace(/^[-*]\s+/, ''), options: { bullet: /^[-*]\s+/.test(t), breakLine: true } }));
    if (body.length) s.addText(body, { x: 0.6, y: 1.45, w: 12.1, h: 5.0, fontSize: 22, valign: 'top', fontFace: 'Calibri', color: '1F2A30' });
    if (figure && !/^none\b/i.test(figure.trim())) {
      s.addText(`Figure: ${figure}`, { x: 0.6, y: 6.6, w: 12.1, h: 0.5, fontSize: 12, italic: true, color: '4E6E78' });
    }
    if (note) s.addNotes(note);
  }
  fs.writeFileSync(outAbs, await pptx.write({ outputType: 'nodebuffer' }));
}

// Makes the .docx or .pptx next to the Markdown. Returns its path, or null if
// a file the teacher has edited by hand is in the way.
async function renderFile(rel) {
  const md = kit.read(rel);
  if (md == null) throw new Error(`${rel} does not exist`);
  const isSlides = /_slides\.md$/.test(rel);
  const outRel = rel.replace(/\.md$/, isSlides ? '.pptx' : '.docx');
  const outAbs = kit.abs(outRel);
  const stamp = kit.abs(`${path.dirname(rel)}/.versions/${path.basename(outRel)}.made`);
  if (fs.existsSync(outAbs) && fs.existsSync(stamp)
      && fs.statSync(outAbs).mtimeMs > Number(fs.readFileSync(stamp, 'utf8')) + 2000) {
    const keep = outRel.replace(/(\.\w+)$/, `.engine-${Date.now()}$1`);
    await (isSlides ? toPptx : toDocx)(md, kit.abs(keep));
    return `${keep} (your edited ${path.basename(outRel)} was kept)`;
  }
  await (isSlides ? toPptx : toDocx)(md, outAbs);
  kit.write(`${path.dirname(rel)}/.versions/${path.basename(outRel)}.made`, String(fs.statSync(outAbs).mtimeMs));
  return outRel;
}

async function main() {
  const rel = process.argv[2];
  if (!rel) { console.log('Usage: node render.js <file.md>'); return; }
  try { console.log(`Made ${await renderFile(kit.safeRel(rel))}.`); }
  catch (e) { console.error(`Not made: ${e.message}`); process.exitCode = 1; }
}

if (require.main === module) main();
module.exports = { renderFile, renders };
