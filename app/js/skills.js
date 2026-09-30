// Skill tree for the agriculture quiz: 4 fields (lanes) x levels 1-6 (grade).
// Each skill: id, name (shown on screen), grade (level), lane (tree column),
// req (all must be mastered to unlock), gen (generator + params, problems.js).
// Questions live in quizbank.js under the same id.

export const LANES = ['作物・野菜', '土・肥料', '病害虫・環境', '畜産・食品'];

// Mastery / unlock rule (provisional): 5 first-try clears in the last 6 attempts.
export const MASTERY = { window: 6, need: 5 };

const q = (id, name, grade, lane, req) => ({ id, name, grade, lane, req, gen: ['quiz', { bank: id }] });

export const SKILLS = [
  // ---------------------------------------------------------------- level 1
  q('crop-basic', '植物のしくみ', 1, 0, []),
  q('soil-basic', '土のきほん', 1, 1, []),
  q('pest-basic', '害虫と益虫', 1, 2, []),
  q('livestock', '家畜のきほん', 1, 3, []),

  // ---------------------------------------------------------------- level 2
  q('rice', 'イネと稲作', 2, 0, ['crop-basic']),
  q('fert3', '肥料の三要素', 2, 1, ['soil-basic']),
  q('disease', '作物の病気', 2, 2, ['pest-basic']),
  q('cattle', '牛と酪農', 2, 3, ['livestock']),

  // ---------------------------------------------------------------- level 3
  q('veg', '野菜の栽培', 3, 0, ['rice', 'fert3']),
  q('ph', '土の酸性とpH', 3, 1, ['fert3']),
  q('control', '防除のしかた', 3, 2, ['disease']),
  q('poultry-pig', '鶏と豚', 3, 3, ['cattle']),

  // ---------------------------------------------------------------- level 4
  q('hort', '草花と果樹', 4, 0, ['veg']),
  q('fert-kinds', '肥料の種類', 4, 1, ['ph']),
  q('pesticide', '農薬と安全', 4, 2, ['control']),
  q('food-comp', '食品の成分', 4, 3, ['poultry-pig']),

  // ---------------------------------------------------------------- level 5
  q('breed', '育種と繁殖', 5, 0, ['hort']),
  q('micro', '要素の欠乏症', 5, 1, ['fert-kinds']),
  q('env', '農業と環境', 5, 2, ['pesticide', 'fert-kinds']),
  q('food-proc', '食品の加工', 5, 3, ['food-comp']),

  // ---------------------------------------------------------------- level 6
  q('physio', '作物の生理', 6, 0, ['breed']),
  q('soil-sci', '土の化学', 6, 1, ['micro']),
  q('future', 'これからの農業', 6, 2, ['env']),
  q('food-safety', '食品の安全', 6, 3, ['food-proc']),
];

export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

// Depth in the tree = longest prerequisite chain (roots are 0).
export const DEPTH = (() => {
  const memo = {};
  const d = (id) => memo[id] ?? (memo[id] = SKILL[id].req.length ? 1 + Math.max(...SKILL[id].req.map(d)) : 0);
  for (const s of SKILLS) d(s.id);
  return memo;
})();

export const skillsOfGrade = (g) => SKILLS.filter((s) => s.grade === g);
