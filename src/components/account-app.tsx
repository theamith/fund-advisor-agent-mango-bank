import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FundWorkbench } from "@/components/fund-workbench";
import { MangoWordmark } from "@/components/mango-mark";
import { enroll, declineAdvisor, getRetail, judgeRewrite, pay, setGoal, openGoal, shipFile, writeCandidate, checkNext, judgeRecheck, replaceLive, acceptPace, keepLive, resetGoal, removeGoal, setMix } from "@/lib/bank.functions";
import { readSession, writeSession } from "@/lib/demo-session";
import type { RetailView } from "@/lib/bank-types";

type Section = "home" | "pay" | "goals" | "advisor";

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const SECTION_KEY = "mango-section";

function readSection(): Section {
  if (typeof sessionStorage === "undefined") return "home";
  const value = sessionStorage.getItem(SECTION_KEY);
  if (value === "home" || value === "pay" || value === "goals" || value === "advisor") return value;
  return "home";
}

export function AccountApp() {
  const navigate = useNavigate();
  const load = useServerFn(getRetail);
  const declineFn = useServerFn(declineAdvisor);
  const payFn = useServerFn(pay);
  const goalFn = useServerFn(setGoal);
  const openFn = useServerFn(openGoal);
  const writeFn = useServerFn(writeCandidate);
  const judgeFn = useServerFn(judgeRewrite);
  const shipFn = useServerFn(shipFile);
  const checkFn = useServerFn(checkNext);
  const recheckFn = useServerFn(judgeRecheck);
  const replaceFn = useServerFn(replaceLive);
  const acceptFn = useServerFn(acceptPace);
  const keepFn = useServerFn(keepLive);
  const resetFn = useServerFn(resetGoal);
  const removeFn = useServerFn(removeGoal);
  const mixFn = useServerFn(setMix);
  const enrollFn = useServerFn(enroll);
  const [view, setView] = useState<RetailView | null>(null);
  const [section, setSectionState] = useState<Section>(readSection);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const who = readSession();

  function setSection(next: Section) {
    setSectionState(next);
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(SECTION_KEY, next);
  }

  useEffect(() => {
    if (who !== "maya" && who !== "sam") navigate({ to: "/" });
  }, [who, navigate]);

  useEffect(() => {
    if (who !== "maya" && who !== "sam") return;
    load({ data: { id: who } }).then(setView).catch((err: Error) => setError(err.message));
  }, [who, load]);

  async function run(task: () => Promise<RetailView>) {
    setBusy(true);
    setError("");
    try {
      setView(await task());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!view || (who !== "maya" && who !== "sam")) {
    return (
      <main className="p-8 text-sm text-muted">
        Opening your accounts…
        {error ? <span className="mt-2 block text-bad">{error}</span> : null}
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-8">
          <MangoWordmark />
          <nav className="flex flex-wrap gap-1" aria-label="Accounts">
            {(
              [
                ["home", "Accounts"],
                ["pay", "Pay"],
                ["goals", "Goals"],
                ...(view.enrolled ? [["advisor", "Fund Advisor"] as const] : []),
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setSection(id)} className={"min-h-11 rounded-card px-3 text-sm " + (section === id ? "bg-gold font-semibold text-gold-ink" : "text-fg")}>
                {label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-2 text-sm">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gold text-sm font-semibold text-gold-ink" aria-hidden="true">{view.name.slice(0, 1)}</span>
              <span className="font-medium">{view.name}</span>
            </span>
            <button type="button" className="min-h-10 rounded-card border border-line px-3 text-sm" onClick={() => { sessionStorage.removeItem(SECTION_KEY); writeSession(null); navigate({ to: "/" }); }}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="px-4 py-6 md:px-8">
        {error ? <p className="mb-4 text-sm text-bad">{error}</p> : null}
        {section === "home" ? <Home view={view} /> : null}
        {section === "pay" ? <Pay view={view} busy={busy} onPay={(payee, amount, direction) => run(() => payFn({ data: { id: view.id, payee, amount, direction } }))} /> : null}
        {section === "goals" ? (
          <Goals
            view={view}
            busy={busy}
            onSave={(goal) => run(() => goalFn({ data: { id: view.id, ...goal } }))}
            onOpen={(goalId) =>
              run(async () => {
                const next = await openFn({ data: { id: view.id, goalId } });
                if (next.enrolled) setSection("advisor");
                return next;
              })
            }
            onReset={() => run(() => resetFn({ data: { id: view.id } }))}
            onRemove={(goalId) => run(() => removeFn({ data: { id: view.id, goalId } }))}
          />
        ) : null}
        {section === "advisor" && view.enrolled ? (
          <FundWorkbench
            view={view}
            busy={busy}
            onWrite={() => run(() => writeFn({ data: { id: view.id } }))}
            onJudge={() => run(() => judgeFn({ data: { id: view.id } }))}
            onShip={() => run(() => shipFn({ data: { id: view.id } }))}
            onCheck={() => run(() => checkFn({ data: { id: view.id } }))}
            onRecheckJudge={() => run(() => recheckFn({ data: { id: view.id } }))}
            onReplace={() => run(() => replaceFn({ data: { id: view.id } }))}
            onKeep={() => run(() => keepFn({ data: { id: view.id } }))}
            onAccept={() => run(() => acceptFn({ data: { id: view.id } }))}
            onMix={(rule) => run(() => mixFn({ data: { id: view.id, up: { cash: Math.round(rule.up.cash * 100), bond: Math.round(rule.up.bond * 100), equity: Math.round(rule.up.equity * 100) }, down: { cash: Math.round(rule.down.cash * 100), bond: Math.round(rule.down.bond * 100), equity: Math.round(rule.down.equity * 100) } } }))}
          />
        ) : null}
      </main>
      {view.advisorOffer && view.goal ? (
        <div className="fixed inset-x-0 top-0 z-10 flex justify-center p-4 sm:justify-end">
          <article className="w-full max-w-md rounded-card border border-line bg-surface p-5 shadow-xl">
            <p className="text-xs tracking-widest text-muted uppercase">New from Mango Bank</p>
            <h2 className="mt-2 font-serif text-2xl">Fund Advisor for {view.goal.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              You are adding {money(view.goal.monthly)} a month. A fixed program could use one mix for every customer. Fund Advisor writes a new allocate() for this goal, then the bank tests that file. Nothing is invested until it beats a human mix on markets it has not seen.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-11 rounded-card bg-gold px-4 text-sm font-semibold text-gold-ink"
                onClick={() =>
                  run(async () => {
                    const next = await enrollFn({ data: { id: view.id } });
                    setSection("advisor");
                    return next;
                  })
                }
              >
                Open Fund Advisor
              </button>
              <button type="button" className="min-h-11 rounded-card border border-line px-4 text-sm" onClick={() => run(() => declineFn({ data: { id: view.id } }))}>
                Not now
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}

function Home({ view }: { view: RetailView }) {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-muted">Good afternoon</p>
      <h1 className="font-serif text-4xl">{view.name.split(" ")[0]}</h1>
      <article className="mt-6 rounded-card border border-line bg-surface p-5">
        <p className="text-sm text-muted">{view.account}</p>
        <p className="mt-1 font-serif text-5xl">{money(view.cash)}</p>
        <p className="mt-2 text-sm text-muted">Available balance</p>
      </article>
      {view.goals.length ? (
        <article className="mt-4 rounded-card border border-line bg-surface p-5">
          <p className="text-xs tracking-widest text-muted uppercase">Goals</p>
          <ul className="mt-2 divide-y divide-line">
            {view.goals.map((goal) => (
              <li key={goal.id} className="py-2 text-sm">
                {goal.name}. {money(goal.target)} in {goal.months} months, adding {money(goal.monthly)} a month.
                {goal.id === view.activeGoalId ? (view.shipped ? " Fund Advisor’s file is live." : view.enrolled ? " Fund Advisor is on." : "") : ""}
              </li>
            ))}
          </ul>
        </article>
      ) : null}
      <h2 className="mt-8 text-sm font-semibold tracking-wide text-muted uppercase">Transactions</h2>
      <ul className="mt-2 divide-y divide-line rounded-card border border-line bg-surface">
        {view.txns.map((txn) => (
          <li key={txn.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>
              {txn.label}
              <span className="mt-0.5 block text-muted">{txn.daysAgo === 0 ? "Today" : `${txn.daysAgo} days ago`}</span>
            </span>
            <span className={txn.amount > 0 ? "font-semibold text-good" : "font-semibold"}>
              {txn.amount > 0 ? "+" : "−"}
              {money(Math.abs(txn.amount))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Goals({
  view,
  busy,
  onSave,
  onOpen,
  onReset,
  onRemove,
}: {
  view: RetailView;
  busy: boolean;
  onSave: (goal: { name: string; target: number; months: number; monthly: number }) => void;
  onOpen: (goalId: string) => void;
  onReset: () => void;
  onRemove: (goalId: string) => void;
}) {
  const preset = view.id === "sam" ? ["Studio gear", "8000", "12", "500"] : ["House deposit", "20000", "18", "1000"];
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(preset[0]);
  const [target, setTarget] = useState(preset[1]);
  const [months, setMonths] = useState(preset[2]);
  const [monthly, setMonthly] = useState(preset[3]);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">Goals</h1>
          <p className="mt-2 text-sm text-muted">Nothing is invested by adding a goal.</p>
        </div>
        <button type="button" className="min-h-11 rounded-card bg-gold px-4 text-sm font-semibold text-gold-ink" onClick={() => setOpen(true)}>
          Add a goal
        </button>
      </div>
      {view.goals.length ? (
        <ul className="mt-6 divide-y divide-line rounded-card border border-line bg-surface">
          {view.goals.map((goal) => (
            <li key={goal.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div>
                <p className="font-medium">{goal.name}</p>
                <p className="mt-1 text-sm text-muted">{money(goal.target)} in {goal.months} months · {money(goal.monthly)} a month</p>
                <p className="mt-1 text-sm text-muted">{goal.id === view.activeGoalId && view.shipped ? "Fund Advisor file is live" : goal.id === view.activeGoalId && view.enrolled ? "Open in Fund Advisor" : "Not invested"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} className="min-h-11 rounded-card border border-line px-4 text-sm disabled:opacity-40" onClick={() => onOpen(goal.id)}>
                  {view.enrolled && goal.id === view.activeGoalId ? "Open Fund Advisor" : "Use this goal"}
                </button>
                {goal.id === view.activeGoalId && view.enrolled ? (
                  <button type="button" disabled={busy} className="min-h-11 rounded-card border border-line px-4 text-sm disabled:opacity-40" onClick={onReset}>
                    Reset Fund Advisor goal
                  </button>
                ) : null}
                <button type="button" disabled={busy} className="min-h-11 rounded-card border border-line px-4 text-sm disabled:opacity-40" onClick={() => onRemove(goal.id)}>
                  Remove goal
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-card border border-dashed border-line px-4 py-8 text-sm text-muted">No goals yet.</p>
      )}
      {open ? (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-[#102033]/40 p-4 sm:items-center">
          <form
            className="w-full max-w-md rounded-card bg-surface p-5"
            onSubmit={(event) => {
              event.preventDefault();
              onSave({ name, target: Number(target), months: Number(months), monthly: Number(monthly) });
              setOpen(false);
            }}
          >
            <h2 className="font-serif text-2xl">Add a goal</h2>
            <label className="mt-4 block text-sm">
              Goal name
              <input className="mt-1 min-h-11 w-full rounded-card border border-line bg-surface px-3" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="mt-3 block text-sm">
              Amount you want
              <input className="mt-1 min-h-11 w-full rounded-card border border-line bg-surface px-3" type="number" value={target} onChange={(event) => setTarget(event.target.value)} />
            </label>
            <label className="mt-3 block text-sm">
              Months
              <input className="mt-1 min-h-11 w-full rounded-card border border-line bg-surface px-3" type="number" value={months} onChange={(event) => setMonths(event.target.value)} />
            </label>
            <label className="mt-3 block text-sm">
              Added each month
              <input className="mt-1 min-h-11 w-full rounded-card border border-line bg-surface px-3" type="number" value={monthly} onChange={(event) => setMonthly(event.target.value)} />
            </label>
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={busy} className="min-h-11 rounded-card bg-gold px-4 text-sm font-semibold text-gold-ink disabled:opacity-40">Save goal</button>
              <button type="button" className="min-h-11 rounded-card border border-line px-4 text-sm" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Pay({ view, busy, onPay }: { view: RetailView; busy: boolean; onPay: (payee: string, amount: number, direction: "in" | "out") => void }) {
  const [payee, setPayee] = useState("Payroll");
  const [amount, setAmount] = useState("1000");
  const [direction, setDirection] = useState<"in" | "out">("in");
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-serif text-4xl">Pay</h1>
      <p className="mt-2 text-sm text-muted">From {view.account}. This posts a transaction. It does not call Fund Advisor.</p>
      <div className="mt-6 flex gap-2">
        <button type="button" className={"min-h-11 rounded-card px-4 text-sm " + (direction === "in" ? "bg-gold text-gold-ink" : "border border-line")} onClick={() => setDirection("in")}>Receive</button>
        <button type="button" className={"min-h-11 rounded-card px-4 text-sm " + (direction === "out" ? "bg-gold text-gold-ink" : "border border-line")} onClick={() => setDirection("out")}>Send</button>
      </div>
      <label className="mt-4 block text-sm">
        {direction === "in" ? "From" : "To"}
        <input className="mt-1 min-h-11 w-full rounded-card border border-line bg-surface px-3" value={payee} onChange={(event) => setPayee(event.target.value)} />
      </label>
      <label className="mt-3 block text-sm">
        Amount
        <input className="mt-1 min-h-11 w-full rounded-card border border-line bg-surface px-3" type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <button type="button" disabled={busy} className="mt-4 min-h-11 rounded-card bg-gold px-4 text-sm font-semibold text-gold-ink disabled:opacity-40" onClick={() => onPay(payee, Number(amount), direction)}>
        {direction === "in" ? "Post deposit" : "Send payment"}
      </button>
    </div>
  );
}
