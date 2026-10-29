# Notes

Open three browser tabs before you start. Leave them signed in. The story is one customer, then proof that a second customer is separate, then the bank side that decides what is allowed to go live.

| Tab | Address | Sign in |
|---|---|---|
| Maya | http://localhost:8080 | `maya` / `mango` |
| Sam | http://localhost:8080 | `sam` / `mango` |
| Operations | http://localhost:8080/admin | `ops` / `mango` |

If the model key is missing, the buttons still work. The screen uses a saved rehearsal split, and the operations audit says the model was not called. Say that out loud if a live call fails.

Nothing on these screens moves real money. A goal is a plan. A mix is three shares of the monthly amount: cash, bond, and equity.

## What you are showing

A model may write a split. Ordinary code decides whether the bank may use it.

1. The shares must add up to 100 percent, and equity must stay at or under 70 percent.
2. The suggestion may only see this customer and a small rising-market sample.
3. On two markets it was not shown, it has to finish closer to a perfect-hindsight line than a plain half-and-half split.

A later suggestion also has to beat the mix already turned on. If it does not, the old one stays.

## Tab 1 — Maya

### Sign in

The login page has no passwords on it. That is on purpose.

Say: “This is the retail app. Maya signs in the way any customer would. The bank staff use a different address.”

### Accounts

You land on **Accounts**.

- The large number is the checking balance. It is not the goal, and it is not invested.
- **Transactions** are ordinary account history. Green amounts came in. The others went out.
- If a goal exists, a short list sits under the balance. “Fund Advisor is on” means she opened it. “Fund Advisor’s file is live” means a mix passed the checks and was turned on.

Say: “The advisor does not read this balance and spend it. The customer chooses a monthly amount. The model only suggests how to split that amount.”

### Pay

Open **Pay**.

- **To** is the name on the new transaction.
- **Amount** is dollars.
- **Pay** takes money out. **Receive** puts money in.
- A payment larger than the balance is refused. The balance is not silently cut to zero.

Say: “This is a normal bank action. Fund Advisor does not approve it, and it does not change the mix.”

Go back to **Accounts** and point at the new line so the room sees it landed.

### Goals

Open **Goals**. The page says nothing is invested by adding a goal.

Click **Add a goal**. Maya’s form is already filled:

| Field | What you say |
|---|---|
| Goal name | House deposit. A label, not a product. |
| Amount you want | $20,000. The target line on the chart. |
| Months | 18. How long the plan runs. |
| Added each month | $1,000. The deposit. The model cannot change this number. |

Click **Save goal**.

A card appears: **New from Mango Bank**, **Fund Advisor for House deposit**.

Say: “The bank is offering a tool, not moving money. A fixed program could use one mix for every customer. This one writes a split for this goal, and the bank tests it before it can be turned on.”

Click **Open Fund Advisor**. **Not now** only dismisses the card. You can still open the goal later with **Use this goal**.

The top menu gains **Fund Advisor**.

On the goals list, while this goal is the one in the advisor:

- **Open Fund Advisor** returns to the tool.
- **Reset Fund Advisor goal** clears the mix and the checks. The goal itself stays. Use this if you want to run the story again.
- **Remove goal** deletes the goal.

## Fund Advisor — walk the screen before you click

Left side is the decision. Right side is the picture.

Under the title: she adds $1,000 a month for 18 months, aiming at $20,000. Nothing is invested until a mix is turned on.

The **i** next to a control is a short definition. Hover it if someone asks what a button does.

### Markets, on the right

Three buttons. The chart starts on **Falling**.

| Button | What you say |
|---|---|
| Rising | “What the suggestion could study.” The first call is allowed to see four months of this, and only the equity numbers. |
| Falling | “Not shown to the suggestion.” A drop in the middle of the year. This is an exam. |
| Rate shock | “Not shown to the suggestion.” Bonds and stocks fall together. This is the other exam. |

These tables are written in the code. They are not a live market feed, and they are not a downloaded history. Each click of a market redraws the same chart. No model call.

### The lines

| Line | What you say |
|---|---|
| Horizontal | Her target. |
| Dashed | Best possible. Each month it puts everything in whichever of cash, bond, or equity already did best. It knows the future, so nobody can turn this mix on. It is a ceiling. |
| Red | Even split. Half cash, half equity, every month. No model. A suggestion has to finish closer to the dashed line than this, on the two exams. |
| Green | The suggestion currently on the left. It appears after the first model click. |

The four tiles under the chart:

- **Best possible** — ending value of the dashed line, and whether it crosses the goal.
- **Even split** — ending value of the red line, and how far it is from the dashed line.
- **Your mix** — ending value of the green line. Before a suggestion it is a dash.
- **Safety limit** — “Within the limit” or “Over the limit.” Equity over 70 percent fails even if the green line looks good. Both rows count: the normal month and the month after a drop.

Say: “Deposits alone may not reach the target. The test is not ‘did she hit $20,000.’ The test is ‘is this split allowed, and is it closer to the ceiling than the even split, on markets it never saw.’”

### The three checks, once they appear

They sit under the number boxes. They do not call the model.

1. **Is this mix allowed?** Shares add to 100 percent. Equity is at or under 70 percent.
2. **Did it use only your goal?** This customer, the rising sample only, the monthly amount unchanged, no other customer in the prompt.
3. **Is it better on markets it has not seen?** Falling and Rate shock. Closer to the dashed line than the even split. On a later month it also has to beat the mix already on.

Rising does not decide the pass. The model is not asked whether it passed.

## Maya — the clicks

### 1. Suggest a mix

This calls the model.

Say: “The prompt contains her goal and four rising equity numbers: 1.8 percent, four times. It does not contain Falling or Rate shock. The model is not trained on a price history. It is asked for three weights. Code reads those weights out of the reply.”

The number boxes are the reply, as percentages.

- One row, **Every month**, means the same split in every month.
- Two rows, **Most months** and **After a drop**, means a second split when the last three equity months sum to a loss.

Change a number, then click outside the field. The checks run again. That edit does not call the model.

If the reply is 100 percent equity, the first check fails. Say: “A strong line on Rising is not enough. Equity over 70 percent is blocked.”

**Use this mix** is not on the screen yet.

### 2. Review this mix

This is a second model call. It did not write the first split. It is shown the split on the screen, not the exam tables, and asked for a legal rewrite.

Say: “This is the judge. It does not grade its own homework, and it still cannot see Falling or Rate shock. The checks are outside the model.”

Read the three checks again. If they pass, **Use this mix** turns gold. If they do not, the button stays off. Say why, from the red check, not from the chart alone.

### 3. Use this mix

This does not call the model. It stores the numbers as the live split.

Say: “From here, later months use these numbers. The model is out of the path. If the model service is down tomorrow, this split still runs.”

The line under the button says the mix is on.

### 4. Check the next month

Each click moves **one** month. This is the stand-in for a monthly job.

A card appears: **Before the next investment**.

- **Month 1 of 18** is how far the plan has gone. The next click says month 2.
- **Your goal balance** is what the mix already on earned on the “already happened” table. It is not the green line.
- The green line is the **new** suggestion, drawn on the market selected on the right. Say that those two numbers are not supposed to match.
- The extra monthly amount is plain arithmetic: how much she would need to add to approach the target without assuming a rising market. The mix cannot set it. She can click the button to use that amount on the chart, or leave her $1,000.

The new suggestion goes through the same three checks. If it fails, the card says the suggestion is blocked and the mix already on is unchanged.

**Improve this mix** is the review step for this new suggestion. It calls the model again.

If the improved split passes and also beats the live one, **Switch to this mix** appears. That click replaces the live numbers. No model call.

If it is legal but not better than the one already on, **Keep the current mix** appears. Click it. The old split stays.

You can keep clicking **Check the next month** until the months run out or the goal is reached. You do not need to. One failed month and one improved month are enough.

## Tab 2 — Sam

Switch tabs. Do not sign Maya out.

Sam’s account is a different balance and a different transaction list.

**Goals** → **Add a goal**. His form is already **Studio gear**, **$8,000**, **12** months, **$500** a month.

Say: “$500 times 12 is $6,000. The target is $8,000. Even the dashed line may not reach $8,000. The point of the test is still the same: is the split allowed, and is it closer than half-and-half.”

Open Fund Advisor and click **Suggest a mix**.

Say: “His prompt has his goal and the same four rising numbers. Maya’s name, target, and monthly amount are not in it. The file is written under his name, not hers.”

You do not have to ship Sam. One suggestion is enough to show a second session.

## Tab 3 — Operations

This page is not the retail app. It refreshes on its own.

### The four tiles

| Tile | What you say |
|---|---|
| Policy runtime | Up. A mix that is already on does not call the model. Serving keeps working if the model is down. |
| Gemini configured | Yes or No. The key is not printed. It was read from the environment or from the server file. |
| Gemini success | Share of model calls that returned. “No calls” means you are on the rehearsal path. |
| Last model error | None, or the last failure. A failure does not turn off a mix that already shipped. |

### Agent sessions

Empty until someone adds a goal or opens Fund Advisor. After the demo you should see Maya and Sam as two rows.

For each person:

- Enrolled or not, the goal name, and whether a file is shipped.
- The server path of that person’s file. Maya’s path contains `maya`. Sam’s contains `sam`.
- The last model step, and whether it was a live call or the rehearsal.
- The same pass or fail as the three checks, plus how far the suggestion and the even split finished from the ideal on Falling and Rate shock.

Say: “Two sessions, two files. Sam’s row never shows Maya’s goal.”

### Audit

Every button that matters is a line: goal set, candidate written, review, shipped, next month, mix adjusted, payment.

A model step also shows **Request** and **Response**. The customer page does not get that text.

Open Maya’s request. Point at her goal and the four numbers. Point at the instruction that Falling and Rate shock are not included.

Open Sam’s request. Point at Studio gear and $500. Point at the absence of Maya.

Say: “The customer sees three percentages. The bank sees the prompt, the reply, and whether code allowed the file. That is the trust: the model can propose, and it cannot put itself into production.”

## If you need to start over

On Maya’s **Goals** page, **Reset Fund Advisor goal**. The goal remains. The mix, the checks, and the live file go back to the start. **Suggest a mix** is available again.

Signing out does not delete the goal. The session lives in that browser tab until the server process restarts.
