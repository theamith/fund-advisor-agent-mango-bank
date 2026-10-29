import type { Goal, MixRule, Pace, PolicyVersion, TestReport } from "@/lib/fund";

export type PersonId = "maya" | "sam";

export type BankTxn = { id: string; daysAgo: number; label: string; amount: number };

export type AuditRow = { id: string; at: string; who: string; action: string; detail: string; prompt: string; reply: string };

export type ModelCall = {
  where: "author" | "judge" | "recheck" | "recheck-judge";
  source: "gemini" | "rehearsal";
  prompt: string;
  reply: string;
  ms: number;
  error: string;
};

export type SavedGoal = Goal & { id: string };

export type RetailView = {
  id: PersonId;
  name: string;
  account: string;
  cash: number;
  enrolled: boolean;
  advisorOffer: boolean;
  txns: BankTxn[];
  goals: SavedGoal[];
  activeGoalId: string | null;
  goal: Goal | null;
  version: PolicyVersion;
  live: 0 | 2 | 4;
  shipped: boolean;
  pace: Pace | null;
  paceAccepted: boolean;
  phase: "ready" | "fail" | "pass" | "done";
  outcome: "goal" | "tenure" | null;
  elapsed: number;
  rule: MixRule | null;
  report: TestReport | null;
  repeated: boolean;
  gemini: ModelCall | null;
};

export type AdminView = {
  serving: "up";
  geminiConfigured: boolean;
  attempts: number;
  successes: number;
  lastMs: number;
  lastError: string;
  audit: AuditRow[];
  customers: Array<{
    id: PersonId;
    name: string;
    enrolled: boolean;
    cash: number;
    goal: Goal | null;
    version: PolicyVersion;
    live: 0 | 2 | 4;
    shipped: boolean;
    pace: Pace | null;
    paceAccepted: boolean;
    phase: "ready" | "fail" | "pass" | "done";
    outcome: "goal" | "tenure" | null;
    elapsed: number;
    rule: MixRule | null;
    path: string | null;
    report: TestReport | null;
    gemini: ModelCall | null;
  }>;
};
