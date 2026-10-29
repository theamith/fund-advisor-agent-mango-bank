import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MangoWordmark } from "@/components/mango-mark";
import { RETAIL_LOGINS, writeSession } from "@/lib/demo-session";

export function RetailLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = RETAIL_LOGINS.find((row) => row.username === username.trim().toLowerCase() && row.password === password);
    if (!found) {
      setError("That username and password do not match.");
      return;
    }
    writeSession(found.id);
    navigate({ to: "/account" });
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between bg-gold px-10 py-12 text-gold-ink lg:flex">
        <MangoWordmark light />
        <p className="max-w-sm text-lg leading-relaxed">Everyday banking for checking, payments, and the money you have not decided what to do with yet.</p>
      </section>
      <section className="flex items-center px-6 py-12">
        <form onSubmit={submit} className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <MangoWordmark />
          </div>
          <h1 className="mt-2 font-serif text-3xl">Sign in</h1>
          <label className="mt-6 block text-sm">
            Username
            <input className="mt-1 min-h-11 w-full rounded-card border border-line bg-surface px-3" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="mt-3 block text-sm">
            Password
            <input className="mt-1 min-h-11 w-full rounded-card border border-line bg-surface px-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p className="mt-3 text-sm text-bad">{error}</p> : null}
          <button type="submit" className="mt-5 min-h-11 w-full rounded-card bg-gold text-sm font-semibold text-gold-ink">
            Sign in
          </button>
                  </form>
      </section>
    </main>
  );
}
