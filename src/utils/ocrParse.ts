import type { Currency, PaymentMethod, TxKind, TxType } from '../types';

export interface ParsedDraft {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
  type: TxType;
  kind: TxKind;
  categoryId: string;
  bucket: 'basic' | 'special';
  note: string;
  paymentMethod: PaymentMethod;
  rawLine: string;
  confidence: 'high' | 'medium' | 'low';
  selected: boolean;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Normalize various date forms to YYYY-MM-DD; year defaults to current or inferred */
export function normalizeDate(raw: string, fallbackYear: number): string | null {
  const s = raw.trim().replace(/[年/.]/g, '-').replace(/月/g, '-').replace(/日/g, '');
  // 2026-09-15 or 2026/9/15
  let m = s.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
  // 09-15 / 9-15 / 09.15 / 9.15
  m = s.match(/^(\d{1,2})[.-](\d{1,2})$/);
  if (m) {
    const month = +m[1];
    const day = +m[2];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${fallbackYear}-${pad2(month)}-${pad2(day)}`;
    }
  }
  // 0915 compact
  m = s.match(/^(\d{2})(\d{2})$/);
  if (m) {
    const month = +m[1];
    const day = +m[2];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${fallbackYear}-${pad2(month)}-${pad2(day)}`;
    }
  }
  return null;
}

function guessCategory(text: string, isTopup: boolean): { categoryId: string; bucket: 'basic' | 'special' } {
  if (isTopup) return { categoryId: 'octopus_topup', bucket: 'basic' };
  if (/洗衣|laundry|5\s*\+\s*3|洗熨/i.test(text)) return { categoryId: 'laundry', bucket: 'basic' };
  if (/空调|冷气|\bac\b/i.test(text)) return { categoryId: 'ac', bucket: 'basic' };
  if (/列车|巴士|地铁|交通|bus|mtr|ferry|tram|专线/i.test(text)) return { categoryId: 'transport', bucket: 'basic' };
  if (/咖啡|奶茶|茶饮|星巴克|coffee/i.test(text)) return { categoryId: 'coffee', bucket: 'basic' };
  if (/饭|餐|食|吃|食堂|餐厅|美食|超市买菜|买菜/i.test(text)) return { categoryId: 'food', bucket: 'basic' };
  if (/会员|spotify|netflix|youtube|apple\s*music/i.test(text)) return { categoryId: 'membership', bucket: 'special' };
  if (/模型|手办|hobby|爱好/i.test(text)) return { categoryId: 'hobbies', bucket: 'special' };
  return { categoryId: 'transport', bucket: 'basic' };
}

let draftSeq = 0;
function nextId() {
  draftSeq += 1;
  return `draft-${Date.now()}-${draftSeq}`;
}

/**
 * Parse OCR text into draft transactions.
 * source: 'octopus' forces HKD + octopus payment; 'general' tries to detect.
 */
export function parseOcrText(
  text: string,
  opts: {
    source: 'octopus' | 'general';
    defaultDate: string;
    fallbackYear: number;
  },
): ParsedDraft[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 2);

  const drafts: ParsedDraft[] = [];
  const seen = new Set<string>();
  let lastDate = opts.defaultDate;
  const isOctopusSource =
    opts.source === 'octopus' || /八达通|octopus|餘額|余额|增值|车票|列車|列车/i.test(text);

  // Amount patterns: -12.50, 12.5, HK$12.50, ¥12, +20, （扣）12.5
  const amountRe =
    /(?:HK\$|HKD|￥|¥|\$)?\s*([+-]?)(\d{1,5}(?:\.\d{1,2})?)\s*(?:元|港幣|港币)?/gi;
  const dateTokenRe =
    /(?:20\d{2}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}|\d{1,2}\s*月\s*\d{1,2}\s*日)/g;

  for (const line of lines) {
    // Skip obvious noise
    if (/^(余额|餘額|balance|交易記錄|交易记录|日期|金額|金额)/i.test(line) && !/\d/.test(line)) {
      continue;
    }

    const dates = line.match(dateTokenRe);
    if (dates) {
      for (const d of dates) {
        const norm = normalizeDate(
          d.replace(/\s*月\s*/g, '.').replace(/\s*日\s*/g, ''),
          opts.fallbackYear,
        );
        if (norm) lastDate = norm;
      }
    }

    // Find amounts on line
    const amounts: { sign: string; value: number; index: number }[] = [];
    amountRe.lastIndex = 0;
    let am: RegExpExecArray | null;
    while ((am = amountRe.exec(line)) !== null) {
      const value = parseFloat(am[2]);
      if (Number.isNaN(value) || value <= 0 || value > 99999) continue;
      // Skip years mistaken as amounts
      if (value >= 2000 && value <= 2099 && !am[0].includes('.') && !am[1]) continue;
      amounts.push({ sign: am[1] || '', value, index: am.index });
    }
    if (amounts.length === 0) continue;

    // Prefer the last amount on the line (common in ledgers)
    const pick = amounts[amounts.length - 1];
    const isTopup = /充值|增值|top\s*-?\s*up|加值/i.test(line);
    const isIncome =
      pick.sign === '+' ||
      /^(收入|\+|返现|AA|退款|退回)/i.test(line) ||
      (/收入|返现|退款/.test(line) && !isTopup);

    let currency: Currency = isOctopusSource ? 'HKD' : 'RMB';
    if (/HK\$|HKD|港幣|港币/i.test(line) || isOctopusSource) currency = 'HKD';
    else if (/\$|USD|美元/.test(line) && !/HK/i.test(line)) currency = 'USD';
    else if (/￥|¥|RMB|元/.test(line)) currency = 'RMB';

    const { categoryId, bucket } = guessCategory(line, isTopup);
    const note = line
      .replace(dateTokenRe, '')
      .replace(amountRe, '')
      .replace(/[|｜]/g, ' ')
      .trim()
      .slice(0, 80);

    const key = `${lastDate}|${pick.value}|${isTopup}|${note.slice(0, 20)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    drafts.push({
      id: nextId(),
      date: lastDate,
      amount: pick.value,
      currency,
      type: isIncome && !isTopup ? 'income' : 'expense',
      kind: isTopup ? 'topup' : 'normal',
      categoryId: isIncome && !isTopup ? 'income_other' : categoryId,
      bucket: isIncome && !isTopup ? 'basic' : bucket,
      note: note || (isTopup ? '八达通充值' : isOctopusSource ? '八达通' : '截图识别'),
      paymentMethod: isOctopusSource || isTopup ? 'octopus' : 'other',
      rawLine: line,
      confidence: dates || /八达通|列车|消費|消费|增值/.test(line) ? 'high' : 'medium',
      selected: true,
    });
  }

  // If nothing parsed, try looser: any number looking like money paired with nearby date in whole text
  if (drafts.length === 0) {
    const loose = text.match(
      /(\d{1,2}[./-]\d{1,2}).{0,20}?(?:HK\$|¥)?\s*(\d+\.\d{1,2}|\d{1,4})/gi,
    );
    if (loose) {
      for (const chunk of loose) {
        const dm = chunk.match(/(\d{1,2}[./-]\d{1,2}).*?(\d+\.\d{1,2}|\d{1,4})/);
        if (!dm) continue;
        const d = normalizeDate(dm[1], opts.fallbackYear) ?? opts.defaultDate;
        const value = parseFloat(dm[2]);
        if (value <= 0) continue;
        drafts.push({
          id: nextId(),
          date: d,
          amount: value,
          currency: isOctopusSource ? 'HKD' : 'RMB',
          type: 'expense',
          kind: /充值|增值/.test(chunk) ? 'topup' : 'normal',
          categoryId: /充值|增值/.test(chunk) ? 'octopus_topup' : 'transport',
          bucket: 'basic',
          note: '宽松识别',
          paymentMethod: isOctopusSource ? 'octopus' : 'other',
          rawLine: chunk,
          confidence: 'low',
          selected: true,
        });
      }
    }
  }

  return drafts;
}
