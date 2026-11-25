export function readLegacyPage(items) {
  const lines = [];
  for (const item of items.filter(item => item.str?.trim()).sort((a, b) => b.transform[5] - a.transform[5])) {
    const y = item.transform[5];
    const line = lines.find(row => Math.abs(row.y - y) < 3);
    if (line) line.items.push(item);
    else lines.push({ y, items: [item] });
  }
  return lines.flatMap(row => {
    const text = row.items.sort((a, b) => a.transform[4] - b.transform[4]).map(item => item.str).join(' ').trim();
    if (!/^\d{1,2}\/\d{1,2}\s/.test(text)) return [];
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\s+(.+?)\s+([＋+－−-])\s*([\d,]+)(?:\s+.*)?$/u);
    if (!match) throw new Error('有一筆舊帳讀取失敗，請確認選的是原始 Hannah Bank PDF。');
    const [, month, day, label, sign, value] = match;
    const amount = Number(value.replaceAll(',', ''));
    if (!(amount >= 1 && amount <= 99999999) || Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) {
      throw new Error('PDF 有不完整的日期或金額。');
    }
    return [{ kind: /[＋+]/u.test(sign) ? 'income' : 'expense', amount, label, legacyDate: month + '/' + day }];
  });
}

export async function readLegacyPdf(file) {
  const base = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/';
  const pdfjs = await import(base + 'pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.mjs';
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
  try {
    if (pdf.numPages > 20) throw new Error('請選擇 20 頁以內的 Hannah Bank PDF。');
    const rows = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      rows.push(...readLegacyPage((await page.getTextContent()).items));
    }
    if (!rows.length) throw new Error('找不到可匯入的記帳紀錄。');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(rows)));
    const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return { rows, key };
  } finally {
    await pdf.destroy();
  }
}
