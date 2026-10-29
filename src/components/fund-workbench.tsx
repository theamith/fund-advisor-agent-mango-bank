import { useMemo, useRef, useState } from "react";
import { flight, SCENARIOS, endValue, hitMonth, distance, anyBreach, payAt, runPath, applyRule, ruleBreach, type ScenarioId, type MixRule, type Weights } from "@/lib/fund";
import type { RetailView } from "@/lib/bank-types";

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function FundWorkbench({
  view,
  busy,
  onWrite,
  onJudge,
  onShip,
  onCheck,
  onRecheckJudge,
  onReplace,
  onKeep,
  onAccept,
  onMix,
}: {
  view: RetailView;
  busy: boolean;
  onWrite: () => void;
  onJudge: () => void;
  onShip: () => void;
  onCheck: () => void;
  onRecheckJudge: () => void;
  onReplace: () => void;
  onKeep: () => void;
  onAccept: () => void;
  onMix: (rule: MixRule) => void;
}) {
  const [scenario, setScenario] = useState<ScenarioId>("falling");
  const meta = SCENARIOS.find((item) => item.id === scenario)!;
  const pay = (index: number) => (view.goal ? payAt(view.goal, index, view.pace, view.paceAccepted) : 0);
  const paths = useMemo(() => (view.goal ? flight(view.goal, scenario, view.version, pay) : null), [view.goal, view.version, view.pace, view.paceAccepted, scenario]);
  const proposal = useMemo(() => (view.goal && view.rule ? runPath(view.goal, scenario, (history) => applyRule(view.rule!, history), pay) : null), [view.goal, view.rule, view.pace, view.paceAccepted, scenario]);
  const active = proposal ?? (paths ? (view.version >= 4 ? paths.improved! : view.version === 3 ? paths.blocked! : view.version >= 2 ? paths.judged! : view.version === 1 ? paths.candidate! : paths.human) : null);
  const limit = view.rule ? ruleBreach(view.rule) : active ? anyBreach(active) : null;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
      <section>
        <p className="text-xs tracking-widest text-muted uppercase">Fund Advisor</p>
        <h1 className="font-serif text-4xl">{view.goal ? view.goal.name : "No goal yet"}</h1>
        {view.goal ? (
          <p className="mt-2 text-sm text-muted">
            Add {money(view.goal.monthly)} a month for {view.goal.months} months, aiming at {money(view.goal.target)}. Nothing is invested until you turn a mix on.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">Add a goal first. Fund Advisor does not invest it.</p>
        )}
        <div className="mt-4">
          {view.version === 0 ? (
            <span className="inline-flex items-center gap-2">
              <button type="button" disabled={busy || !view.goal} className="min-h-11 rounded-card bg-gold px-4 text-sm font-semibold text-gold-ink disabled:opacity-40" onClick={onWrite}>
                {busy ? "Working…" : "Suggest a mix"}
              </button>
              <Hint text="Suggest a mix and Improve this mix call AI. The chart, the three checks, and Use this mix do not. The key stays on the server and is not sent to this page." />
            </span>
          ) : null}
          {view.version === 1 ? (
            <span className="inline-flex items-center gap-2">
              <button type="button" disabled={busy} className="min-h-11 rounded-card bg-gold px-4 text-sm font-semibold text-gold-ink disabled:opacity-40" onClick={onJudge}>
                {busy ? "Reviewing…" : "Review this mix"}
              </button>
              <Hint text="A second step, which did not write the first mix, suggests a safer split. It still has to pass the checks." />
            </span>
          ) : null}
          {view.version >= 2 && view.version < 3 && !view.shipped ? (
            <span className="inline-flex items-center gap-2">
              <button type="button" disabled={busy || !view.report?.ship} className="min-h-11 rounded-card bg-gold px-4 text-sm font-semibold text-gold-ink disabled:opacity-40" onClick={onShip}>
                {busy ? "Turning on…" : "Use this mix"}
              </button>
              <Hint text="Turns this split on for later months. It stays off unless the three checks pass. No money moves today." />
            </span>
          ) : null}
          {view.shipped && view.phase === "ready" ? (
            <span className="inline-flex items-center gap-2">
              <button type="button" disabled={busy} className="min-h-11 rounded-card bg-gold px-4 text-sm font-semibold text-gold-ink disabled:opacity-40" onClick={onCheck}>
                {busy ? "Checking…" : "Check the next month"}
              </button>
              <Hint text="Looks at the balance so far and suggests a new mix. The mix already on stays until the new one passes the same checks." />
            </span>
          ) : null}
          {view.phase === "fail" ? (
            <span className="inline-flex items-center gap-2">
              <button type="button" disabled={busy} className="min-h-11 rounded-card bg-gold px-4 text-sm font-semibold text-gold-ink disabled:opacity-40" onClick={onRecheckJudge}>
                {busy ? "Improving…" : "Improve this mix"}
              </button>
              <Hint text="Asks for a safer split after the suggestion failed a check. This calls AI. The checks do not." />
            </span>
          ) : null}
          {view.phase === "pass" && view.report?.ship ? (
            <button type="button" disabled={busy} className="min-h-11 rounded-card bg-gold px-4 text-sm font-semibold text-gold-ink disabled:opacity-40" onClick={onReplace}>
              {busy ? "Switching…" : "Switch to this mix"}
            </button>
          ) : null}
          {view.phase === "pass" && !view.report?.ship ? (
            <button type="button" disabled={busy} className="min-h-11 rounded-card border border-line px-4 text-sm disabled:opacity-40" onClick={onKeep}>
              Keep the current mix
            </button>
          ) : null}
          {view.shipped && view.phase === "ready" && view.elapsed === 0 ? <p className="mt-2 text-sm text-good">This mix is on. Later months use it until a new one does better.</p> : null}
          {view.phase === "fail" ? <p className="mt-2 text-sm text-bad">This suggestion is blocked. The mix already on is unchanged.</p> : null}
          {view.phase === "pass" && view.report?.ship ? <p className="mt-2 text-sm text-muted">This mix passed. Switch to it, or it is not used.</p> : null}
          {view.phase === "pass" && !view.report?.ship ? <p className="mt-2 text-sm text-muted">This mix stays off. The one already on is unchanged.</p> : null}
          {view.outcome === "goal" ? <p className="mt-2 text-sm text-good">You reached the goal at month {view.elapsed}.</p> : null}
          {view.outcome === "tenure" ? <p className="mt-2 text-sm text-muted">The {view.goal?.months} months are over. Balance {view.pace ? money(view.pace.balance) : ""}. The mix stops.</p> : null}
          {view.version === 1 && view.report && !view.report.level1.pass ? <p className="mt-2 text-sm text-muted">Equity is over 70%, or the shares do not add to 100%. Review this mix can try a legal split. Nothing turns on yet.</p> : null}
          {view.version === 1 && view.report?.level1.pass && !view.report.level3.pass ? <p className="mt-2 text-sm text-muted">The safety limit passed. The exam markets did not, so this mix stays off.</p> : null}
          {view.version === 2 && !view.shipped && view.report && !view.report.ship ? <p className="mt-2 text-sm text-bad">Use this mix stays off. It did not beat an even split on the markets it was not shown, or it is over the safety limit.</p> : null}
        </div>
        {view.pace && view.goal && !view.outcome ? (
          <article className="mt-4 rounded-card border border-line bg-surface p-4">
            <p className="text-xs tracking-widest text-muted uppercase">Before the next investment</p>
            <p className="mt-2 text-sm">Month {view.pace.month} of {view.goal.months}. Your goal balance is {money(view.pace.balance)}. To reach {money(view.goal.target)} without counting on a rising market, you would add {money(view.pace.needed)} a month from here. You are adding {money(view.goal.monthly)}.</p>
            <p className="mt-2 text-sm text-muted">That balance is the mix already on. The green line is the new suggestion, drawn on the market selected on the right. They are not the same number.</p>
            <p className="mt-2 text-sm text-muted">The mix cannot change how much you add. You can accept the new amount, or leave it.</p>
            {view.paceAccepted ? (
              <p className="mt-3 text-sm text-good">From month {view.pace.month + 1} the chart uses {money(view.pace.needed)}. The mix did not set that number.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy} className="min-h-11 rounded-card border border-line px-4 text-sm disabled:opacity-40" onClick={onAccept}>
                  Add {money(view.pace.needed)} from month {view.pace.month + 1}
                </button>
              </div>
            )}
          </article>
        ) : null}
        {view.rule ? <MixEditor rule={view.rule} busy={busy} onSave={onMix} /> : null}
        {view.report ? <Tests report={view.report} shipped={view.shipped} /> : null}
      </section>
      <section>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Markets">
          {SCENARIOS.map((item) => (
            <button key={item.id} type="button" onClick={() => setScenario(item.id)} className={"min-h-11 rounded-card px-3 text-left text-sm " + (scenario === item.id ? "bg-gold text-gold-ink" : "border border-line bg-surface")}>
              <span className="block">{item.label}</span>
              <span className={"block text-xs " + (scenario === item.id ? "text-gold-ink" : "text-muted")}>{item.heldout ? "Not shown to the suggestion" : "What the suggestion could study"}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">{meta.hint}</p>
        {paths && view.goal && active ? (
          <>
            <FlightChart goal={view.goal.target} paths={paths} proposal={proposal} now={view.pace?.month ?? null} />
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Tile label="Best possible" hint="Puts everything in whichever of cash, bond, or equity did best that month. It knows the future, so it is a ceiling, not a mix you can turn on." value={money(endValue(paths.ideal))} detail={hitLabel(hitMonth(paths.ideal, view.goal.target))} />
              <Tile label="Even split" hint="Half cash and half equity every month. This is the bank's starting point. A suggestion has to finish closer to the best possible line than this." value={money(endValue(paths.human))} detail={`${money(distance(paths.human, paths.ideal))} from the best possible`} />
              <Tile label="Your mix" hint="The split on the left, and how far its ending is from the best possible line." value={view.version === 0 ? "—" : money(endValue(active))} detail={view.version === 0 ? "No suggestion yet" : `${money(distance(active, paths.ideal))} from the best possible`} />
              <Tile label="Safety limit" hint="Equity has to stay at or under 70%, and the shares have to add up to 100%. Fail means this mix is not allowed, even if the line looks good." value={limit ? "Over the limit" : "Within the limit"} detail={limit === "Equity is above the 70% rail." ? "Equity is above 70%." : limit || "Equity stayed at or under 70%."} />
            </div>
          </>
        ) : (
          <p className="mt-6 text-sm text-muted">Save a goal to draw the flight.</p>
        )}
      </section>
    </div>
  );
}

function hitLabel(month: number | null) {
  return month ? `Crosses the goal in month ${month}` : "Does not reach the goal";
}

function Tile({ label, hint, value, detail }: { label: string; hint: string; value: string; detail: string }) {
  return (
    <article className="rounded-card border border-line bg-surface p-3">
      <p className="text-xs tracking-widest text-muted uppercase">{label} <Hint text={hint} /></p>
      <p className="mt-1 font-serif text-2xl">{value}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </article>
  );
}

function Tests({ report, shipped }: { report: RetailView["report"]; shipped: boolean }) {
  if (!report) return null;
  return (
    <div className="mt-4 space-y-3">
      <TestRow name="Is this mix allowed?" hint="The shares have to add up to 100%, and equity cannot be over 70%." pass={report.level1.pass} detail={report.level1.detail} />
      <TestRow name="Did it use only your goal?" hint="The suggestion was built from your goal and the Rising market only. No other customer was included." pass={report.level2.pass} detail={report.level2.steps.join(" ")} />
      <TestRow name="Is it better on markets it has not seen?" hint="Falling and Rate shock were kept back. This mix has to end closer to the best possible line than an even split." pass={report.level3.pass} detail={report.level3.detail} />
      <p className="text-sm">{shipped ? "This mix is on. Later months use it. AI is not called." : report.ship ? "You can turn this mix on." : "This mix stays off."}</p>
    </div>
  );
}

function TestRow({ name, hint, pass, detail }: { name: string; hint: string; pass: boolean; detail: string }) {
  return (
    <article className="rounded-card border border-line bg-surface p-3">
      <p className={"text-sm font-semibold " + (pass ? "text-good" : "text-bad")}>{name} <Hint text={hint} /> · {pass ? "pass" : "needs a change"}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </article>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" className="grid h-4 w-4 place-items-center rounded-full border border-line text-[10px] font-normal normal-case tracking-normal text-muted" aria-label={text}>i</button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-64 -translate-x-1/2 rounded-card border border-line bg-surface p-2 text-left text-xs font-normal normal-case tracking-normal text-muted shadow group-hover:block group-focus-within:block">{text}</span>
    </span>
  );
}

function shares(weights: Weights) {
  return { cash: String(Math.round(weights.cash * 100)), bond: String(Math.round(weights.bond * 100)), equity: String(Math.round(weights.equity * 100)) };
}

function MixEditor({ rule, busy, onSave }: { rule: MixRule; busy: boolean; onSave: (rule: MixRule) => void }) {
  const [up, setUp] = useState(shares(rule.up));
  const [down, setDown] = useState(shares(rule.down));
  const draft = useRef({ up, down });
  const same = rule.up.cash === rule.down.cash && rule.up.bond === rule.down.bond && rule.up.equity === rule.down.equity;
  const signature = `${rule.up.cash}:${rule.up.bond}:${rule.up.equity}:${rule.down.cash}:${rule.down.bond}:${rule.down.equity}`;
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    const next = { up: shares(rule.up), down: shares(rule.down) };
    draft.current = next;
    setSeen(signature);
    setUp(next.up);
    setDown(next.down);
  }
  function commit() {
    const read = (row: { cash: string; bond: string; equity: string }) => ({
      cash: Number(row.cash) / 100,
      bond: Number(row.bond) / 100,
      equity: Number(row.equity) / 100,
    });
    const parsedUp = read(draft.current.up);
    const parsedDown = read(draft.current.down);
    if ([parsedUp.cash, parsedUp.bond, parsedUp.equity, parsedDown.cash, parsedDown.bond, parsedDown.equity].some((part) => !Number.isFinite(part))) return;
    onSave({ up: parsedUp, down: same ? parsedUp : parsedDown });
  }
  return (
    <article className="mt-4 rounded-card border border-line bg-surface p-4">
      <p className="text-sm font-medium">Suggested mix <Hint text="Cash, bond, and equity as shares of each month's deposit. Leave the field and the checks run again. They do not call AI." /></p>
      <MixRow
        label={same ? "Every month" : "Most months"}
        values={up}
        busy={busy}
        onChange={(next) => {
          draft.current = { ...draft.current, up: next };
          setUp(next);
        }}
        onBlur={commit}
      />
      {same ? null : (
        <MixRow
          label="After a drop"
          values={down}
          busy={busy}
          onChange={(next) => {
            draft.current = { ...draft.current, down: next };
            setDown(next);
          }}
          onBlur={commit}
        />
      )}
    </article>
  );
}

function MixRow({
  label,
  values,
  busy,
  onChange,
  onBlur,
}: {
  label: string;
  values: { cash: string; bond: string; equity: string };
  busy: boolean;
  onChange: (next: { cash: string; bond: string; equity: string }) => void;
  onBlur: () => void;
}) {
  const fields = [
    ["cash", "Cash"],
    ["bond", "Bond"],
    ["equity", "Equity"],
  ] as const;
  return (
    <div className="mt-3">
      <p className="text-xs tracking-widest text-muted uppercase">{label}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {fields.map(([key, name]) => (
          <label key={key} className="text-sm">
            {name}
            <input
              className="mt-1 min-h-11 w-full rounded-card border border-line px-2"
              type="number"
              min={0}
              max={100}
              disabled={busy}
              value={values[key]}
              onChange={(event) => onChange({ ...values, [key]: event.target.value })}
              onBlur={onBlur}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function FlightChart({
  goal,
  paths,
  proposal,
  now,
}: {
  goal: number;
  paths: NonNullable<ReturnType<typeof flight>>;
  proposal: { month: number; value: number }[] | null;
  now: number | null;
}) {
  const width = 640;
  const height = 280;
  const pad = { l: 48, r: 16, t: 16, b: 28 };
  const series = [paths.ideal, paths.human, proposal].filter((path): path is NonNullable<typeof path> => Boolean(path));
  const max = Math.max(goal, ...series.flatMap((path) => path.map((point) => point.value)));
  const months = paths.ideal.length;
  const ticks = Array.from({ length: months }, (_, index) => index + 1).filter((month) => month === 1 || month === months || month % 3 === 0);
  const x = (month: number) => pad.l + ((month - 1) / Math.max(1, months - 1)) * (width - pad.l - pad.r);
  const y = (value: number) => pad.t + (1 - value / max) * (height - pad.t - pad.b);
  const line = (path: { month: number; value: number }[]) => path.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.month).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  return (
    <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[32rem]" role="img" aria-label="Goal progress by month">
        <line x1={pad.l} y1={y(goal)} x2={width - pad.r} y2={y(goal)} stroke="#12355b" strokeDasharray="2 4" />
        <text x={pad.l} y={y(goal) - 4} fontSize="11" fill="#12355b">Goal</text>
        <path d={line(paths.ideal)} fill="none" stroke="#5c6b7a" strokeWidth="2" strokeDasharray="6 4" />
        <path d={line(paths.human)} fill="none" stroke="#9f2d2d" strokeWidth="2" />
        {proposal ? <path d={line(proposal)} fill="none" stroke="#0f7a4a" strokeWidth="2.5" /> : null}
        {now ? <line x1={x(now)} y1={pad.t} x2={x(now)} y2={height - pad.b} stroke="#12355b" strokeDasharray="2 3" /> : null}
        {ticks.map((month) => (
          <text key={month} x={x(month)} y={height - 8} fontSize="11" fill="#5c6b7a" textAnchor={month === 1 ? "start" : month === months ? "end" : "middle"}>
            {month}
          </text>
        ))}
      </svg>
      <p className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        <span>Dashed · best possible, saw the future</span>
        <span className="text-bad">Even split</span>
        {proposal ? <span className="text-good">Your mix</span> : null}
      </p>
    </div>
  );
}
