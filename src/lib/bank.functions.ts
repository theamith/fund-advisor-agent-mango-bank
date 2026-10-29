import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServerFn } from "@tanstack/react-start";
import { applyRule, authorPrompt, evaluate, filePath, judgePrompt, neededMonthly, payAt, recheckJudgePrompt, recheckPrompt, roll, ruleFor, ruleFromText, sameRule, sourceFor, sourceFromRule, type Goal, type MixRule } from "@/lib/fund";
import type { AdminView, AuditRow, BankTxn, ModelCall, PersonId, RetailView, SavedGoal } from "@/lib/bank-types";

const PEOPLE = {
  maya: { name: "Maya", account: "Everyday checking ···4291", cash: 42000 },
  sam: { name: "Sam", account: "Everyday checking ···1784", cash: 18600 },
} as const;

const TXNS: Record<PersonId, BankTxn[]> = {
  maya: [
    { id: "m1", daysAgo: 1, label: "Payroll", amount: 3200 },
    { id: "m2", daysAgo: 2, label: "Groceries", amount: -86 },
    { id: "m3", daysAgo: 4, label: "City transit", amount: -64 },
    { id: "m4", daysAgo: 6, label: "Rent", amount: -2200 },
    { id: "m5", daysAgo: 9, label: "Utilities", amount: -140 },
    { id: "m6", daysAgo: 14, label: "Payroll", amount: 3200 },
    { id: "m7", daysAgo: 16, label: "Groceries", amount: -92 },
    { id: "m8", daysAgo: 21, label: "Dining", amount: -54 },
  ],
  sam: [
    { id: "s1", daysAgo: 1, label: "Payroll", amount: 2600 },
    { id: "s2", daysAgo: 3, label: "Rent", amount: -1800 },
    { id: "s3", daysAgo: 8, label: "Groceries", amount: -70 },
    { id: "s4", daysAgo: 15, label: "Payroll", amount: 2600 },
  ],
};

type Desk = {
  enrolled: boolean;
  advisorOffer: boolean;
  cash: number;
  txns: BankTxn[];
  goals: SavedGoal[];
  activeGoalId: string | null;
  goal: Goal | null;
  version: 0 | 1 | 2 | 3 | 4;
  live: 0 | 2 | 4;
  shipped: boolean;
  pace: import("@/lib/fund").Pace | null;
  paceAccepted: boolean;
  phase: "ready" | "fail" | "pass" | "done";
  outcome: "goal" | "tenure" | null;
  elapsed: number;
  equityTrail: number[];
  rule: MixRule | null;
  liveRule: MixRule | null;
  repeated: boolean;
  gemini: ModelCall | null;
};

function blank(cash: number, txns: BankTxn[]): Desk {
  return { enrolled: false, advisorOffer: false, cash, txns: txns.map((row) => ({ ...row })), goals: [], activeGoalId: null, goal: null, version: 0, live: 0, shipped: false, pace: null, paceAccepted: false, phase: "ready", outcome: null, elapsed: 0, equityTrail: [], rule: null, liveRule: null, repeated: false, gemini: null };
}

const desks: Record<PersonId, Desk> = {
  maya: blank(PEOPLE.maya.cash, TXNS.maya),
  sam: blank(PEOPLE.sam.cash, TXNS.sam),
};

const audit: AuditRow[] = [];
const metrics = { attempts: 0, successes: 0, lastMs: 0, lastError: "" };

function geminiKey() {
  const fromEnv = process.env.GEMINI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const raw = readFileSync(join(process.cwd(), "config/gemini.server.json"), "utf8");
    const parsed = JSON.parse(raw) as { apiKey?: string };
    return parsed.apiKey?.trim() || "";
  } catch {
    return "";
  }
}

async function askGemini(where: ModelCall["where"], prompt: string): Promise<ModelCall> {
  const key = geminiKey();
  if (!key) return { where, source: "rehearsal", prompt, reply: "No key in config/gemini.server.json. The rehearsal file was stored instead.", ms: 0, error: "" };
  metrics.attempts += 1;
  const started = Date.now();
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const body = (await response.json()) as { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const ms = Date.now() - started;
    metrics.lastMs = ms;
    if (!response.ok) {
      const error = body.error?.message || `Gemini returned ${response.status}.`;
      metrics.lastError = error;
      return { where, source: "rehearsal", prompt, reply: "The live call failed. The rehearsal file was stored instead.", ms, error };
    }
    metrics.successes += 1;
    metrics.lastError = "";
    const reply = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "Empty reply.";
    return { where, source: "gemini", prompt, reply, ms, error: "" };
  } catch (error) {
    const ms = Date.now() - started;
    metrics.lastMs = ms;
    const message = error instanceof Error ? error.message : "Gemini failed.";
    metrics.lastError = message;
    return { where, source: "rehearsal", prompt, reply: "The live call failed. The rehearsal file was stored instead.", ms, error: message };
  }
}

function asPerson(value: unknown): PersonId {
  if (value === "maya" || value === "sam") return value;
  throw new Error("Unknown customer.");
}

function stamp(who: string, action: string, detail: string, model?: { prompt: string; reply: string }) {
  audit.unshift({ id: crypto.randomUUID(), at: new Date().toLocaleTimeString(), who, action, detail, prompt: model?.prompt ?? "", reply: model?.reply ?? "" });
  if (audit.length > 80) audit.pop();
}

function mixNote(call: ModelCall, fromReply: boolean) {
  if (call.source !== "gemini") return "Rehearsal mix. AI was not called.";
  return fromReply ? "The mix on screen is the AI reply." : "The reply had no cash, bond, and equity numbers, so the rehearsal mix is shown.";
}

function saveFile(id: PersonId, version: 0 | 1 | 2 | 3 | 4) {
  const desk = desks[id];
  if (!desk.goal) throw new Error("Set a goal first.");
  const path = filePath(id, version);
  const absolute = join(process.cwd(), path);
  mkdirSync(join(process.cwd(), "server/policies", id), { recursive: true });
  writeFileSync(absolute, desk.rule ? sourceFromRule(desk.rule) : sourceFor(version, desk.goal), "utf8");
  return path;
}

function reportFor(id: PersonId) {
  const desk = desks[id];
  if (!desk.goal) return null;
  const pay = (index: number) => payAt(desk.goal!, index, desk.pace, desk.paceAccepted);
  return evaluate(id, desk.goal, desk.version, pay, desk.live === 4 ? 4 : 2, desk.rule, desk.liveRule, desk.pace?.month ?? desk.elapsed);
}

function refreshCycle(desk: Desk, id: PersonId) {
  if (desk.version < 3 || desk.phase === "done") return;
  const report = reportFor(id);
  if (report?.ship) desk.version = 4;
  desk.phase = report?.level1.pass ? "pass" : "fail";
}

function retail(id: PersonId): RetailView {
  const desk = desks[id];
  return {
    id,
    name: PEOPLE[id].name,
    account: PEOPLE[id].account,
    cash: desk.cash,
    enrolled: desk.enrolled,
    advisorOffer: desk.advisorOffer,
    txns: desk.txns,
    goals: desk.goals,
    activeGoalId: desk.activeGoalId,
    goal: desk.goal,
    version: desk.version,
    live: desk.live,
    shipped: desk.shipped,
    pace: desk.pace,
    paceAccepted: desk.paceAccepted,
    phase: desk.phase,
    outcome: desk.outcome,
    elapsed: desk.elapsed,
    rule: desk.rule,
    report: reportFor(id),
    repeated: desk.repeated,
    gemini: desk.gemini ? { ...desk.gemini, prompt: "", reply: "" } : null,
  };
}

export const getRetail = createServerFn({ method: "GET" })
  .validator((data: unknown) => asPerson((data as { id?: unknown })?.id))
  .handler(async ({ data }) => retail(data));

export const enroll = createServerFn({ method: "POST" })
  .validator((data: unknown) => asPerson((data as { id?: unknown })?.id))
  .handler(async ({ data }) => {
    desks[data].enrolled = true;
    desks[data].advisorOffer = false;
    stamp(PEOPLE[data].name, "Enrolled Fund Advisor", "Accepted the offer on the goal. No money moved.");
    return retail(data);
  });

export const setGoal = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const body = data as { id?: unknown; name?: unknown; target?: unknown; months?: unknown; monthly?: unknown };
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
    const target = Math.round(Number(body.target));
    const months = Math.round(Number(body.months));
    const monthly = Math.round(Number(body.monthly));
    if (!name) throw new Error("Name the goal.");
    if (!Number.isFinite(target) || target < 1000 || target > 500000) throw new Error("Enter a goal amount.");
    if (!Number.isFinite(months) || months < 6 || months > 36) throw new Error("Use 6 to 36 months.");
    if (!Number.isFinite(monthly) || monthly < 50 || monthly > 20000) throw new Error("Enter the monthly amount.");
    return { id: asPerson(body.id), name, target, months, monthly };
  })
  .handler(async ({ data }) => {
    const desk = desks[data.id];
    desk.goal = { name: data.name, target: data.target, months: data.months, monthly: data.monthly };
    const saved = { id: crypto.randomUUID(), ...desk.goal };
    desk.goals = [saved, ...desk.goals];
    desk.activeGoalId = saved.id;
    desk.version = 0;
    desk.live = 0;
    desk.shipped = false;
    desk.gemini = null;
    desk.pace = null;
    desk.paceAccepted = false;
    desk.phase = "ready";
    desk.outcome = null;
    desk.elapsed = 0;
    desk.equityTrail = [];
    desk.rule = null;
    desk.liveRule = null;
    desk.repeated = false;
    desk.advisorOffer = true;
    const path = saveFile(data.id, 0);
    stamp(PEOPLE[data.id].name, "Goal set", `${data.name}, $${data.target} in ${data.months} months, $${data.monthly} a month. ${path} is the human file.`);
    return retail(data.id);
  });

export const openGoal = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const body = data as { id?: unknown; goalId?: unknown };
    const goalId = typeof body.goalId === "string" ? body.goalId : "";
    if (!goalId) throw new Error("Choose a goal.");
    return { id: asPerson(body.id), goalId };
  })
  .handler(async ({ data }) => {
    const desk = desks[data.id];
    const saved = desk.goals.find((goal) => goal.id === data.goalId);
    if (!saved) throw new Error("That goal is not on this account.");
    if (desk.activeGoalId !== saved.id) {
      desk.goal = { name: saved.name, target: saved.target, months: saved.months, monthly: saved.monthly };
      desk.activeGoalId = saved.id;
      desk.version = 0;
      desk.live = 0;
      desk.shipped = false;
      desk.gemini = null;
      desk.pace = null;
      desk.paceAccepted = false;
      desk.phase = "ready";
      desk.outcome = null;
      desk.elapsed = 0;
      desk.equityTrail = [];
      desk.rule = null;
      desk.liveRule = null;
      desk.repeated = false;
      saveFile(data.id, 0);
      stamp(PEOPLE[data.id].name, "Opened a goal", `${saved.name}. Fund Advisor starts again from the human file for this goal.`);
    }
    if (!desk.enrolled) desk.advisorOffer = true;
    return retail(data.id);
  });

export const declineAdvisor = createServerFn({ method: "POST" })
  .validator((data: unknown) => asPerson((data as { id?: unknown })?.id))
  .handler(async ({ data }) => {
    desks[data].advisorOffer = false;
    stamp(PEOPLE[data].name, "Kept the goal", "Did not turn on Fund Advisor. No file was sent to a model.");
    return retail(data);
  });

export const writeCandidate = createServerFn({ method: "POST" })
  .validator((data: unknown) => asPerson((data as { id?: unknown })?.id))
  .handler(async ({ data }) => {
    const desk = desks[data];
    if (!desk.goal) throw new Error("Set a goal first.");
    const prompt = authorPrompt(data, desk.goal);
    const call = await askGemini("author", prompt);
    desk.gemini = call;
    desk.version = 1;
    const adopted = ruleFromText(call.reply, ruleFor(1));
    desk.rule = adopted.rule;
    desk.repeated = false;
    desk.shipped = false;
    const path = saveFile(data, 1);
    stamp(PEOPLE[data].name, "Candidate written", `${path}. ${mixNote(call, adopted.fromReply)} Rising market only.`, call);
    return retail(data);
  });

export const judgeRewrite = createServerFn({ method: "POST" })
  .validator((data: unknown) => asPerson((data as { id?: unknown })?.id))
  .handler(async ({ data }) => {
    const desk = desks[data];
    if (desk.version < 1 || !desk.goal) throw new Error("Write a candidate first.");
    const previous = desk.rule;
    const call = await askGemini("judge", judgePrompt(data, desk.goal, sourceFromRule(desk.rule ?? ruleFor(1))));
    desk.gemini = call;
    desk.version = 2;
    const adopted = ruleFromText(call.reply, ruleFor(2));
    desk.repeated = previous ? sameRule(previous, adopted.rule) : false;
    desk.rule = adopted.rule;
    desk.shipped = false;
    const path = saveFile(data, 2);
    stamp(PEOPLE[data].name, "Judge rewrote the file", `${path}. ${mixNote(call, adopted.fromReply)}${desk.repeated ? " Same weights as the first mix." : ""}`, call);
    return retail(data);
  });

export const shipFile = createServerFn({ method: "POST" })
  .validator((data: unknown) => asPerson((data as { id?: unknown })?.id))
  .handler(async ({ data }) => {
    const report = reportFor(data);
    if (!report?.ship) {
      stamp("Mango Bank", "Ship refused", "Held-out must beat the human file, and the rails must pass.");
      throw new Error("Ship refused. Held-out must beat the human file, and the rails must pass.");
    }
    desks[data].shipped = true;
    desks[data].live = 2;
    desks[data].phase = "ready";
    desks[data].elapsed = 0;
    desks[data].equityTrail = [];
    desks[data].outcome = null;
    desks[data].liveRule = desks[data].rule;
    stamp("Mango Bank", "Shipped", `${filePath(data, 2)} is live. Later months run this file. No model call.`);
    return retail(data);
  });

export const checkNext = createServerFn({ method: "POST" })
  .validator((data: unknown) => asPerson((data as { id?: unknown })?.id))
  .handler(async ({ data }) => {
    const desk = desks[data];
    if (!desk.goal || !desk.shipped || desk.phase !== "ready") throw new Error("Ship a file before the next cycle.");
    const through = Math.min(desk.goal.months, desk.elapsed + 1);
    const pick = (history: number[]) => applyRule(desk.liveRule ?? ruleFor(desk.live === 4 ? 4 : 2), history);
    const pay = (index: number) => payAt(desk.goal!, index, desk.pace, desk.paceAccepted);
    const rolled = roll(desk.goal, desk.elapsed, through, desk.elapsed === 0 ? 0 : (desk.pace?.balance ?? 0), desk.equityTrail, pick, pay);
    const month = rolled.month;
    const pace = { month, balance: rolled.balance, needed: neededMonthly(desk.goal, rolled.balance, month) };
    desk.pace = pace;
    desk.elapsed = month;
    desk.equityTrail = rolled.history;
    if (rolled.hit) {
      desk.outcome = "goal";
      desk.phase = "done";
      stamp(PEOPLE[data].name, "Goal reached", `Month ${month}. Balance $${rolled.balance}. No new file.`);
      return retail(data);
    }
    if (month >= desk.goal.months) {
      desk.outcome = "tenure";
      desk.phase = "done";
      stamp(PEOPLE[data].name, "Tenure ended", `Month ${month}. Balance $${rolled.balance}. The live file stops.`);
      return retail(data);
    }
    const call = await askGemini("recheck", recheckPrompt(data, desk.goal, pace, rolled.history));
    desk.gemini = call;
    const adopted = ruleFromText(call.reply, ruleFor(3));
    desk.rule = adopted.rule;
    desk.repeated = false;
    desk.version = 3;
    const report = reportFor(data);
    desk.phase = report?.level1.pass ? "pass" : "fail";
    if (report?.ship) desk.version = 4;
    const path = saveFile(data, desk.version);
    stamp(PEOPLE[data].name, report?.ship ? "Cycle mix accepted" : "Cycle mix blocked", `Month ${month}. ${path}. ${mixNote(call, adopted.fromReply)} Suggested monthly is $${pace.needed}.`, call);
    return retail(data);
  });

export const judgeRecheck = createServerFn({ method: "POST" })
  .validator((data: unknown) => asPerson((data as { id?: unknown })?.id))
  .handler(async ({ data }) => {
    const desk = desks[data];
    if (desk.phase !== "fail" || !desk.goal) throw new Error("Run the next cycle first.");
    const previous = desk.rule;
    const call = await askGemini("recheck-judge", recheckJudgePrompt(data, desk.goal, sourceFromRule(desk.rule ?? ruleFor(3))));
    desk.gemini = call;
    const adopted = ruleFromText(call.reply, ruleFor(4));
    desk.repeated = previous ? sameRule(previous, adopted.rule) : false;
    desk.rule = adopted.rule;
    desk.version = 4;
    const report = reportFor(data);
    desk.phase = report?.level1.pass ? "pass" : "fail";
    const path = saveFile(data, 4);
    stamp(PEOPLE[data].name, "Recheck rewritten", `${path}. ${mixNote(call, adopted.fromReply)} It is not used until it beats the mix already on.`, call);
    return retail(data);
  });

export const replaceLive = createServerFn({ method: "POST" })
  .validator((data: unknown) => asPerson((data as { id?: unknown })?.id))
  .handler(async ({ data }) => {
    const report = reportFor(data);
    if (desks[data].phase !== "pass" || !report?.ship) {
      stamp("Mango Bank", "Replace refused", "The live file stays.");
      throw new Error("Replace refused. The new file must beat the live file on both exam markets, inside the rail.");
    }
    desks[data].live = 4;
    desks[data].liveRule = desks[data].rule;
    desks[data].phase = "ready";
    stamp("Mango Bank", "Live file replaced", `${filePath(data, 4)} is now live. You can run the next cycle.`);
    return retail(data);
  });

export const keepLive = createServerFn({ method: "POST" })
  .validator((data: unknown) => asPerson((data as { id?: unknown })?.id))
  .handler(async ({ data }) => {
    if (desks[data].phase !== "pass") throw new Error("There is no adjusted file to set aside.");
    desks[data].phase = "ready";
    stamp("Mango Bank", "Live file kept", "The adjustment did not beat it. The next cycle can still run.");
    return retail(data);
  });

export const resetGoal = createServerFn({ method: "POST" })
  .validator((data: unknown) => asPerson((data as { id?: unknown })?.id))
  .handler(async ({ data }) => {
    const desk = desks[data];
    if (!desk.goal) throw new Error("Set a goal first.");
    desk.version = 0;
    desk.live = 0;
    desk.shipped = false;
    desk.pace = null;
    desk.paceAccepted = false;
    desk.phase = "ready";
    desk.outcome = null;
    desk.elapsed = 0;
    desk.equityTrail = [];
    desk.rule = null;
    desk.liveRule = null;
    desk.repeated = false;
    desk.gemini = null;
    const path = saveFile(data, 0);
    stamp(PEOPLE[data].name, "Goal reset", `${path} is the human file again. Nothing is live.`);
    return retail(data);
  });

export const setMix = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const body = data as { id?: unknown; up?: unknown; down?: unknown };
    const read = (value: unknown) => {
      const row = value as { cash?: unknown; bond?: unknown; equity?: unknown };
      const cash = Number(row?.cash);
      const bond = Number(row?.bond);
      const equity = Number(row?.equity);
      if (![cash, bond, equity].every((part) => Number.isFinite(part) && part >= 0 && part <= 100)) throw new Error("Enter shares from 0 to 100.");
      return { cash: cash / 100, bond: bond / 100, equity: equity / 100 };
    };
    return { id: asPerson(body.id), up: read(body.up), down: read(body.down) };
  })
  .handler(async ({ data }) => {
    const desk = desks[data.id];
    if (!desk.goal || desk.version < 1) throw new Error("Ask for a mix first.");
    desk.rule = { up: data.up, down: data.down };
    desk.repeated = false;
    refreshCycle(desk, data.id);
    stamp(PEOPLE[data.id].name, "Mix adjusted", `Most months ${Math.round(data.up.cash * 100)}/${Math.round(data.up.bond * 100)}/${Math.round(data.up.equity * 100)}. After a drop ${Math.round(data.down.cash * 100)}/${Math.round(data.down.bond * 100)}/${Math.round(data.down.equity * 100)}.`);
    return retail(data.id);
  });

export const removeGoal = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const body = data as { id?: unknown; goalId?: unknown };
    const goalId = typeof body.goalId === "string" ? body.goalId : "";
    if (!goalId) throw new Error("Choose a goal.");
    return { id: asPerson(body.id), goalId };
  })
  .handler(async ({ data }) => {
    const desk = desks[data.id];
    const saved = desk.goals.find((goal) => goal.id === data.goalId);
    if (!saved) throw new Error("That goal is not on this account.");
    desk.goals = desk.goals.filter((goal) => goal.id !== data.goalId);
    if (desk.activeGoalId === data.goalId) {
      const next = desk.goals[0] ?? null;
      desk.activeGoalId = next?.id ?? null;
      desk.goal = next ? { name: next.name, target: next.target, months: next.months, monthly: next.monthly } : null;
      desk.version = 0;
      desk.live = 0;
      desk.shipped = false;
      desk.pace = null;
      desk.paceAccepted = false;
      desk.phase = "ready";
      desk.outcome = null;
      desk.elapsed = 0;
      desk.equityTrail = [];
      desk.rule = null;
      desk.liveRule = null;
      desk.repeated = false;
      desk.gemini = null;
      desk.advisorOffer = false;
      if (desk.goal) saveFile(data.id, 0);
    }
    stamp(PEOPLE[data.id].name, "Goal removed", saved.name);
    return retail(data.id);
  });

export const acceptPace = createServerFn({ method: "POST" })
  .validator((data: unknown) => asPerson((data as { id?: unknown })?.id))
  .handler(async ({ data }) => {
    const desk = desks[data];
    if (!desk.pace || !desk.goal) throw new Error("Run the check first.");
    desk.paceAccepted = true;
    stamp(PEOPLE[data].name, "Monthly amount accepted", `From month ${desk.pace.month + 1} the monthly amount is $${desk.pace.needed}. The mix did not set it.`);
    return retail(data);
  });

export const pay = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const body = data as { id?: unknown; payee?: unknown; amount?: unknown; direction?: unknown };
    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new Error("Enter an amount.");
    const payee = typeof body.payee === "string" && body.payee.trim() ? body.payee.trim().slice(0, 40) : "Payment";
    const direction = body.direction === "in" ? "in" : "out";
    return { id: asPerson(body.id), payee, amount, direction };
  })
  .handler(async ({ data }) => {
    const desk = desks[data.id];
    if (data.direction === "out" && data.amount > desk.cash) throw new Error("That is more than the balance.");
    const signed = data.direction === "in" ? data.amount : -data.amount;
    desk.cash += signed;
    desk.txns.unshift({ id: crypto.randomUUID(), daysAgo: 0, label: data.payee, amount: signed });
    stamp(PEOPLE[data.id].name, data.direction === "in" ? "Deposit" : "Payment", `${data.payee} $${data.amount}. Fund Advisor did not move this money.`);
    return retail(data.id);
  });

export const getAdmin = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .handler(async () => {
    const view: AdminView = {
      serving: "up",
      geminiConfigured: Boolean(geminiKey()),
      attempts: metrics.attempts,
      successes: metrics.successes,
      lastMs: metrics.lastMs,
      lastError: metrics.lastError,
      audit,
      customers: (["maya", "sam"] as PersonId[])
        .filter((id) => desks[id].enrolled || desks[id].goal !== null || desks[id].version > 0 || desks[id].gemini !== null)
        .map((id) => ({
          id,
          name: PEOPLE[id].name,
          enrolled: desks[id].enrolled,
          cash: desks[id].cash,
          goal: desks[id].goal,
          version: desks[id].version,
          live: desks[id].live,
          shipped: desks[id].shipped,
          pace: desks[id].pace,
          paceAccepted: desks[id].paceAccepted,
          phase: desks[id].phase,
          outcome: desks[id].outcome,
          elapsed: desks[id].elapsed,
          rule: desks[id].rule,
          path: desks[id].goal ? filePath(id, desks[id].live || desks[id].version) : null,
          report: reportFor(id),
          gemini: desks[id].gemini,
        })),
    };
    return view;
  });
