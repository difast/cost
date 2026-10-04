// Формульные корректировки справочника: безопасный разбор и вычисление выражений
// без eval. Арифметика — decimal.js (детерминированно, без ошибок float).
//
// Грамматика: числа (дробная часть через точку), переменные, + − * / ^, скобки,
// функции min(a,b,…), max(a,b,…), abs(x).
// Результат выражения — КОЭФФИЦИЕНТ (множитель цены аналога). Корректировка = K − 1.
// Пример: площадь Ks = (So / Sa)^(-0.12).
//
// Переменные: суффикс o — объект оценки, a — аналог.
//   So/Sa — общая площадь, м²       Fo/Fa — этаж          Ho/Ha — этажность дома
//   Ro/Ra — количество комнат       Yo/Ya — год постройки  Mo/Ma — расстояние до метро, м
//   Lo/La — жилая площадь, Ko/Ka — площадь кухни (если заданы)

import { d, type Dec } from "../calc/decimal";

type Node =
  | { t: "num"; v: string }
  | { t: "var"; name: string }
  | { t: "neg"; x: Node }
  | { t: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Node; b: Node }
  | { t: "fn"; name: "min" | "max" | "abs"; args: Node[] };

export class FormulaError extends Error {}

const FUNCS = new Set(["min", "max", "abs"]);

function tokenize(src: string): string[] {
  const tokens: string[] = [];
  // дробная часть — только через точку: запятая разделяет аргументы функций
  const re = /\s*(\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[-+*/^(),−])\s*/y;
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) throw new FormulaError(`Недопустимый символ в формуле: «${src.slice(pos, pos + 10)}»`);
    tokens.push(m[1] === "−" ? "-" : m[1]);
    pos = re.lastIndex;
  }
  return tokens;
}

/** Разбор формулы в дерево. Ошибка синтаксиса — FormulaError. */
export function parseFormula(src: string): Node {
  if (!src || src.length > 500) throw new FormulaError("Формула пуста или слишком длинная");
  const tk = tokenize(src);
  let i = 0;
  const peek = () => tk[i];
  const eat = (t?: string) => {
    const x = tk[i];
    if (t !== undefined && x !== t) throw new FormulaError(`Ожидалось «${t}», получено «${x ?? "конец формулы"}»`);
    i++;
    return x;
  };
  // expr := term (('+'|'-') term)*
  const expr = (): Node => {
    let n = term();
    while (peek() === "+" || peek() === "-") {
      const op = eat() as "+" | "-";
      n = { t: "bin", op, a: n, b: term() };
    }
    return n;
  };
  // term := unary (('*'|'/') unary)*
  const term = (): Node => {
    let n = unary();
    while (peek() === "*" || peek() === "/") {
      const op = eat() as "*" | "/";
      n = { t: "bin", op, a: n, b: unary() };
    }
    return n;
  };
  // unary := '-' unary | power
  const unary = (): Node => (peek() === "-" ? (eat(), { t: "neg", x: unary() }) : power());
  // power := primary ('^' unary)?   (правоассоциативно, показатель может быть отрицательным)
  const power = (): Node => {
    const base = primary();
    if (peek() === "^") {
      eat();
      return { t: "bin", op: "^", a: base, b: unary() };
    }
    return base;
  };
  const primary = (): Node => {
    const x = peek();
    if (x === undefined) throw new FormulaError("Неожиданный конец формулы");
    if (x === "(") {
      eat();
      const n = expr();
      eat(")");
      return n;
    }
    if (/^\d/.test(x)) return eat(), { t: "num", v: x };
    if (/^[A-Za-z_]/.test(x)) {
      eat();
      if (peek() === "(") {
        if (!FUNCS.has(x)) throw new FormulaError(`Неизвестная функция: ${x}`);
        eat();
        const args: Node[] = [expr()];
        while (peek() === ",") eat(), args.push(expr());
        eat(")");
        if (x === "abs" && args.length !== 1) throw new FormulaError("abs принимает один аргумент");
        return { t: "fn", name: x as "min" | "max" | "abs", args };
      }
      return { t: "var", name: x };
    }
    throw new FormulaError(`Неожиданный символ «${x}»`);
  };
  const root = expr();
  if (i < tk.length) throw new FormulaError(`Лишние символы в формуле: «${tk.slice(i).join(" ")}»`);
  return root;
}

/** Имена переменных формулы. */
export function formulaVariables(n: Node, out = new Set<string>()): Set<string> {
  if (n.t === "var") out.add(n.name);
  else if (n.t === "neg") formulaVariables(n.x, out);
  else if (n.t === "bin") formulaVariables(n.a, out), formulaVariables(n.b, out);
  else if (n.t === "fn") n.args.forEach((a) => formulaVariables(a, out));
  return out;
}

/** Вычисление. Отсутствующая переменная → null (нет данных); деление на 0 и т. п. → FormulaError. */
export function evalFormula(n: Node, vars: Record<string, string | number | null | undefined>): Dec | null {
  const go = (x: Node): Dec | null => {
    switch (x.t) {
      case "num":
        return d(x.v);
      case "var": {
        const v = vars[x.name];
        if (v === null || v === undefined || v === "") return null;
        return d(String(v));
      }
      case "neg": {
        const v = go(x.x);
        return v === null ? null : v.neg();
      }
      case "fn": {
        const args = x.args.map(go);
        if (args.some((a) => a === null)) return null;
        const a = args as Dec[];
        if (x.name === "abs") return a[0].abs();
        return a.reduce((m, v) => (x.name === "min" ? (v.lt(m) ? v : m) : v.gt(m) ? v : m));
      }
      case "bin": {
        const a = go(x.a);
        const b = go(x.b);
        if (a === null || b === null) return null;
        switch (x.op) {
          case "+": return a.plus(b);
          case "-": return a.minus(b);
          case "*": return a.mul(b);
          case "/":
            if (b.isZero()) throw new FormulaError("Деление на ноль в формуле");
            return a.div(b);
          case "^": {
            if (a.isNeg() && !b.isInteger()) throw new FormulaError("Дробная степень отрицательного числа");
            if (a.isZero() && b.isNeg()) throw new FormulaError("Ноль в отрицательной степени");
            return a.pow(b);
          }
        }
      }
    }
  };
  const r = go(n);
  if (r !== null && !r.isFinite()) throw new FormulaError("Результат формулы не является конечным числом");
  return r;
}

/** Подстановка значений в формулу — для пояснения расчёта оценщику. */
export function explainFormula(src: string, vars: Record<string, string | number | null | undefined>): string {
  return src.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name) => (FUNCS.has(name) || vars[name] === undefined || vars[name] === null ? name : String(vars[name])));
}

/** Проверка формулы при сохранении в справочник: синтаксис и только известные переменные. */
export function validateFormula(src: string, allowed: readonly string[]): string | null {
  try {
    const n = parseFormula(src);
    const unknown = [...formulaVariables(n)].filter((v) => !allowed.includes(v));
    return unknown.length ? `Неизвестные переменные: ${unknown.join(", ")}` : null;
  } catch (e) {
    return e instanceof Error ? e.message : "Ошибка формулы";
  }
}
