// Problem generation. Every problem is a four-choice quiz with one input
// step: the number (1-4) of the right choice. The step/cell shape is kept so
// the director (input, combo, dopa, review, growth records) works unchanged.
import { SKILL } from './skills.js';
import { BANK } from './quizbank.js';

export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MARKS = ['①', '②', '③', '④'];

// Build a quiz problem with the choices in a shuffled order.
export function buildQuiz([text, right, wrong], rng, title = 'クイズ') {
  const choices = [right, ...wrong];
  for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
  const k = choices.indexOf(right);
  const digit = String(k + 1);
  return {
    kind: 'quiz', title, text, choices, answer: right, digit,
    rows: 1, cols: 1, lines: [], bracket: null,
    cells: [{ id: 'ans', r: 0, c: 0, text: digit, kind: 'input' }],
    steps: [{ cell: 'ans', digit, label: 'こたえを えらぼう', after: [], help: null }],
    answerText: `${MARKS[k]} ${right}`,
  };
}

export const GEN = {
  quiz(rng, { bank }, title) {
    const list = BANK[bank];
    if (!list || !list.length) throw new Error(`empty bank ${bank}`);
    return buildQuiz(list[Math.floor(rng() * list.length)], rng, title);
  },
};

// Signature used to avoid repeats.
export const signature = (p) => `${p.title}|${p.text}`;

// Make one problem for a skill, avoiding signatures in `recent` when possible.
export function makeProblem(skillId, rng, recent = null) {
  const sk = SKILL[skillId];
  if (!sk) throw new Error(`unknown skill ${skillId}`);
  const [name, params] = sk.gen;
  let p;
  for (let tries = 0; tries < 40; tries++) {
    p = GEN[name](rng, params, sk.name);
    if (!recent || !recent.has(signature(p))) break;
  }
  p.skill = skillId;
  return p;
}
