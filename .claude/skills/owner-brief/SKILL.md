---
name: owner-brief
description: Write a brief or status update for the owner. Use whenever the owner asks for a brief, owner context, "where are we", a decision batch, or a status summary — and before surfacing any decision that needs their ruling. Rebuilds the context chain so a busy CPO can decide without remembering the engineering.
argument-hint: [topic or decision area, e.g. "sector contradictions" | "everything pending"]
---

# Owner brief

## The problem this exists to fix

The owner has the **authority** to decide and not the **context** to decide.

They set direction weeks ago, delegated the execution, and have been doing other things since. When a decision comes back to them they are not holding: what we agreed, why we agreed it, what got built, or what the finding invalidates. An engineer writing from inside the work forgets this and produces a brief that is *accurate and unusable* — dense with findings that presuppose the thread.

**The default failure is not being wrong. It is being unreadable to the person who has to act.**

## The four beats — every issue, every time

Each decision gets its own self-contained block with these four beats, in this order:

1. **Recall.** What was agreed, when, and why. *"You'll remember that back on 7 August we agreed all displayed holding weights should come from the filed figure rather than our own resolved book — because two different answers to 'what does this fund own' on one page is worse than a gap."*
2. **What we built.** What was done on the strength of that, and when. *"I built the pipeline that does that and ran it across the universe last week."*
3. **What we found.** The specific finding, with a number. *"Checking it, 3% of rows come out wrong — the foreign lines never get an identifier we can match, so they silently drop out."*
4. **The ask.** The decision, stated so it can be answered in a word, with a recommendation and the reason. *"The decision is whether to close that 3% with an explicit list of the affected securities, or a general rule that also sweeps in $880M of relabelling we didn't intend. I'd take the list — each entry is individually evidenced, which is what makes a list legitimate rather than a shortcut."*

A block missing beat 1 is the common failure. A block missing beat 4 is not a decision, it is a status update — file it elsewhere.

## Name the mechanism, not just the symptom

Beat 3 fails most often not by being wrong but by being **unexplained**. "Trades that never happened", "the filter rule", "a coverage gap" are labels, not explanations — and the owner cannot weigh a decision whose cause they can't picture.

**Test every finding against: "but how would that even happen?"** If the block doesn't answer it, it isn't finished.

> ✗ *"the filter is the only thing suppressing trades that never happened"*
> ✓ *"When a fund holds an ETF we look inside it to see the real shares. Some filers wrote the parent trust's identifier instead of the specific ETF's, so our lookup missed, we never opened the ETF, and the fund's whole portfolio collapsed to that one line at 99% of assets."*

The second is three sentences longer and is the difference between a decision they can make and one they have to take on trust.

Corollary: **never re-use a shorthand you coined without re-defining it.** "Phantom trades", "the twin", "the look-through" all read as established terms to the writer and as noise to the reader. If you named it, you owe the definition every time.

## Every count names its unit; every rule gets stated

Two failures that look small on the page and make a decision unmakeable.

**A bare number is not a fact.** "The rule reaches 9 of the 14 contradictions" — fourteen *what*?
Securities, holdings, funds, filings? The writer knows and the reader is guessing, and the size of
the problem is entirely different under each reading.

> ✗ *"9 of the 14 contradictions"*
> ✓ *"20 individual securities are served under two sector labels at once, across 2,580 holdings worth $8.2B. 14 of them are fixable by routing; the rule reaches 9 of those."*

**If the decision turns on a rule, state the rule — in plain words, every time.** Naming it
("the precedence rule", "B+G1", "the fill rule") is not stating it. One sentence, in the reader's
vocabulary, on every re-appearance. They will not carry it between briefs, and a decision about a
rule they can't see is a decision they have to take on faith.

> ✓ *"Treat a foreign-filed line and a US-filed line as the same company only when the international ID literally contains the US identifier, and the name on the filing matches the name our US source holds."*

**Related trap: check you are not describing two different problems as one.** A brief once said a
shipped rule "reaches 9 of 14" when that rule fixed a *different* defect — holdings with no label
at all — and the contradictions needed a second rule that had never been described. If a block
covers more than one mechanism, split it and say which fixed what.

## Re-source a number every time you re-use it

A figure carried forward across briefs stops being evidence and becomes folklore. **Before quoting any number you have quoted before, open the source again.**

This is not hypothetical: "funds showing trades that never happened" survived three briefs before anyone re-read the underlying commit, which said in its own second paragraph that **14 of the 24 rows were real**. The number was never checked because it had already been said.

Same rule as the zero-check discipline elsewhere in this project — a claim that has been repeated is not a claim that has been verified.

## Never fabricate a recall

Beat 1 is the highest-trust sentence in the brief and therefore the most damaging to get wrong. **Source every recall; never reconstruct one from memory.**

Sourceable records, in order of authority:
- `feature-pipeline/beta-execution-plan.md` → **§ Decision register** (answered, never re-ask), **§ The owner contract**, **§ LINE RULINGS**, and the dated run log (`- YYYY-MM-DD HH:MM — …`)
- `feature-pipeline/backlog.md` → item text and **Owner summary** lines
- `git log` for what shipped and when
- The memory directory for standing agreements

If you cannot source a recall, **say so plainly** — *"I don't have a record of us deciding this, so treat it as open"* — rather than asserting an agreement that may not have happened. A wrong recall makes the owner distrust everything under it.

Also distinguish, explicitly, three provenances that look identical on the page:
- **You decided this** (owner ruling — cite the date)
- **We decided this for you** (line ruling under delegated authority — say so, and say it is reversible)
- **Nobody has decided this** (genuinely open)

## Vocabulary: translate, don't cite

The owner does not hold our internal namespace. Every one of these is noise to them:

| Never write | Write instead |
|---|---|
| L14, D8-3, S7-4a, U2, F5 | "the sector contradictions", "the phantom-trade fix" |
| `fact_assembler.py:2574`, `eff_n_raw` | "the code that assembles what the page shows" — or omit |
| commit SHAs, branch names | "shipped last Tuesday" |
| "the checkpoint returned PASS-WITH-CORRECTIONS" | "the review passed but corrected four things" |
| "recoverable-missing" | "data we already have and simply aren't using" |
| "the twin" *(without reminder)* | "the cheapest ETF mix that behaves like this fund — what we call its twin" |

Reintroduce house jargon on first use in every brief. They coined some of it and still won't be holding it.

Use a **fund's name or ticker as the anchor**, not an internal id — "the fund that files 288 holdings and is shown as having one" is recallable; "JFEAX" alone is not. Give both.

## Structure

- **Lead with what changed since they last looked.** That is the only part they cannot reconstruct.
- **One decision per block, self-contained.** Assume they read out of order, or read only one, or come back a week later. Do not write "as described above."
- **Numbers earn their place; provenance does not.** "$540B across 1,808 funds" belongs. "Measured on the 2026-03-31 densest quarter via the ISIN-keyed bridge" belongs in the report, not the brief.
- **State what the finding invalidates.** A finding that changes nothing does not need the owner. If it invalidates a previous belief of theirs, that is the headline.
- **Corrections go early and plainly.** If a previous brief told them something wrong, say so in the first paragraph of that block — not buried, not softened. *"Two things I told you last week were wrong."*

## Before/after, from a real brief

**What I wrote** (accurate, unusable):

> The precedence rule you delegated reaches only 9 of the 14 S7-4a contradictions. The other 5 are the W1 cohort whose filed cusip isn't their embedded NSIN. Segment 4's fork: hard-code the 14, or go structural (reaches 9 but sweeps in 32 out-of-scope ISINs, 363 rows/$880M).

**What it should have been:**

> **You'll remember** that in early August we agreed sector labels come from one vendor for US-listed shares and another for international, because the two disagree and we needed a single rule. **In mid-August** I found the rule breaks for companies listed in both places — the same security gets two different sectors depending on which fund filed it, and the minority answer is simply wrong. **You delegated the fix to me** on the 20th and I shipped it: it now correctly labels $6.1B of holdings across 754 funds, and changes nothing that was already right.
>
> **What I found finishing it:** the rule reaches 9 of the 14 contradictions. The last 5 are securities whose filing uses a different identifier than the one embedded in their international code — reaching them means either naming those 5 explicitly, or a broader rule that also relabels $880M we never intended to touch, **including one security we told you was out of scope.**
>
> **The decision:** name them, or go broad, or leave 5 wrong. I'd name them — each is individually evidenced, and going broad would silently decide something we said we'd handle separately.

Same facts. The second one can be acted on by someone who has been doing other things for two weeks.

## Length and format

- **A single decision** → a few paragraphs in chat. No artifact.
- **A batch of decisions, or a "where are we"** → an artifact, so they can come back to it and share it. Load `artifact-design` first.
- Keep the whole thing skimmable: a busy reader should be able to get the shape from headings and bold alone, then drop into the one block they care about.
- **Never** open with process ("Five segments landed and all passed their checkpoints"). Open with what it means for the product or the decision.

## The cold read — do this before publishing, as a step, not a glance

The checklist below is not self-executing, and the failure it exists to catch is invisible from the inside. **You can always parse your own sentence, because you already know the answer.** "Trades that never happened" read as clear to me and as noise to the owner, and no amount of re-reading it *as the author* would have surfaced that.

So run an explicit pass over the finished draft in which you are **a competent person who has never seen this project**. For each block, ask three things and fix what fails:

1. **Could I explain the cause to a colleague after reading this once?** If the block gives an effect without a mechanism, it fails.
1b. **Do I know what every number counts, and what every named rule says?** A bare count or a rule referred to but never stated both fail here.
2. **Is there any noun phrase here I'd have to already know to understand?** House shorthand, a coined label, a metric name. Define or replace it.
3. **Do I know what I'm being asked and what happens under each option?** If the ask needs the reader to infer the consequence, it isn't written yet.

Any sentence that survives only because *you* wrote it gets rewritten.

## Before you publish, check

- [ ] Every decision block has all four beats, in order
- [ ] Every recall is sourced to a dated record — none invented
- [ ] Provenance is explicit: their ruling vs ours vs undecided
- [ ] Zero internal ids, file paths, or commit SHAs in the body
- [ ] Every jargon term is reintroduced on first use
- [ ] Any correction to a previous brief appears early and unhedged
- [ ] Each decision sentence can be answered in one word
- [ ] Each recommendation carries its *reason*, not just its verdict
- [ ] The opening says what changed, not what we did
- [ ] Every finding survives "but how would that even happen?" — mechanism, not label
- [ ] Every shorthand you coined is re-defined, even if you used it last week
- [ ] Every re-used number was re-opened at source, not carried forward
- [ ] Every count names its unit — "14" is never a fact, "14 securities across 2,580 holdings" is
- [ ] Any rule the decision turns on is STATED in plain words, not just named
- [ ] No block silently merges two different mechanisms into one story
