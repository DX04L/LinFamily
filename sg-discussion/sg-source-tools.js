(function () {
  const books = Object.fromEntries(
    '創創世記 出出埃及記 利利未記 民民數記 申申命記 書約書亞記 士士師記 得路得記 撒上撒母耳記上 撒下撒母耳記下 王上列王紀上 王下列王紀下 代上歷代志上 代下歷代志下 拉以斯拉記 尼尼希米記 斯以斯帖記 伯約伯記 詩詩篇 箴箴言 傳傳道書 歌雅歌 賽以賽亞書 耶耶利米書 哀耶利米哀歌 結以西結書 但但以理書 何何西阿書 珥約珥書 摩阿摩司書 俄俄巴底亞書 拿約拿書 彌彌迦書 鴻那鴻書 哈哈巴谷書 番西番雅書 該哈該書 亞撒迦利亞書 瑪瑪拉基書 太馬太福音 可馬可福音 路路加福音 約約翰福音 徒使徒行傳 羅羅馬書 林前哥林多前書 林後哥林多後書 加加拉太書 弗以弗所書 腓腓立比書 西歌羅西書 帖前帖撒羅尼迦前書 帖後帖撒羅尼迦後書 提前提摩太前書 提後提摩太後書 多提多書 門腓利門書 來希伯來書 雅雅各書 彼前彼得前書 彼後彼得後書 約壹約翰一書 約貳約翰二書 約參約翰三書 猶猶大書 啟啟示錄'
      .split(' ').flatMap(pair => {
        const length = /^[撒王代林帖提彼][上下前後]|^約[壹貳參]/.test(pair) ? 2 : 1;
        const short = pair.slice(0, length);
        return [[short, short], [pair.slice(length), short]];
      })
  );
  const bookNames = Object.keys(books).sort((a, b) => b.length - a.length).join('|');
  const explicit = new RegExp(
    `(?<book>${bookNames})\\s*(?<chapter>\\d{1,3})\\s*[:：章]\\s*(?<verse>\\d{1,3})(?:\\s*[-–—~～至到]\\s*(?:(?<endChapter>\\d{1,3})[:：])?(?<end>\\d{1,3}))?節?`, 'gu'
  );
  const relative = /(?:\bvv?\.\s*|第)(?<verse>\d{1,3})(?:\s*[-–—~～至到]\s*(?<end>\d{1,3}))?節?|(?<plain>\d{1,3})節/gu;
  const notes = {
    '對呼召的信心': '信心是信靠神並回應祂的呼召。亞伯拉罕因信順服，踏出他當時尚未明白去向的一步。',
    '對應許的信心': '信心倚靠作出應許的神。信靠神的信實，也包括按祂所說的內容和時間來領受應許。',
    '超越死亡的信心': '希伯來書指出，亞伯拉罕相信神有使人復活的能力，因此即使面對死亡，仍相信神能成就應許。',
    '試驗': '聖經中的試驗可以顯明信心。神不引誘人犯罪。遇見試探時，信徒可以倚靠神，尋求祂所賜的出路。',
    '獨生的兒子': '以撒是神應許所指向的兒子。「獨生」在本段凸顯他在應許中的獨特地位。',
    '神的揀選': '在當段經文中，神的揀選出於祂的愛與信實。經文引導人以感恩和順服回應祂。',
    '守約施慈愛': '神按自己的應許信實待祂的子民。經文將祂的慈愛和祂守約的信實連在一起。',
    '蒙神悅納': '保羅以馨香的祭物形容教會的奉獻，指出這份出於信心和愛心的給予為神所喜悅。',
    '屬靈的祝福': '聖經中的祝福包含與神的關係及祂所賜的恩典。信徒以信靠和順服回應。',
  };

  function references(text, mainReference) {
    const ranges = [...text.matchAll(explicit)].map(match => {
      const {book, chapter, verse, endChapter, end} = match.groups;
      return {start: match.index, end: match.index + match[0].length, book: books[book],
        chapter: Number(chapter), verse: Number(verse), endChapter: Number(endChapter || chapter),
        lastVerse: Number(end || verse)};
    });
    const main = mainReference && references(mainReference)[0];
    if (main) for (const match of text.matchAll(relative)) {
      const start = match.index, end = start + match[0].length;
      if (ranges.some(ref => ref.start < end && ref.end > start)) continue;
      const verse = Number(match.groups.verse || match.groups.plain);
      ranges.push({...main, start, end, verse, endChapter: main.chapter, lastVerse: Number(match.groups.end || verse)});
    }
    return ranges;
  }

  function decorate(root, mainReference, blanks = []) {
    const text = root.textContent;
    const spans = [...blanks.map(span => ({...span, blank: true})), ...references(text, mainReference)];
    for (const [word, note] of Object.entries(notes)) {
      const start = text.indexOf(word);
      if (start !== -1) spans.push({start, end: start + word.length, note});
    }
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const span of spans.sort((a, b) => a.start - b.start || b.end - a.end)) {
      if (span.start < offset || span.end > text.length) continue;
      fragment.append(text.slice(offset, span.start));
      const value = text.slice(span.start, span.end);
      const control = document.createElement('span');
      control.setAttribute('role', 'button');
      control.tabIndex = 0;
      if (span.blank) {
        control.className = 'blank-slot';
        const hint = document.createElement('span');
        hint.className = 'placeholder-text';
        hint.setAttribute('aria-hidden', 'true');
        control.setAttribute('aria-label', '點擊看解答');
        const answer = document.createElement('span');
        answer.className = 'answer-text';
        answer.textContent = value;
        control.append(hint, answer);
      } else {
        control.className = 'pop-trigger';
        control.textContent = value;
        if (span.note) control.dataset.studyNote = span.note;
        else control.dataset.studyVerse = JSON.stringify(span);
      }
      fragment.append(control);
      offset = span.end;
    }
    if (offset) {
      fragment.append(text.slice(offset));
      root.replaceChildren(fragment);
    }
  }

  const chapters = new Map();
  async function getVerses(ref) {
    if (ref.endChapter < ref.chapter || ref.endChapter - ref.chapter > 20) throw new Error('無法辨識經文範圍');
    const records = [];
    for (let chapter = ref.chapter; chapter <= ref.endChapter; chapter++) {
      const key = `${ref.book}:${chapter}`;
      if (!chapters.has(key)) {
        const query = new URLSearchParams({chineses: ref.book, chap: chapter, version: 'unv', gb: 0});
        chapters.set(key, fetch('https://bible.fhl.net/json/qb.php?' + query)
          .then(async response => {
            if (!response.ok) throw new Error('和合本載入失敗');
            const {record} = await response.json();
            if (!record?.length || record.some(part => part.chineses !== ref.book || part.chap !== chapter)) throw new Error('未找到經文');
            return record;
          }).catch(error => { chapters.delete(key); throw error; }));
      }
      records.push(...await chapters.get(key));
    }
    const selected = records.filter(part => (part.chap > ref.chapter || part.sec >= ref.verse) &&
      (part.chap < ref.endChapter || part.sec <= ref.lastVerse));
    if (!selected.length || selected[0].sec !== ref.verse || selected.at(-1).sec !== ref.lastVerse) throw new Error('未找到完整經文');
    return selected.map(part => `${part.chap}:${part.sec} ${part.bible_text.trim()}`).join('\n');
  }

  window.SGSourceTools = {decorate, getVerses, references};
})();
