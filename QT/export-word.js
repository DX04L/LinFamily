const wordNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const officeNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageNS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const fontName = 'Bpmf GenSen Rounded R';
const themes = {
  'grown-up': {label:'大人', ink:'34463D', accent:'576B56', paper:'EFEBE0', line:'C6CCBC', font:'Noto Serif TC'},
  kids: {label:'兒童', ink:'50324B', accent:'903C6E', paper:'FAEAF1', line:'EAB6C9', font:fontName},
};
const docxType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const escape = value => String(value ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/[&<>"']/g,
  char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[char]);

function run(value, {font, bold = false, color = '', ink = '', size = ''} = {}) {
  const family = font === true ? fontName : font;
  const fonts = family ? `<w:rFonts w:ascii="${family}" w:hAnsi="${family}" w:eastAsia="${family}"/>` : '';
  const shade = /^[0-9A-F]{6}$/i.test(color) ? `<w:shd w:val="clear" w:fill="${color}"/>` : '';
  const properties = fonts + (bold ? '<w:b/>' : '') + (ink ? `<w:color w:val="${ink}"/>` : '') + shade + (size ? `<w:sz w:val="${size}"/>` : '');
  const lines = String(value ?? '').split(/\r?\n/).map(line => `<w:t xml:space="preserve">${escape(line)}</w:t>`);
  return `<w:r><w:rPr>${properties}</w:rPr>${lines.join('<w:br/>')}</w:r>`;
}

function runs(node, style = {}, skipEnglish = false) {
  if (node.nodeType === Node.TEXT_NODE) return node.data.trim() || !node.data.includes('\n') ? run(node.data, style) : '';
  if (!(node instanceof Element) || node.matches('button, .actions') || (skipEnglish && node.matches('.eng-verse'))) return '';
  const next = {
    ...style,
    font: node.matches('.zhuyin') ? fontName : style.font,
    bold: style.bold || node.matches('small,strong,h2,h3,summary,.eyebrow'),
    color: node.dataset.color || style.color,
  };
  return [...node.childNodes].map(child => runs(child, next, skipEnglish)).join('');
}

function paragraph(content, {keep = false, before = 0, after = 120, fill = '', border = ''} = {}) {
  if (!content) return '';
  const rule = border ? `<w:pBdr><w:bottom w:val="single" w:sz="5" w:space="5" w:color="${border}"/></w:pBdr>` : '';
  const shading = fill ? `<w:shd w:val="clear" w:fill="${fill}"/>` : '';
  return `<w:p><w:pPr>${keep ? '<w:keepNext/>' : ''}${rule}${shading}<w:spacing w:before="${before}" w:after="${after}" w:line="330" w:lineRule="auto"/></w:pPr>${content}</w:p>`;
}

function contentForView(entry, view, theme) {
  const lines = [];
  const section = text => paragraph(run(text, {bold:true,ink:theme.accent,size:27}),
    {keep:true,before:160,after:95,border:theme.line});
  for (const block of view.panel.querySelectorAll('p,h2,h3,li,summary')) {
    if (block.closest('.actions')) continue;
    const heading = block.matches('h2,h3,summary,.eyebrow');
    const english = block.querySelector('.eng-verse');
    const style = {ink:heading ? theme.accent : theme.ink, size:heading ? 27 : 23};
    lines.push(paragraph(runs(block, style, true), {
      keep:heading || Boolean(english), before:heading ? 170 : 0, after:english ? 35 : 120,
      border:heading ? theme.line : '', fill:block.closest('.prayer') ? theme.paper : '',
    }));
    if (english) lines.push(paragraph(runs(english, {ink:theme.accent,size:20}), {after:140}));
  }
  if (view.mode === 'grown-up') {
    const prompts = (entry.grownUpContent.theology_points || []).filter(point => point.deep_dive_prompt);
    if (prompts.length) {
      lines.push(section('延伸探討提問'));
      prompts.forEach(point => lines.push(paragraph(run(point.deep_dive_prompt, {ink:theme.ink}))));
    }
  } else if (entry.kids_content.plain_explanation_ruby) {
    const plain = entry.kids_content.plain_explanation_ruby.replace(/<rt>[^<]*<\/rt>|<\/?ruby>/g, '');
    lines.push(section('白話經文大意'));
    lines.push(paragraph(run(plain, {font:true,ink:theme.ink})));
  }
  const notes = view.notes.filter(mark => mark.note);
  if (notes.length) {
    lines.push(section('個人備註'));
    for (const note of notes) {
      lines.push(paragraph(run(note.quote, {font:view.mode === 'kids',color:note.color || 'F9DB82'}), {keep:true,after:60}));
      lines.push(paragraph(run(note.note, {ink:theme.ink})));
    }
  }
  return lines.join('');
}

async function artworkPng(svg) {
  svg.setAttribute('width', '620');
  svg.setAttribute('height', '510');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {type:'image/svg+xml;charset=utf-8'}));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 620;
    canvas.height = 510;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    if (!blob) throw new Error('Unable to render cover artwork');
    return blob.arrayBuffer();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hero(entry, theme) {
  const illustration = '<w:r><w:drawing><wp:inline><wp:extent cx="1510000" cy="1242097"/><wp:docPr id="1" name="QT cover illustration"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="cover.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="image"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1510000" cy="1242097"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  const title = paragraph(run(`Daily QT · ${theme.label}`, {bold:true,ink:theme.accent,size:22}), {keep:true,after:110})
    + paragraph(run(entry.scripture.reference, {font:theme.font,bold:true,ink:theme.ink,size:46}), {keep:true,after:80})
    + paragraph(run(`${entry.date}  ·  ${entry.scripture.eng_reference || ''}`, {ink:theme.accent,size:21}), {after:0});
  const cell = (width, body) => `<w:tc><w:tcPr><w:tcW w:type="dxa" w:w="${width}"/><w:shd w:val="clear" w:fill="${theme.paper}"/><w:vAlign w:val="center"/></w:tcPr>${body}</w:tc>`;
  return `<w:tbl><w:tblPr><w:tblW w:type="dxa" w:w="9626"/><w:tblCellMar><w:top w:w="240" w:type="dxa"/><w:left w:w="270" w:type="dxa"/><w:bottom w:w="240" w:type="dxa"/><w:right w:w="240" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="6650"/><w:gridCol w:w="2976"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(6650,title)}${cell(2976,paragraph(illustration,{after:0}))}</w:tr></w:tbl>`;
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

export async function exportWord(entry, view) {
  const theme = themes[view.mode];
  const isKids = view.mode === 'kids';
  const [Zip, cover, fontResponse, licenseResponse] = await Promise.all([
    getZip(), artworkPng(view.art),
    isKids && fetch(new URL('../fonts/BpmfGenSenRounded-R.ttf', import.meta.url)),
    isKids && fetch(new URL('./bpmf-font-license.txt', import.meta.url)),
  ]);
  const zip = new Zip();
  const contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml';
  zip.file('[Content_Types].xml', xml + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="png" ContentType="image/png"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Default Extension="txt" ContentType="text/plain"/>
    <Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>
    <Override PartName="/word/document.xml" ContentType="${contentType}.document.main+xml"/>
    ${isKids ? `<Override PartName="/word/fontTable.xml" ContentType="${contentType}.fontTable+xml"/>
    <Override PartName="/word/settings.xml" ContentType="${contentType}.settings+xml"/>` : ''}
  </Types>`);
  zip.file('_rels/.rels', relationships([['officeDocument', 'word/document.xml']]));
  zip.file('word/media/cover.png', cover);
  const rels = [['image', 'media/cover.png']];
  if (isKids) {
    rels.push(['fontTable', 'fontTable.xml'], ['settings', 'settings.xml']);
    if (!fontResponse.ok || !licenseResponse.ok) throw new Error('Unable to load the Bopomofo font');
    const font = new Uint8Array(await fontResponse.arrayBuffer());
    const fontKey = crypto.randomUUID().toUpperCase();
    const key = fontKey.replace(/-/g, '').match(/../g).map(byte => parseInt(byte, 16)).reverse();
    for (let i = 0; i < 32; i++) font[i] ^= key[i % 16];
    zip.file('word/_rels/fontTable.xml.rels', relationships([['font', 'fonts/bpmf.odttf']]));
    zip.file('word/fonts/bpmf.odttf', font);
    zip.file('word/fonts/OFL.txt', 'Bpmf GenSen Rounded R (源泉注音圓體), But Ko — https://github.com/ButTaiwan/bpmfvs\n\n' + await licenseResponse.text());
    zip.file('word/settings.xml', xml + `<w:settings xmlns:w="${wordNS}"><w:embedTrueTypeFonts/></w:settings>`);
    zip.file('word/fontTable.xml', xml + `<w:fonts xmlns:w="${wordNS}" xmlns:r="${officeNS}">
      <w:font w:name="${fontName}"><w:embedRegular r:id="font" w:fontKey="{${fontKey}}"/></w:font>
    </w:fonts>`);
  }
  zip.file('word/_rels/document.xml.rels', relationships(rels));
  const source = paragraph(run(entry.source_channel, {ink:theme.accent,size:18}), {before:140})
    + paragraph(entry.video_url ? run(entry.video_url, {ink:theme.accent,size:18}) : '')
    + paragraph(!isKids && entry.mismatch_warning ? run(entry.mismatch_warning, {ink:theme.accent,size:18}) : '');
  zip.file('word/document.xml', xml + `<w:document xmlns:w="${wordNS}" xmlns:r="${officeNS}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${
    hero(entry, theme) + source + contentForView(entry, view, theme)
  }<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1050" w:right="1140" w:bottom="1050" w:left="1140" w:header="450" w:footer="450" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE',mimeType:docxType});
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `Daily-QT-${entry.date}-${view.mode}.docx`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30000);
}
