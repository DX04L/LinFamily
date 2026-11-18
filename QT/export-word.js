const wordNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const officeNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageNS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const fontName = 'Bpmf GenSen Rounded R';
const docxType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const escape = value => String(value ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/[&<>"']/g,
  char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[char]);

function run(value, {font = false, bold = false, color = '', size = ''} = {}) {
  const fonts = font ? `<w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:eastAsia="${fontName}"/>` : '';
  const shade = /^[0-9A-F]{6}$/i.test(color) ? `<w:shd w:val="clear" w:fill="${color}"/>` : '';
  const properties = fonts + (bold ? '<w:b/>' : '') + shade + (size ? `<w:sz w:val="${size}"/>` : '');
  const lines = String(value ?? '').split(/\r?\n/).map(line => `<w:t xml:space="preserve">${escape(line)}</w:t>`);
  return `<w:r><w:rPr>${properties}</w:rPr>${lines.join('<w:br/>')}</w:r>`;
}

function runs(node, style = {}, skipEnglish = false) {
  if (node.nodeType === Node.TEXT_NODE) return node.data.trim() || !node.data.includes('\n') ? run(node.data, style) : '';
  if (!(node instanceof Element) || node.matches('button, .actions') || (skipEnglish && node.matches('.eng-verse'))) return '';
  const next = {
    ...style,
    font: style.font || node.matches('.zhuyin'),
    bold: style.bold || node.matches('small,strong,h2,h3,summary,.eyebrow'),
    color: node.dataset.color || style.color,
  };
  return [...node.childNodes].map(child => runs(child, next, skipEnglish)).join('');
}

const paragraph = (content, next = false) => content
  ? `<w:p><w:pPr>${next ? '<w:keepNext/>' : ''}<w:spacing w:after="120"/></w:pPr>${content}</w:p>` : '';

function contentForView(entry, view) {
  const heading = view.mode === 'kids' ? '兒童版' : '成人版';
  const lines = [paragraph(run(heading, {bold:true,size:34}), true)];
  for (const block of view.panel.querySelectorAll('p,h2,h3,li,summary')) {
    if (block.closest('.actions')) continue;
    lines.push(paragraph(runs(block, {}, true), block.matches('h2,h3,summary,.eyebrow')));
    const english = block.querySelector('.eng-verse');
    if (english) lines.push(paragraph(runs(english)));
  }
  if (view.mode === 'adult') {
    const prompts = (entry.adult_content.theology_points || []).filter(point => point.deep_dive_prompt);
    if (prompts.length) {
      lines.push(paragraph(run('延伸探討提問', {bold:true}), true));
      prompts.forEach(point => lines.push(paragraph(run(point.deep_dive_prompt))));
    }
  } else if (entry.kids_content.plain_explanation_ruby) {
    lines.push(paragraph(run('白話經文大意', {bold:true}), true));
    const plain = entry.kids_content.plain_explanation_ruby.replace(/<rt>[^<]*<\/rt>|<\/?ruby>/g, '');
    lines.push(paragraph(run(plain, {font:true})));
  }
  const notes = view.notes.filter(mark => mark.note);
  if (notes.length) {
    lines.push(paragraph(run('個人備註', {bold:true}), true));
    for (const note of notes) {
      lines.push(paragraph(run(note.quote, {font:view.mode === 'kids',color:note.color || 'F9DB82'}), true));
      lines.push(paragraph(run(note.note)));
    }
  }
  return lines.join('');
}

function getZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    script.onload = () => window.JSZip ? resolve(window.JSZip) : reject(new Error('ZIP library unavailable'));
    script.onerror = reject;
    document.head.append(script);
  });
}

function relationships(entries) {
  return xml + `<Relationships xmlns="${packageNS}">` + entries.map(([name, target, type]) =>
    `<Relationship Id="${name}" Type="${type || officeNS}/${name}" Target="${target}"/>`).join('') + '</Relationships>';
}

export async function exportWord(entry, views) {
  const [Zip, fontResponse, licenseResponse] = await Promise.all([
    getZip(), fetch(new URL('../fonts/BpmfGenSenRounded-R.ttf', import.meta.url)),
    fetch(new URL('./bpmf-font-license.txt', import.meta.url)),
  ]);
  if (!fontResponse.ok || !licenseResponse.ok) throw new Error('Unable to load the Bopomofo font');
  const font = new Uint8Array(await fontResponse.arrayBuffer());
  const fontKey = crypto.randomUUID().toUpperCase();
  const key = fontKey.replace(/-/g, '').match(/../g).map(byte => parseInt(byte, 16)).reverse();
  for (let i = 0; i < 32; i++) font[i] ^= key[i % 16];

  const zip = new Zip();
  const contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml';
  zip.file('[Content_Types].xml', xml + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Default Extension="txt" ContentType="text/plain"/>
    <Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>
    <Override PartName="/word/document.xml" ContentType="${contentType}.document.main+xml"/>
    <Override PartName="/word/fontTable.xml" ContentType="${contentType}.fontTable+xml"/>
    <Override PartName="/word/settings.xml" ContentType="${contentType}.settings+xml"/>
  </Types>`);
  zip.file('_rels/.rels', relationships([['officeDocument', 'word/document.xml']]));
  zip.file('word/_rels/document.xml.rels', relationships([
    ['fontTable', 'fontTable.xml'], ['settings', 'settings.xml'],
  ]));
  zip.file('word/_rels/fontTable.xml.rels', relationships([['font', 'fonts/bpmf.odttf']]));
  zip.file('word/fonts/bpmf.odttf', font);
  zip.file('word/fonts/OFL.txt', 'Bpmf GenSen Rounded R (源泉注音圓體), But Ko — https://github.com/ButTaiwan/bpmfvs\n\n' + await licenseResponse.text());
  zip.file('word/settings.xml', xml + `<w:settings xmlns:w="${wordNS}"><w:embedTrueTypeFonts/></w:settings>`);
  zip.file('word/fontTable.xml', xml + `<w:fonts xmlns:w="${wordNS}" xmlns:r="${officeNS}">
    <w:font w:name="${fontName}"><w:embedRegular r:id="font" w:fontKey="{${fontKey}}"/></w:font>
  </w:fonts>`);
  const lead = [
    paragraph(run('Daily QT · 每日靈修', {bold:true,size:40}),true),
    paragraph(run(`${entry.date}　${entry.scripture.reference}　${entry.scripture.eng_reference || ''}`),true),
    paragraph(run(entry.source_channel)),
    paragraph(run(entry.video_url)),
    paragraph(run(entry.mismatch_warning)),
  ].join('');
  zip.file('word/document.xml', xml + `<w:document xmlns:w="${wordNS}"><w:body>${lead}${
    views.map(view => contentForView(entry, view)).join('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
  }</w:body></w:document>`);

  const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE',mimeType:docxType});
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `Daily-QT-${entry.date}.docx`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30000);
}
