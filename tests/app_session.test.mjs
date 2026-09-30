// Session planning and mastery (id021, id022, id023).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../app/js/problems.js';
import { SKILL, SKILLS, MASTERY } from '../app/js/skills.js';
import { ORDER, PLACEMENT, emptyProgress, recordResult, isUnlocked, isMastered, stateOf, gradePlan, levelPlan, placementPlan, frontier, problemFor, masterWithAncestors, dependents, relockTargets, relockSkill, TREE_LAYOUT, TREE_SUB, TREE_UPPER, TIMES_MAX, FIRST_MAX } from '../app/js/session.js';

test('orders respect prerequisites', () => {
  for (const order of [ORDER, PLACEMENT]) {
  const seen = new Set();
  for (const id of order) { for (const r of SKILL[id].req) assert.ok(seen.has(r), `${id} before ${r}`); seen.add(id); }
  }
});

test('mastery needs 5 of the last 6 first-try clears and unlocks children', () => {
  const prog = emptyProgress();
  assert.equal(stateOf(prog, 'rice'), 'locked');
  let res;
  for (let i = 0; i < MASTERY.window; i++) res = recordResult(prog, 'crop-basic', i !== 2);
  assert.ok(isMastered(prog, 'crop-basic'));
  assert.ok(res.unlocked.includes('rice'));
  for (let i = 0; i < MASTERY.window; i++) recordResult(prog, 'rice', true);
  assert.ok(!isUnlocked(prog, 'veg')); // also needs fert3
  for (let i = 0; i < 6; i++) recordResult(prog, 'soil-basic', i % 3 !== 0);
  assert.ok(!isMastered(prog, 'soil-basic')); // only 4 of 6
});

test('grade plans stay inside the grade for basic problems', () => {
  const rng = makeRng(4);
  for (let g = 1; g <= 6; g++) {
    const plan = gradePlan(g, 10, rng);
    for (const id of plan.basic) assert.equal(SKILL[id].grade, g);
    for (let k = 0; k < 12; k++) assert.ok(SKILL[plan.extra(k)]);
  }
});

test('placement walks forward on clean answers and grants ancestors', () => {
  const prog = emptyProgress();
  const plan = placementPlan(prog, 10);
  const asked = [];
  for (let i = 0; i < 8; i++) { const id = plan.pick(); asked.push(id); plan.answer(true); }
  const mastered = SKILLS.filter((x) => isMastered(prog, x.id)).length;
  assert.ok(mastered >= 10, `mastered ${mastered} after 8 clean answers (at ${asked[7]})`);
  for (const r of SKILL[asked[6]].req) assert.ok(isMastered(prog, r));
  // A slip eases back.
  const p0 = plan.walk.p;
  plan.answer(false);
  assert.ok(plan.walk.p <= p0);
});

test('level plan mixes review and frontier, problems avoid recent repeats', () => {
  const prog = emptyProgress();
  prog.placed = true;
  for (let i = 0; i < 6; i++) recordResult(prog, 'crop-basic', true);
  for (let i = 0; i < 6; i++) recordResult(prog, 'soil-basic', true);
  const plan = levelPlan(prog, 10, makeRng(1));
  assert.ok(plan.basic.some((id) => isMastered(prog, id)));
  assert.ok(plan.basic.some((id) => frontier(prog).includes(id)));
  const rng = makeRng(2);
  const sigs = [];
  for (let i = 0; i < 6; i++) { const p = problemFor(prog, 'fert3', rng); sigs.push(`${p.text}`); recordResult(prog, 'fert3', true, `${p.title}|${p.text}`); }
  assert.equal(new Set(sigs).size, sigs.length);
  assert.ok(SKILLS.length === ORDER.length);
});

test('relocking a skill erases it and everything built on it (id031)', () => {
  const prog = emptyProgress();
  masterWithAncestors(prog, 'hort');
  recordResult(prog, 'breed', true);
  recordResult(prog, 'ph', true); // a sibling branch stays
  const deps = dependents('rice');
  assert.deepEqual(deps, ['veg', 'hort', 'breed', 'physio']);
  assert.ok(!deps.includes('rice') && !deps.includes('crop-basic'));
  assert.deepEqual(relockTargets(prog, 'rice'), ['rice', 'veg', 'hort', 'breed']);
  const gone = relockSkill(prog, 'rice');
  assert.equal(gone.length, 4);
  assert.equal(stateOf(prog, 'rice'), 'new'); // its own prerequisite is still mastered
  for (const id of ['veg', 'hort', 'breed']) assert.equal(stateOf(prog, id), 'locked');
  assert.ok(isMastered(prog, 'fert3') && isMastered(prog, 'soil-basic'));
  assert.equal(stateOf(prog, 'ph'), 'learning');
  assert.ok(isMastered(prog, 'crop-basic')); // ancestors are untouched
  assert.deepEqual(relockSkill(prog, 'rice'), []); // nothing left to erase
});

test('tree layout: two columns per lane, one node per cell, below every prerequisite (id047)', () => {
  const { row, col, rows, cols } = TREE_LAYOUT;
  assert.equal(cols, 8);
  const cells = new Set();
  for (const s of SKILLS) {
    assert.equal(Math.floor(col[s.id] / TREE_SUB), s.lane, s.id);
    const k = `${col[s.id]}:${row[s.id]}`;
    assert.ok(!cells.has(k), `two nodes at ${k}`); cells.add(k);
    for (const q of s.req) assert.ok(row[q] < row[s.id], `${q} above ${s.id}`);
    assert.ok(row[s.id] < rows);
  }
});

test('tree layout: grades 5-6 sit below every grade 1-4 skill, with a blank row between (id049)', () => {
  const { row } = TREE_LAYOUT;
  const lowMax = Math.max(...SKILLS.filter((s) => s.grade < TREE_UPPER).map((s) => row[s.id]));
  const upMin = Math.min(...SKILLS.filter((s) => s.grade >= TREE_UPPER).map((s) => row[s.id]));
  assert.ok(upMin >= lowMax + 2, `grade 5 starts at ${upMin}, grade 4 ends at ${lowMax}`);
});

test('timed answers keep recent times, one aggregate per day and the first problems (id033)', () => {
  const prog = emptyProgress();
  const rng = makeRng(8);
  const day = (i) => `2026-09-${String(1 + Math.floor(i / 10)).padStart(2, '0')}`;
  for (let i = 0; i < 40; i++) {
    const p = problemFor(prog, 'rice', rng);
    recordResult(prog, 'rice', i % 4 !== 0, null, { at: 1e12 + i, day: day(i), ms: 2000 + i * 10, cells: p.steps.length, misses: i % 4 === 0 ? 1 : 0, problem: p });
  }
  const r = prog.skills['rice'];
  assert.equal(r.times.length, TIMES_MAX);
  assert.equal(r.times.at(-1).t, 2390);
  assert.deepEqual(r.days.map((g) => g.n), [10, 10, 10, 10]);
  assert.equal(r.days[0].f, 7);
  assert.equal(r.first.length, FIRST_MAX);
  assert.equal(r.first[0].t, 2000);
  assert.ok(r.first[0].p.steps.length > 0);
  assert.equal(r.lastOk, 1e12 + 39);
  assert.ok(r.masteredAt >= 1e12);
  // Untimed results (demo, checks) keep the old bookkeeping only.
  recordResult(prog, 'crop-basic', true);
  assert.equal(prog.skills['crop-basic'].times, undefined);
  // Placement grants carry a date for later use (rust, stars).
  masterWithAncestors(prog, 'fert3', 5);
  assert.equal(prog.skills['soil-basic'].grantedAt, 5);
});

test('stars: 1 at mastery, then accuracy, speed, retention and mastery of speed; never down (id037)', async () => {
  const { starsOf, nextStar, baseMs, STAR_RULE } = await import('../app/js/session.js');
  const prog = emptyProgress();
  const id = 'rice'; // grade 2, one answer cell
  const fast = baseMs(2, 1) * 0.5; const ok = baseMs(2, 1) * 0.9; const slow = baseMs(2, 1) * 1.5;
  let day = 1;
  const dayKey = () => `2026-10-${String(day).padStart(2, '0')}`;
  const answer = (firstTry, ms) => recordResult(prog, id, firstTry, null, { day: dayKey(), ms, cells: 1, misses: firstTry ? 0 : 1 });
  for (let i = 0; i < 6; i++) answer(true, slow);
  assert.equal(starsOf(prog, id), 1);
  assert.equal(nextStar(prog, id).n, 2);
  // 20 answers at 90%+: star 2 (slow answers keep star 3 away).
  let up = 0;
  for (let i = 0; i < 14; i++) up = answer(i !== 3, slow).stars || up;
  assert.equal(starsOf(prog, id), 2);
  assert.equal(up, 2);
  // Ten answers inside the combo window: star 3.
  for (let i = 0; i < 10; i++) answer(true, ok);
  assert.equal(starsOf(prog, id), 3);
  assert.equal(prog.skills[id].starDay[3], '2026-10-01');
  // Star 4 needs a gap of a week, then three clean answers.
  for (let i = 0; i < 3; i++) answer(true, ok);
  assert.equal(starsOf(prog, id), 3);
  assert.match(nextStar(prog, id, '2026-10-03').now, /あと 5日/);
  day = 9;
  for (let i = 0; i < 3; i++) answer(true, ok);
  assert.equal(starsOf(prog, id), 4);
  // Star 5: 20 answers, 95% first try, median within 60% of the window.
  for (let i = 0; i < 20; i++) answer(true, fast);
  assert.equal(starsOf(prog, id), 5);
  assert.equal(nextStar(prog, id), null);
  // Mistakes and slow answers never take stars away.
  for (let i = 0; i < 10; i++) answer(false, slow);
  assert.equal(starsOf(prog, id), 5);
  // Placement grants start at one star; relocking clears them.
  masterWithAncestors(prog, 'fert3');
  assert.equal(starsOf(prog, 'soil-basic'), 1);
  relockSkill(prog, id);
  assert.equal(starsOf(prog, id), 0);
  assert.ok(STAR_RULE.acc < STAR_RULE.top);
});

test('time capsule: a first problem returns after 30 days, once, for mastered skills (id039)', async () => {
  const { pickCapsule, useCapsule, CAPSULE } = await import('../app/js/session.js');
  const { capsuleCompare } = await import('../app/js/growth.js');
  const prog = emptyProgress();
  const rng = makeRng(3);
  const day0 = Date.UTC(2026, 7, 1);
  for (let i = 0; i < 6; i++) {
    const p = problemFor(prog, 'crop-basic', rng);
    recordResult(prog, 'crop-basic', true, null, { at: day0 + i * 1000, day: '2026-08-01', ms: 9000, cells: 1, misses: 0, problem: p });
  }
  assert.equal(pickCapsule(prog, day0 + 10 * 864e5), null); // too early
  const c = pickCapsule(prog, day0 + CAPSULE.days * 864e5 + 5000);
  assert.deepEqual([c.skill, c.index], ['crop-basic', 0]);
  assert.ok(c.entry.p.steps.length > 0);
  useCapsule(prog, c.skill, c.index);
  assert.equal(pickCapsule(prog, day0 + 40 * 864e5).index, 1); // the next one, another day
  // Not mastered: nothing.
  const p2 = emptyProgress();
  recordResult(p2, 'crop-basic', true, null, { at: day0, day: '2026-08-01', ms: 9000, cells: 1, problem: problemFor(p2, 'crop-basic', rng) });
  assert.equal(pickCapsule(p2, day0 + 90 * 864e5), null);
  // Comparison: time, else slips, else nothing.
  assert.equal(capsuleCompare({ t: 9000, m: 2 }, 3000, 2).what, 'time');
  assert.deepEqual(capsuleCompare({ t: 3000, m: 2 }, 4000, 0), { what: 'miss', from: 2, to: 0 });
  assert.equal(capsuleCompare({ t: 3000, m: 0 }, 4000, 0).what, 'none');
});

test('rust: one level, at most three oldest, polished by one first-try answer, review slots first (id040)', async () => {
  const { rustyOf, RUST } = await import('../app/js/session.js');
  const prog = emptyProgress();
  const now = Date.UTC(2026, 9, 1);
  const ago = (d) => now - d * 864e5;
  const ids = ['soil-basic', 'crop-basic', 'pest-basic', 'fert3', 'livestock'];
  ids.forEach((id, i) => { prog.skills[id] = { n: 6, hist: [1, 1, 1, 1, 1, 1], mastered: true, recent: [], stars: 3, lastOk: ago([40, 30, 25, 22, 5][i]) }; });
  assert.deepEqual(rustyOf(prog, now), ['soil-basic', 'crop-basic', 'pest-basic']); // oldest three of four
  assert.equal(RUST.max, 3);
  const res = recordResult(prog, 'soil-basic', true, null, { at: now, day: '2026-10-01', ms: 3000, cells: 1 });
  assert.ok(res.polished);
  assert.deepEqual(rustyOf(prog, now), ['crop-basic', 'pest-basic', 'fert3']);
  assert.equal(prog.skills['soil-basic'].stars, 3); // stars stay
  assert.ok(!recordResult(prog, 'crop-basic', false, null, { at: now }).polished); // a slip does not polish
  assert.ok(rustyOf(prog, now).includes('crop-basic'));
  // Placement grants age from the grant.
  const p2 = emptyProgress();
  masterWithAncestors(p2, 'veg', ago(30));
  assert.equal(rustyOf(p2, now).length, 3);
  // Level plan: rusty skills take the review slots.
  prog.placed = true;
  const plan = levelPlan(prog, 10, makeRng(2), now);
  assert.ok(rustyOf(prog, now).every((id) => plan.basic.slice(0, 3).includes(id)), plan.basic.join());
});
