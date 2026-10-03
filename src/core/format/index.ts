// Форматирование чисел и дат по русским правилам (детерминированно, без Intl-зависимостей от ОС).
import { d, round, type Num } from "../calc/decimal";

const NBSP = " ";

/** 1234567.891 → "1 234 567,89" (неразрывные пробелы между разрядами). */
export function fmtNumber(v: Num | null | undefined, dp = 2, trimZeros = false): string {
  if (v === null || v === undefined || v === "") return "—";
  const r = round(v, dp);
  const neg = r.isNeg() && !r.isZero();
  let [int, frac] = r.abs().toFixed(dp).split(".");
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  if (trimZeros && frac) {
    frac = frac.replace(/0+$/, "");
  }
  return (neg ? "−" : "") + int + (frac ? "," + frac : "");
}

export const fmtRub = (v: Num | null | undefined, dp = 0) =>
  v === null || v === undefined ? "—" : `${fmtNumber(v, dp)}${NBSP}₽`;

/** Доля → проценты: -0.05 → "−5,00 %"; signed — добавлять «+» к положительным. */
export function fmtPercent(v: Num | null | undefined, dp = 2, signed = false): string {
  if (v === null || v === undefined || v === "") return "—";
  const p = d(v).mul(100);
  const s = fmtNumber(p, dp);
  return (signed && p.gt(0) ? "+" : "") + s + NBSP + "%";
}

/** Коэффициент вида 0,9500 (1 + корр). */
export const fmtCoef = (v: Num, dp = 4) => fmtNumber(d(1).plus(d(v)), dp);

export function fmtDate(v: Date | string | null | undefined): string {
  if (!v) return "—";
  const dt = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(dt.getTime())) return "—";
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${dt.getUTCFullYear()}`;
}

/** ISO-дата YYYY-MM-DD (для input[type=date]). */
export function isoDate(v: Date | string | null | undefined): string {
  if (!v) return "";
  const dt = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

const ONES = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const ONES_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

function plural(n: number, forms: [string, string, string]) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

function triad(n: number, female: boolean): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  if (h) out.push(HUNDREDS[h]);
  if (t === 1) out.push(TEENS[o]);
  else {
    if (t) out.push(TENS[t]);
    if (o) out.push((female ? ONES_F : ONES)[o]);
  }
  return out;
}

/** Сумма прописью: 9789000 → "девять миллионов семьсот восемьдесят девять тысяч рублей 00 копеек". */
export function amountInWords(v: Num): string {
  const r = round(v, 2);
  const rub = Number(r.trunc().toFixed(0));
  const kop = Number(r.minus(r.trunc()).mul(100).toFixed(0));
  if (rub === 0) return `ноль рублей ${String(kop).padStart(2, "0")} ${plural(kop, ["копейка", "копейки", "копеек"])}`;
  const groups: Array<[number, [string, string, string] | null, boolean]> = [];
  let rest = rub;
  const units: Array<[[string, string, string] | null, boolean]> = [
    [null, false],
    [["тысяча", "тысячи", "тысяч"], true],
    [["миллион", "миллиона", "миллионов"], false],
    [["миллиард", "миллиарда", "миллиардов"], false],
  ];
  let i = 0;
  while (rest > 0 && i < units.length) {
    groups.push([rest % 1000, units[i][0], units[i][1]]);
    rest = Math.floor(rest / 1000);
    i++;
  }
  const words: string[] = [];
  for (let g = groups.length - 1; g >= 0; g--) {
    const [n, forms, female] = groups[g];
    if (!n) continue;
    words.push(...triad(n, female));
    if (forms) words.push(plural(n, forms));
  }
  return `${words.join(" ")} ${plural(rub, ["рубль", "рубля", "рублей"])} ${String(kop).padStart(2, "0")} ${plural(kop, ["копейка", "копейки", "копеек"])}`;
}
