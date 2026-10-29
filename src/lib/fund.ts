export type Sleeve = "cash" | "bond" | "equity";

export type Weights = { cash: number; bond: number; equity: number };

export type MarketMonth = Record<Sleeve, number>;

export type ScenarioId = "calm" | "falling" | "shock";

export type Goal = { name: string; target: number; months: number; monthly: number };

export const RAILS = { maxEquity: 0.7 };

export const SCENARIOS: { id: ScenarioId; label: string; heldout: boolean; hint: string }[] = [
  { id: "calm", label: "Rising", heldout: false, hint: "The only market the suggestion may study." },
  { id: "falling", label: "Falling", heldout: true, hint: "A drop the suggestion was not shown." },
  { id: "shock", label: "Rate shock", heldout: true, hint: "Bonds and stocks fall together. The suggestion was not shown this." },
];

export function market(id: ScenarioId, months: number): MarketMonth[] {
  const rows: MarketMonth[] = [];
  for (let month = 0; month < months; month += 1) {
    if (id === "calm") rows.push({ cash: 0.003, bond: 0.005, equity: 0.018 });
    else if (id === "falling") {
      const drop = month >= 5 && month <= 11;
      rows.push({ cash: 0.003, bond: drop ? 0.012 : 0.005, equity: drop ? -0.06 : month < 5 ? 0.03 : 0.028 });
    } else {
      const spike = month >= 2 && month <= 8;
      rows.push({ cash: 0.003, bond: spike ? -0.01 : 0.006, equity: spike ? -0.035 : 0.02 });
    }
  }
  return rows;
}

export function humanWeights(): Weights {
  return { cash: 0.5, bond: 0, equity: 0.5 };
}

export function greedyWeights(): Weights {
  return { cash: 0, bond: 0, equity: 1 };
}

export type PolicyVersion = 0 | 1 | 2 | 3 | 4;

export type MixRule = { up: Weights; down: Weights };

export function ruleFor(version: PolicyVersion): MixRule {
  if (version === 1 || version === 3) return { up: greedyWeights(), down: greedyWeights() };
  if (version === 2) return { up: { cash: 0.15, bond: 0.2, equity: 0.65 }, down: { cash: 0.3, bond: 0.4, equity: 0.3 } };
  if (version === 4) return { up: { cash: 0.1, bond: 0.25, equity: 0.65 }, down: { cash: 0.55, bond: 0.25, equity: 0.2 } };
  return { up: humanWeights(), down: humanWeights() };
}

export function applyRule(rule: MixRule, history: number[]): Weights {
  const trail = history.slice(-3);
  const down = trail.length === 3 && trail.reduce((sum, value) => sum + value, 0) < 0;
  return down ? rule.down : rule.up;
}

export function ruleBreach(rule: MixRule): string | null {
  return railBreach(rule.up) || railBreach(rule.down);
}

export function improvedWeights(equityHistory: number[]): Weights {
  const trail = equityHistory.slice(-3);
  const down = trail.length === 3 && trail.reduce((sum, value) => sum + value, 0) < 0;
  return down ? { cash: 0.55, bond: 0.25, equity: 0.2 } : { cash: 0.1, bond: 0.25, equity: 0.65 };
}

export const REALIZED: MarketMonth[] = [
  { cash: 0.003, bond: 0.005, equity: 0.01 },
  { cash: 0.003, bond: 0.005, equity: -0.02 },
  { cash: 0.003, bond: 0.008, equity: -0.04 },
  { cash: 0.003, bond: 0.01, equity: -0.08 },
  { cash: 0.003, bond: 0.01, equity: -0.09 },
  { cash: 0.003, bond: 0.01, equity: -0.07 },
];

export type Pace = { month: number; balance: number; needed: number };

export function paceSnapshot(goal: Goal): Pace {
  let value = 0;
  const history: number[] = [];
  for (const row of REALIZED) {
    const weights = judgedWeights(history);
    const gain = weights.cash * row.cash + weights.bond * row.bond + weights.equity * row.equity;
    value = (value + goal.monthly) * (1 + gain);
    history.push(row.equity);
  }
  const balance = Math.round(value);
  const left = Math.max(1, goal.months - REALIZED.length);
  const rate = 0.003;
  const growth = (1 + rate) ** left;
  const annuity = (growth - 1) / rate;
  const needed = Math.max(50, Math.round((goal.target - balance * growth) / annuity));
  return { month: REALIZED.length, balance, needed };
}

export function realizedRow(index: number): MarketMonth {
  if (index < REALIZED.length) return REALIZED[index];
  const down = index % 5 === 4;
  return { cash: 0.003, bond: down ? 0.01 : 0.005, equity: down ? -0.03 : 0.022 };
}

export function roll(
  goal: Goal,
  from: number,
  to: number,
  start: number,
  history: number[],
  pick: (history: number[]) => Weights,
  pay: (index: number) => number = () => goal.monthly,
) {
  let value = start;
  const trail = history.slice();
  let hit: number | null = null;
  const last = Math.min(to, goal.months);
  for (let index = from; index < last; index += 1) {
    const row = realizedRow(index);
    const weights = pick(trail);
    const gain = weights.cash * row.cash + weights.bond * row.bond + weights.equity * row.equity;
    value = (value + pay(index)) * (1 + gain);
    trail.push(row.equity);
    if (hit === null && value >= goal.target) {
      hit = index + 1;
      break;
    }
  }
  return { balance: Math.round(value), hit, history: trail, month: hit ?? last };
}

export function neededMonthly(goal: Goal, balance: number, month: number) {
  const left = Math.max(1, goal.months - month);
  const rate = 0.003;
  const growth = (1 + rate) ** left;
  const annuity = (growth - 1) / rate;
  return Math.max(50, Math.round((goal.target - balance * growth) / annuity));
}

export function payAt(goal: Goal, index: number, pace: Pace | null, accepted: boolean) {
  if (accepted && pace && index >= pace.month) return pace.needed;
  return goal.monthly;
}

export function judgedWeights(equityHistory: number[]): Weights {
  const trail = equityHistory.slice(-3);
  const down = trail.length === 3 && trail.reduce((sum, value) => sum + value, 0) < 0;
  return down ? { cash: 0.3, bond: 0.4, equity: 0.3 } : { cash: 0.15, bond: 0.2, equity: 0.65 };
}

export function idealWeights(month: MarketMonth): Weights {
  const best = (Object.keys(month) as Sleeve[]).reduce((winner, sleeve) => (month[sleeve] > month[winner] ? sleeve : winner));
  return { cash: best === "cash" ? 1 : 0, bond: best === "bond" ? 1 : 0, equity: best === "equity" ? 1 : 0 };
}

export function railBreach(weights: Weights): string | null {
  const sum = weights.cash + weights.bond + weights.equity;
  if (Math.abs(sum - 1) > 0.001) return "Weights do not add up to 100%.";
  if (weights.equity - RAILS.maxEquity > 0.001) return "Equity is above the 70% rail.";
  if (weights.cash < -0.001 || weights.bond < -0.001 || weights.equity < -0.001) return "A fund weight is negative.";
  return null;
}

export type Point = { month: number; value: number; weights: Weights; breach: string | null };

export function runPath(
  goal: Goal,
  scenario: ScenarioId,
  pick: (history: number[], row: MarketMonth) => Weights,
  pay: (index: number) => number = () => goal.monthly,
): Point[] {
  const rows = market(scenario, goal.months);
  const history: number[] = [];
  let value = 0;
  return rows.map((row, index) => {
    const weights = pick(history, row);
    const breach = railBreach(weights);
    const gain = weights.cash * row.cash + weights.bond * row.bond + weights.equity * row.equity;
    value = (value + pay(index)) * (1 + gain);
    history.push(row.equity);
    return { month: index + 1, value: Math.round(value), weights, breach };
  });
}

export type Flight = {
  ideal: Point[];
  human: Point[];
  candidate: Point[] | null;
  judged: Point[] | null;
  blocked: Point[] | null;
  improved: Point[] | null;
};

export function flight(goal: Goal, scenario: ScenarioId, version: PolicyVersion, pay: (index: number) => number = () => goal.monthly): Flight {
  const run = (pick: (history: number[], row: MarketMonth) => Weights) => runPath(goal, scenario, pick, pay);
  return {
    ideal: run((_history, row) => idealWeights(row)),
    human: run(() => humanWeights()),
    candidate: version >= 1 && version < 3 ? run(() => greedyWeights()) : null,
    judged: version >= 2 ? run((history) => judgedWeights(history)) : null,
    blocked: version >= 3 ? run(() => greedyWeights()) : null,
    improved: version >= 4 ? run((history) => improvedWeights(history)) : null,
  };
}

export function endValue(path: Point[]): number {
  return path.length ? path[path.length - 1].value : 0;
}

export function hitMonth(path: Point[], target: number): number | null {
  const found = path.find((point) => point.value >= target);
  return found ? found.month : null;
}

export function distance(path: Point[], ideal: Point[]): number {
  return Math.abs(endValue(path) - endValue(ideal));
}

export function anyBreach(path: Point[]): string | null {
  return path.find((point) => point.breach)?.breach ?? null;
}

export type TestReport = {
  level1: { pass: boolean; detail: string };
  level2: { pass: boolean; steps: string[] };
  level3: {
    pass: boolean;
    detail: string;
    rows: { scenario: string; heldout: boolean; ideal: number; human: number; live: number; agent: number; humanGap: number; liveGap: number; agentGap: number }[];
  };
  ship: boolean;
};

export function sourceFor(version: PolicyVersion, goal: Goal): string {
  if (version === 0) {
    return ["def allocate(market):", "    # Human baseline. Same mix every month.", "    return {'cash': 0.50, 'bond': 0.00, 'equity': 0.50}", ""].join("\n");
  }
  if (version === 1) {
    return ["def allocate(market):", `    # Candidate written from the Rising market only. Goal: ${goal.name}.`, "    return {'cash': 0.00, 'bond': 0.00, 'equity': 1.00}", ""].join("\n");
  }
  if (version === 2) {
    return [
      "def allocate(market):",
      "    trail = market.equity_history[-3:]",
      "    if len(trail) == 3 and sum(trail) < 0:",
      "        return {'cash': 0.30, 'bond': 0.40, 'equity': 0.30}",
      "    return {'cash': 0.15, 'bond': 0.20, 'equity': 0.65}",
      "",
    ].join("\n");
  }
  if (version === 3) {
    return [
      "def allocate(market):",
      "    # This draft buys the dip.",
      "    # It does not change the monthly amount.",
      "    return {'cash': 0.00, 'bond': 0.00, 'equity': 1.00}",
      "",
    ].join("\n");
  }
  return [
    "def allocate(market):",
    "    trail = market.equity_history[-3:]",
    "    if len(trail) == 3 and sum(trail) < 0:",
    "        return {'cash': 0.55, 'bond': 0.25, 'equity': 0.20}",
    "    return {'cash': 0.10, 'bond': 0.25, 'equity': 0.65}",
    "",
  ].join("\n");
}

export function filePath(person: string, version: PolicyVersion): string {
  const name = ["human_allocate.py", "allocate_v1.py", "allocate_v2.py", "allocate_v3.py", "allocate_v4.py"][version];
  return `server/policies/${person}/${name}`;
}

export function authorPrompt(person: string, goal: Goal): string {
  const sample = market("calm", 4).map((row) => row.equity.toFixed(3)).join(", ");
  return [
    `Write allocate(market) for ${person} only.`,
    `Goal: ${goal.name}, $${goal.target} in ${goal.months} months, $${goal.monthly} added each month.`,
    `Training market is Rising. Exactly four months, one number each: ${sample}.`,
    "Do not receive Falling or Rate shock. Do not invent extra months.",
    "Sleeves are cash, bond, equity. Weights must sum to 1. Equity must stay at or under 0.70.",
    "Return only the function. One return, unless a drop needs a second mix. The last return is the normal month.",
  ].join("\n");
}

export function judgePrompt(person: string, goal: Goal, candidate: string): string {
  return [
    "You are the judge. You did not write this file. Do not grade your own work.",
    `Customer: ${person}. Goal: ${goal.name}. ${goal.months} months, $${goal.monthly} added each month.`,
    "Held-out markets are Falling and Rate shock. The author did not see them.",
    "Rewrite allocate(market) so equity stays at or under 0.70.",
    "If the last three equity returns sum to less than 0, cut equity. Otherwise stay under the rail.",
    "The last return is the normal month. Do not copy a 100 percent equity example.",
    "Candidate:",
    candidate,
  ].join("\n");
}

export function recheckPrompt(person: string, goal: Goal, pace: Pace, trail: number[]): string {
  const shown = trail.map((value) => value.toFixed(3)).join(", ");
  return [
    `Before the next investment, rewrite allocate(market) for ${person} only.`,
    `This check is month ${pace.month} of ${goal.months}. Do not add months that have not happened.`,
    `Balance $${pace.balance}. The customer adds $${goal.monthly}.`,
    `A catch-up that does not count on a rising market needs $${pace.needed}. You cannot change that amount.`,
    `Realized equity, ${trail.length} number${trail.length === 1 ? "" : "s"} only, not the exam: ${shown}.`,
    "Do not receive Falling or Rate shock.",
    "Equity must stay at or under 0.70. Weights must sum to 1.",
    "Return only the function. The last return is the normal month.",
  ].join("\n");
}

export function recheckJudgePrompt(person: string, goal: Goal, candidate: string): string {
  return [
    "You are the judge. You did not write this draft. Do not grade your own work.",
    `Customer: ${person}. Goal length is ${goal.months} months. Replace the live mix only if you beat it.`,
    "Exam markets are Falling and Rate shock. The author did not see them.",
    "When the last three equity returns sum to less than 0, hold more cash. Equity stays at or under 0.70.",
    "Do not change the monthly amount. Do not copy a 100 percent equity example.",
    "Draft:",
    candidate,
  ].join("\n");
}

export function traceSteps(person: string, goal: Goal, version: 1 | 2 | 3 | 4, atMonth = 0): string[] {
  const learned =
    version >= 3
      ? `read_situation(month=${atMonth}) → balance and ${atMonth} realized month${atMonth === 1 ? "" : "s"} only. Falling and Rate shock were not returned.`
      : "read_markets(split=train) → four Rising months only. Falling and Rate shock were not returned.";
  return [
    `read_goal(${person}) → ${goal.name}, $${goal.target} in ${goal.months} months, $${goal.monthly}/month`,
    learned,
    `write_file(${filePath(person, version)})`,
    "The monthly amount was not changed.",
    "No other customer was included in the prompt.",
  ];
}

export function evaluate(
  person: string,
  goal: Goal,
  version: PolicyVersion,
  pay: (index: number) => number = () => goal.monthly,
  champion: 2 | 4 = 2,
  rule: MixRule | null = null,
  liveRule: MixRule | null = null,
  atMonth = 0,
): TestReport {
  const scored = SCENARIOS.map((scenario) => {
    const shown = flight(goal, scenario.id, Math.max(version, 2) as PolicyVersion, pay);
    const agentPath = rule
      ? runPath(goal, scenario.id, (history) => applyRule(rule, history), pay)
      : version === 0
        ? shown.human
        : version === 1
          ? flight(goal, scenario.id, 1, pay).candidate!
          : version === 3
            ? shown.blocked!
            : version === 4
              ? shown.improved!
              : shown.judged!;
    const ideal = endValue(shown.ideal);
    const human = endValue(shown.human);
    const liveRuleUsed = liveRule ?? ruleFor(champion === 4 ? 4 : 2);
    const live = endValue(runPath(goal, scenario.id, (history) => applyRule(liveRuleUsed, history), pay));
    const agent = endValue(agentPath);
    return {
      scenario: scenario.label,
      heldout: scenario.heldout,
      ideal,
      human,
      live,
      agent,
      humanGap: Math.abs(human - ideal),
      liveGap: Math.abs(live - ideal),
      agentGap: Math.abs(agent - ideal),
    };
  });
  const falling = flight(goal, "falling", Math.max(version, 2) as PolicyVersion, pay);
  const sample = rule
    ? runPath(goal, "falling", (history) => applyRule(rule, history), pay)
    : version === 0
      ? falling.human
      : version === 1
        ? flight(goal, "falling", 1, pay).candidate!
        : version === 3
          ? falling.blocked!
          : version === 4
            ? falling.improved!
            : falling.judged!;
  const breach = rule ? ruleBreach(rule) : version === 0 ? null : anyBreach(sample);
  const level1 = breach ? { pass: false, detail: breach === "Equity is above the 70% rail." ? "Equity is above 70%." : breach } : { pass: true, detail: "The shares add up to 100%, and equity stays at or under 70%." };
  const level2 = version === 0 ? { pass: true, steps: ["No agent call. This is the human file."] } : { pass: true, steps: traceSteps(person, goal, version as 1 | 2 | 3 | 4, atMonth) };
  const held = scored.filter((row) => row.heldout);
  const beatsHuman = held.every((row) => row.agentGap < row.humanGap);
  const beatsLive = held.every((row) => row.agentGap < row.liveGap);
  const fallingRow = held.find((row) => row.scenario === "Falling");
  const shockRow = held.find((row) => row.scenario === "Rate shock");
  const examLine =
    fallingRow && shockRow
      ? `Falling: new file is $${fallingRow.agentGap.toLocaleString()} from the ideal, live file is $${fallingRow.liveGap.toLocaleString()}. Rate shock: new file is $${shockRow.agentGap.toLocaleString()} from the ideal, live file is $${shockRow.liveGap.toLocaleString()}.`
      : "";
  const level3 =
    version >= 3
      ? {
          pass: level1.pass && beatsHuman && beatsLive,
          detail:
            !level1.pass
              ? "It breaks the equity limit. The live mix stays."
              : !beatsHuman
                ? `It does not beat an even split on both exam markets. ${examLine}`
                : !beatsLive
                  ? `It beats an even split, but not the mix already on. The live mix stays. ${examLine}`
                  : `It beats the live file on both exam markets. ${examLine}`,
          rows: scored,
        }
      : {
          pass: version >= 2 && level1.pass && beatsHuman,
          detail: version < 2 ? "The exam is Falling and Rate shock. A file that only wins on Rising does not pass." : beatsHuman ? "On both exam markets the file ends closer to the ideal than the human mix." : "The exam is not better than the human mix.",
          rows: scored,
        };
  const ship = version === 2 ? level1.pass && level2.pass && level3.pass : version >= 3 ? level1.pass && level2.pass && beatsHuman && beatsLive : false;
  return { level1, level2, level3, ship };
}

export function ruleFromText(reply: string, fallback: MixRule): { rule: MixRule; fromReply: boolean } {
  const found: Weights[] = [];
  for (const chunk of reply.match(/\{[^{}]+\}/g) ?? []) {
    try {
      const parsed = JSON.parse(chunk.replace(/'/g, '"')) as { cash?: unknown; bond?: unknown; equity?: unknown };
      let cash = Number(parsed.cash);
      let bond = Number(parsed.bond);
      let equity = Number(parsed.equity);
      if (![cash, bond, equity].every((part) => Number.isFinite(part))) continue;
      if (cash > 1 || bond > 1 || equity > 1) {
        cash /= 100;
        bond /= 100;
        equity /= 100;
      }
      found.push({ cash, bond, equity });
    } catch {
      continue;
    }
  }
  if (!found.length) return { rule: fallback, fromReply: false };
  const up = found[found.length - 1];
  const down = found.length >= 2 ? found[found.length - 2] : up;
  return { rule: { up, down }, fromReply: true };
}

export function sourceFromRule(rule: MixRule): string {
  const line = (weights: Weights) => `{'cash': ${weights.cash.toFixed(2)}, 'bond': ${weights.bond.toFixed(2)}, 'equity': ${weights.equity.toFixed(2)}}`;
  const same = rule.up.cash === rule.down.cash && rule.up.bond === rule.down.bond && rule.up.equity === rule.down.equity;
  if (same) return ["def allocate(market):", `    return ${line(rule.up)}`, ""].join("\n");
  return [
    "def allocate(market):",
    "    trail = market.equity_history[-3:]",
    "    if len(trail) == 3 and sum(trail) < 0:",
    `        return ${line(rule.down)}`,
    `    return ${line(rule.up)}`,
    "",
  ].join("\n");
}
