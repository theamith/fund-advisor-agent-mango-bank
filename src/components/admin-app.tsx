import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MangoWordmark } from "@/components/mango-mark";
import { getAdmin } from "@/lib/bank.functions";
import { ADMIN_LOGIN, readSession, writeSession, type Session } from "@/lib/demo-session";
import type { AdminView } from "@/lib/bank-types";

export function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => setSession(readSession()), []);
  if (session !== "admin") return <AdminLogin onIn={() => setSession("admin")} />;
  return (
    <Console
      onOut={() => {
        writeSession(null);
        setSession(null);
      }}
    />
  );
}

function AdminLogin({ onIn }: { onIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (username.trim().toLowerCase() !== ADMIN_LOGIN.username || password !== ADMIN_LOGIN.password) {
      setError("Operations credentials were not recognized.");
      return;
    }
    writeSession("admin");
    onIn();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-card border border-line bg-surface p-6">
        <MangoWordmark />
        <p className="mt-3 text-xs tracking-widest text-muted uppercase">Operations</p>
        <h1 className="mt-2 font-serif text-3xl">Staff sign in</h1>
        <p className="mt-2 text-sm text-muted">This address is not the retail app.</p>
        <label className="mt-5 block text-sm">
          Username
          <input className="mt-1 min-h-11 w-full rounded-card border border-line px-3" value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="mt-3 block text-sm">
          Password
          <input className="mt-1 min-h-11 w-full rounded-card border border-line px-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p className="mt-3 text-sm text-bad">{error}</p> : null}
        <button type="submit" className="mt-5 min-h-11 w-full rounded-card bg-gold text-sm font-semibold text-gold-ink">Sign in</button>
              </form>
    </main>
  );
}

function Console({ onOut }: { onOut: () => void }) {
  const load = useServerFn(getAdmin);
  const [view, setView] = useState<AdminView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    async function pull() {
      try {
        const next = await load({ data: null });
        if (!stop) setView(next);
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : "Could not load operations.");
      }
    }
    pull();
    const timer = window.setInterval(pull, 2000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [load]);

  return (
    <main className="min-h-screen px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <MangoWordmark />
          <p className="text-xs tracking-widest text-muted uppercase">Operations</p>
          <h1 className="font-serif text-4xl">Fund Advisor</h1>
        </div>
        <button type="button" className="min-h-11 text-sm text-muted" onClick={onOut}>
          Sign out
        </button>
      </header>
      {error ? <p className="mt-4 text-sm text-bad">{error}</p> : null}
      <p className="mt-4 max-w-2xl text-sm text-muted">A session appears after that customer adds a goal or opens Fund Advisor. Each session keeps its own file. Serving a shipped file does not call AI.</p>
      <section className="mt-6 grid gap-3 md:grid-cols-4">
        <Tile label="Policy runtime" value="Up" detail="Shipped files are served with zero model calls." />
        <Tile label="Gemini configured" value={view?.geminiConfigured ? "Yes" : "No"} detail="The key is read on the server from config/gemini.server.json. It is not shown here." />
        <Tile label="Gemini success" value={view ? (view.attempts ? `${Math.round((view.successes / view.attempts) * 100)}%` : "No calls") : "…"} detail={`${view?.successes ?? 0} of ${view?.attempts ?? 0} calls. Last ${view?.lastMs ?? 0} ms.`} />
        <Tile label="Last model error" value={view?.lastError ? "See detail" : "None"} detail={view?.lastError || "No failed call in this process."} />
      </section>
      <section className="mt-6">
        <h2 className="font-serif text-2xl">Agent sessions</h2>
        {view && view.customers.length === 0 ? <p className="mt-3 text-sm text-muted">No sessions yet.</p> : null}
        <ul className="mt-3 grid gap-4">
        {view?.customers.map((customer) => (
          <li key={customer.id}>
          <article className="rounded-card border border-line bg-surface p-5">
            <h2 className="font-serif text-2xl">{customer.name}</h2>
            <p className="text-sm text-muted">{customer.enrolled ? "Enrolled" : "Not enrolled"} · {customer.goal ? customer.goal.name : "No goal"} · {customer.live === 4 ? "Live file replaced" : customer.shipped ? "Shipped" : "Not shipped"}</p>
            <p className="mt-3 text-sm">{customer.path ?? "No file on the server yet."}</p>
            {customer.gemini ? <p className="mt-2 text-sm text-muted">Last model step: {customer.gemini.where}, {customer.gemini.source}.</p> : null}
            {customer.report ? (
              <ul className="mt-3 space-y-1 text-sm text-muted">
                <li>File check {customer.report.level1.pass ? "pass" : "fail"}. {customer.report.level1.detail}</li>
                <li>Held-out {customer.report.level3.pass ? "pass" : "fail"}. {customer.report.level3.detail}</li>
                {customer.report.level3.rows.filter((row) => row.heldout).map((row) => (
                  <li key={row.scenario}>{row.scenario}: agent is {row.agentGap} from ideal, human is {row.humanGap}.</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No test yet.</p>
            )}
          </article>
          </li>
        ))}
        </ul>
      </section>
      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="font-serif text-2xl">Audit</h2>
        <ul className="mt-3 divide-y divide-line">
          {view?.audit.length ? null : <li className="py-3 text-sm text-muted">No events yet.</li>}
          {view?.audit.map((row) => (
            <li key={row.id} className="py-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span>{row.who} · {row.action}</span>
                <span className="text-muted">{row.at}</span>
              </div>
              <p className="mt-1 text-muted">{row.detail}</p>
              {row.prompt ? (
                <div className="mt-2 grid gap-2">
                  <pre className="overflow-auto rounded-card border border-line bg-surface p-2 text-xs leading-relaxed text-muted">Request{"\n"}{row.prompt}</pre>
                  <pre className="overflow-auto rounded-card border border-line bg-surface p-2 text-xs leading-relaxed text-muted">Response{"\n"}{row.reply}</pre>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-card border border-line bg-surface p-4">
      <p className="text-xs tracking-widest text-muted uppercase">{label}</p>
      <p className="mt-2 font-serif text-3xl">{value}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </article>
  );
}
