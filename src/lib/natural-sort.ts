// 文字列を「数字の連続」と「数字以外の連続」に分割する。
// 例: "a2-b10.png" -> ["a", "2", "-b", "10", ".png"]
const splitIntoRuns = (value: string): string[] => value.match(/\d+|\D+/g) ?? [];

// ファイル名を自然順(数字部分は数値として比較)で並べるための比較関数。
// Array.prototype.sortにそのまま渡せる。
export const compareNatural = (a: string, b: string): number => {
  const runsA = splitIntoRuns(a);
  const runsB = splitIntoRuns(b);
  const length = Math.max(runsA.length, runsB.length);

  for (let index = 0; index < length; index += 1) {
    const runA = runsA[index] ?? "";
    const runB = runsB[index] ?? "";

    if (runA === runB) {
      continue;
    }

    const isNumericA = /^\d+$/.test(runA);
    const isNumericB = /^\d+$/.test(runB);

    if (isNumericA && isNumericB) {
      const diff = Number(runA) - Number(runB);

      if (diff !== 0) {
        return diff;
      }

      // 数値としては等しいがゼロ埋めなどで桁数が異なる場合(例: "9"と"009")、
      // 桁数の少ない方を先にするタイブレークを行う。これがないと、入力順
      // (ZIPの格納順など)に依存した非決定的な並びになってしまう
      if (runA.length !== runB.length) {
        return runA.length - runB.length;
      }

      continue;
    }

    return runA < runB ? -1 : 1;
  }

  return 0;
};
