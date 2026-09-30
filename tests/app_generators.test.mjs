// Every skill yields well-formed four-choice quiz problems.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, makeProblem, signature } from '../app/js/problems.js';
import { SKILLS } from '../app/js/skills.js';
import { BANK } from '../app/js/quizbank.js';

test('every skill has a bank of distinct, well-formed questions', () => {
  assert.deepEqual(Object.keys(BANK).sort(), SKILLS.map((s) => s.id).sort());
  for (const s of SKILLS) {
    const list = BANK[s.id];
    assert.ok(list.length >= 6, `${s.id}: ${list.length} questions`);
    assert.equal(new Set(list.map((q) => q[0])).size, list.length, `${s.id}: duplicate question`);
    for (const [text, right, wrong] of list) {
      assert.ok(text && right, `${s.id}: empty entry`);
      assert.equal(wrong.length, 3, `${s.id}: ${text}`);
      assert.equal(new Set([right, ...wrong]).size, 4, `${s.id}: duplicate choice in ${text}`);
    }
  }
});

test('problems keep the right answer behind the input digit, in any order', () => {
  const rng = makeRng(7);
  for (const s of SKILLS) {
    const slots = new Set();
    for (let i = 0; i < 60; i++) {
      const p = makeProblem(s.id, rng);
      assert.equal(p.kind, 'quiz');
      assert.equal(p.skill, s.id);
      assert.equal(p.steps.length, 1);
      const st = p.steps[0];
      assert.match(st.digit, /^[1-4]$/);
      assert.equal(p.choices[Number(st.digit) - 1], p.answer);
      assert.ok(p.cells.some((c) => c.id === st.cell && c.kind === 'input'));
      assert.ok(signature(p).includes(p.text));
      slots.add(st.digit);
    }
    assert.ok(slots.size >= 3, `${s.id}: answer always in ${[...slots]}`);
  }
});

test('recent signatures are avoided while fresh questions remain', () => {
  const rng = makeRng(3);
  const recent = new Set();
  const id = SKILLS[0].id;
  for (let i = 0; i < BANK[id].length; i++) { const p = makeProblem(id, rng, recent); assert.ok(!recent.has(signature(p))); recent.add(signature(p)); }
});
