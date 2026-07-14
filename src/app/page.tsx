import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { WaitlistForm } from "./_landing/WaitlistForm";
import xrayShot from "../../public/product/portfolio-xray.png";
import fundShot from "../../public/product/fund-profile.png";
import lookThroughShot from "../../public/product/look-through.png";
import {
  SP500_MEGACAP_PCT,
  ACTIVE_MEDIAN_MEGACAP_PCT,
  MOST_HELD,
  THEME_EXAMPLES,
  EXPOSURE_DIMENSIONS,
  ACTIVE_FUNDS,
  SEC_SERIES,
  HOLDINGS_ROWS,
  DEMO_PORTFOLIO_FEE_BPS,
  DEMO_BLEND_FEE_BPS,
  DEMO_COST_PER_100K,
  DEMO_LT_TOP10_PCT,
  DEMO_LT_NVDA_PCT,
} from "./_landing/facts";

export const metadata: Metadata = {
  title:
    "FundScore.ai — You might own the AI trade seven times, and call it diversification.",
  description:
    "FundScore looks through every fund to reveal the companies, themes, factors and macro risks actually driving your portfolio — then helps you find funds that deliver the exposure you intended to buy. No brokerage login required.",
};

export const dynamic = "force-static";

/* -------------------------------------------------------------------------- */

function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-[11px] font-bold text-white">
        FS
      </span>
      <span
        className={`text-lg font-semibold tracking-tight ${dark ? "text-white" : "text-ink"}`}
      >
        Fund
        <span className={dark ? "text-sky-300" : "text-primary"}>Score</span>
        <span className={dark ? "text-white/40" : "text-ink-soft/60"}>.ai</span>
      </span>
    </span>
  );
}

function Eyebrow({
  children,
  tone = "light",
}: {
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <p
      className={`font-mono text-[11px] font-medium uppercase tracking-[0.18em] ${
        tone === "dark" ? "text-white/45" : "text-ink-soft"
      }`}
    >
      {children}
    </p>
  );
}

/**
 * The only call to action while the product is gated. There is deliberately no
 * "X-ray my portfolio" button: the X-Ray is closed to anonymous visitors, and a
 * button that bounces you back to the page you're on is worse than no button.
 * When the gate lifts (LAUNCHED=true), this is where the product CTAs go back.
 */
function EarlyAccess({
  source,
  tone = "light",
}: {
  source: string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div>
      <WaitlistForm
        source={source}
        label="Request early access"
        tone={tone}
      />
      <p
        className={`mt-2 text-xs ${dark ? "text-white/45" : "text-ink-soft/80"}`}
      >
        No brokerage login required. No trading access.
      </p>
    </div>
  );
}

function Shot({
  src,
  alt,
  caption,
}: {
  src: typeof xrayShot;
  alt: string;
  caption: string;
}) {
  return (
    <figure>
      <div className="overflow-hidden rounded-2xl border border-rule bg-white shadow-[0_1px_2px_rgba(14,35,56,0.04),0_12px_32px_-12px_rgba(14,35,56,0.18)]">
        <Image
          src={src}
          alt={alt}
          sizes="(max-width: 768px) 100vw, 640px"
          className="h-auto w-full"
          placeholder="blur"
        />
      </div>
      <figcaption className="mt-4 text-xs leading-relaxed text-ink-soft/85">
        {caption}
      </figcaption>
    </figure>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-[0.55rem] size-1 shrink-0 rounded-full bg-primary" />
      <span>{children}</span>
    </li>
  );
}

/* -------------------------------------------------------------------------- */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Wordmark />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
          In development
        </span>
      </header>

      {/* ---------------------------------------------------------------- Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-14 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
        <div className="rise-in max-w-4xl">
          <h1 className="font-serif text-[2.35rem] leading-[1.08] font-semibold tracking-[-0.02em] text-balance text-ink sm:text-[3.5rem]">
            You might own the AI trade seven times — and call it
            diversification.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft">
            FundScore looks through every fund to reveal the companies, themes,
            factors and macro risks actually driving your portfolio.
          </p>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Then it helps you find funds that deliver the exposure you intended
            to buy.
          </p>

          <div className="mt-10">
            <EarlyAccess source="home-hero" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ See through the wrapper */}
      <section className="border-y border-rule bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
            <div>
              <Eyebrow>What do I really own?</Eyebrow>
              <h2 className="mt-5 font-serif text-3xl leading-[1.12] font-semibold tracking-[-0.01em] text-balance sm:text-[2.6rem]">
                See through the fund wrapper.
              </h2>
              <p className="mt-6 leading-relaxed text-ink-soft">
                Fund names and categories can create the appearance of
                diversification while hiding the same underlying bets. The S&amp;P
                500 keeps {SP500_MEGACAP_PCT} of its value in seven companies,
                and the median US large-cap active fund holds{" "}
                {ACTIVE_MEDIAN_MEGACAP_PCT} in the same names.
              </p>
              <p className="mt-5 leading-relaxed text-ink-soft">
                FundScore maps your portfolio across {EXPOSURE_DIMENSIONS}{" "}
                dimensions, including:
              </p>

              <ul className="mt-6 space-y-2.5 text-sm leading-relaxed text-ink-soft">
                <Bullet>
                  <strong className="font-semibold text-ink">
                    Companies and industries
                  </strong>{" "}
                  — every position, added up across every fund you hold
                </Bullet>
                <Bullet>
                  <strong className="font-semibold text-ink">
                    Investment themes
                  </strong>{" "}
                  — {THEME_EXAMPLES.slice(0, 4).join(", ")} and more
                </Bullet>
                <Bullet>
                  <strong className="font-semibold text-ink">
                    Style and factor exposures
                  </strong>
                </Bullet>
                <Bullet>
                  <strong className="font-semibold text-ink">
                    Macro sensitivity
                  </strong>{" "}
                  — rates, inflation, growth, currencies, credit and commodities
                </Bullet>
              </ul>

              <p className="mt-7 leading-relaxed text-ink-soft">
                See where your risk really comes from — and which funds are giving
                you more of the same.
              </p>

              <p className="mt-8 font-mono text-xs leading-relaxed tracking-[0.04em] text-ink-soft/85">
                {MOST_HELD.join(" · ")}
                <span className="mt-1.5 block tracking-normal text-ink-soft/60">
                  The seven most widely held stocks across every active equity
                  fund we cover. Not one non-tech name until you reach Visa.
                </span>
              </p>
            </div>

            <Shot
              src={lookThroughShot}
              alt="FundScore look-through: the stocks inside a three-fund portfolio, with Nvidia at 6.46% held by 3 of 3 funds, Microsoft by 3 of 3, and the top ten names making up 29.9% of the portfolio against 35.8% for the passive alternative."
              caption="A real look-through: an S&P 500 index fund, an active growth fund and an international fund. Nvidia and Microsoft are in all three."
            />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- Screener */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-16">
          <div>
            <Eyebrow>Find what you meant to buy</Eyebrow>
            <h2 className="mt-5 font-serif text-3xl leading-[1.12] font-semibold tracking-[-0.01em] text-balance sm:text-[2.6rem]">
              Search by the bet, not the label.
            </h2>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-ink-soft">
              Most fund screeners start with categories, ratings, fees and past
              returns. FundScore starts with the exposure you want.
            </p>
            <p className="mt-5 leading-relaxed text-ink-soft">
              Find funds positioned for falling real rates. Compare AI exposure
              without relying on the same mega-cap stocks. Look for inflation
              sensitivity, reshoring, quality, small-cap value, or hundreds of
              other characteristics — across ETFs and mutual funds, using
              criteria you choose.
            </p>
            <div className="mt-8">
              <Link
                href="#early-access"
                className="inline-flex rounded-xl border border-rule bg-white px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Explore fund exposures
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Attribution */}
      <section className="border-y border-rule bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-20">
            <Shot
              src={fundShot}
              alt="FundScore profile for FCNTX, Fidelity Contrafund: a Value Score of approximately breakeven against IWF, and an Exposure X-Ray showing technology 26.6 percentage points underweight its passive alternative."
              caption="A real FundScore profile. The Value Score is backward-looking and relative to that fund's own passive alternative — never a forecast, and never a recommendation."
            />

            <div className="lg:order-first">
              <Eyebrow>Did the manager earn it?</Eyebrow>
              <h2 className="mt-5 font-serif text-3xl leading-[1.12] font-semibold tracking-[-0.01em] text-balance sm:text-[2.6rem]">
                Find out what active management actually delivered.
              </h2>
              <p className="mt-6 leading-relaxed text-ink-soft">
                A fund can outperform because its manager selected exceptional
                investments. It can also outperform because a sector, factor, or
                macro bet happened to work.
              </p>
              <p className="mt-5 leading-relaxed text-ink-soft">
                FundScore separates performance into:
              </p>
              <ul className="mt-5 space-y-2.5 text-sm leading-relaxed text-ink-soft">
                <Bullet>Broad market exposure</Bullet>
                <Bullet>
                  Systematic sector, style, theme and macro effects
                </Bullet>
                <Bullet>Security-selection value</Bullet>
                <Bullet>Fees</Bullet>
              </ul>
              <p className="mt-6 leading-relaxed text-ink-soft">
                See whether an active manager delivered something distinctive — or
                charged active fees for exposure available elsewhere.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Three questions */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Eyebrow>The whole product</Eyebrow>
        <h2 className="mt-5 max-w-2xl font-serif text-3xl leading-[1.12] font-semibold tracking-[-0.01em] text-balance sm:text-[2.6rem]">
          Understand your portfolio in three questions.
        </h2>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule md:grid-cols-3">
          {[
            {
              q: "What do I really own?",
              a: "Look through your funds to the underlying securities and economic exposures.",
            },
            {
              q: "Am I actually diversified?",
              a: "Identify repeated bets and concentrations that traditional allocation charts miss.",
            },
            {
              q: "What am I paying for?",
              a: "Compare fund fees with the differentiated exposure and estimated value delivered.",
            },
          ].map((x) => (
            <div key={x.q} className="bg-white p-7 sm:p-8">
              <h3 className="font-serif text-xl font-semibold text-ink">
                {x.q}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{x.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ Not another pie chart */}
      <section className="border-y border-rule bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
            <div>
              <Eyebrow>Am I actually diversified?</Eyebrow>
              <h2 className="mt-5 font-serif text-3xl leading-[1.12] font-semibold tracking-[-0.01em] text-balance sm:text-[2.6rem]">
                More than another portfolio pie chart.
              </h2>
              <p className="mt-6 leading-relaxed text-ink-soft">
                A typical portfolio tool might tell you that 24% of your money is
                in technology.
              </p>
              <p className="mt-5 leading-relaxed text-ink-soft">
                FundScore tells you that three of your funds all hold Nvidia,
                that it is {DEMO_LT_NVDA_PCT} of everything you own, that your top
                ten names are {DEMO_LT_TOP10_PCT} of the book — and that you are
                paying {DEMO_PORTFOLIO_FEE_BPS} basis points for a portfolio the
                index would have handed you for {DEMO_BLEND_FEE_BPS}. That gap is{" "}
                {DEMO_COST_PER_100K} a year on $100,000.
              </p>
              <p className="mt-7 font-serif text-xl leading-snug font-semibold text-ink">
                Knowing the category is not the same as understanding the bet.
              </p>
            </div>

            <Shot
              src={xrayShot}
              alt="FundScore Portfolio X-Ray fee gap: a blended fee of 36 basis points against a passive blend costing 13, a gap of 23 basis points or $227 a year on $100,000, and the solved blend of IWF and VEU."
              caption="The same three funds, priced against the passive blend that tracks them (R² 0.97). Where a holding has no honest passive match, FundScore says so rather than forcing one."
            />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- How it works */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-5 max-w-2xl font-serif text-3xl leading-[1.12] font-semibold tracking-[-0.01em] text-balance sm:text-[2.6rem]">
          From diagnosis to research.
        </h2>
        <p className="mt-6 max-w-2xl leading-relaxed text-ink-soft">
          FundScore does not choose investments for you. It helps you compare
          funds, test substitutions, and see how each choice would change your
          portfolio. You choose the question. FundScore shows you what is
          underneath.
        </p>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Add your portfolio",
              body: "Enter your holdings, or upload a file exported from your brokerage. Your holdings stay on your device.",
            },
            {
              step: "02",
              title: "See the hidden exposures",
              body: "FundScore analyses the underlying holdings across companies, themes, factors and macro risks.",
            },
            {
              step: "03",
              title: "Explore the alternatives",
              body: "Compare funds, investigate concentrations, and screen for the exposures you actually want.",
            },
          ].map((s) => (
            <li key={s.step} className="bg-white p-7 sm:p-8">
              <span className="font-mono text-[11px] font-medium tracking-[0.16em] text-primary">
                {s.step}
              </span>
              <h3 className="mt-3 font-serif text-xl font-semibold text-ink">
                {s.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
                {s.body}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-sm text-ink-soft">
          No brokerage password. No trading access.
        </p>
      </section>

      {/* ------------------------------------------------------ Institutional */}
      <section className="border-y border-rule bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div>
              <Eyebrow>Where we stand</Eyebrow>
              <h2 className="mt-5 font-serif text-3xl leading-[1.12] font-semibold tracking-[-0.01em] text-balance sm:text-[2.6rem]">
                Institutional questions. Built for individual investors.
              </h2>
            </div>
            <div className="space-y-7">
              <p className="leading-relaxed text-ink-soft">
                Professional investors use holdings analysis, factor models and
                performance attribution to understand what is really inside a
                portfolio. FundScore brings those tools into one clear research
                experience.
              </p>
              <p className="font-mono text-xs leading-loose tracking-[0.04em] text-ink-soft">
                No enterprise terminal.
                <br />
                No black-box recommendations.
                <br />
                No brokerage connection required.
              </p>

              <div className="rounded-2xl border border-primary/20 bg-primary-light px-6 py-5">
                <p className="leading-relaxed text-primary-dark">
                  We charge users, not fund companies. No paid placements. No
                  affiliate-incentive ranking. The scores you see are not for
                  sale.
                </p>
              </div>

              <div>
                <h3 className="font-serif text-lg font-semibold text-ink">
                  Wrong data is worse than no data.
                </h3>
                <p className="mt-2 leading-relaxed text-ink-soft">
                  When something is missing, stale, or unsupported, we say so and
                  suppress the claim rather than fill the hole. A fund with no
                  fair passive stand-in does not get a number it hasn&apos;t
                  earned.
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-t border-rule pt-7 sm:grid-cols-4">
                {[
                  { n: ACTIVE_FUNDS, l: "Active funds covered" },
                  { n: EXPOSURE_DIMENSIONS, l: "Exposure dimensions" },
                  { n: HOLDINGS_ROWS, l: "As-filed SEC positions" },
                  { n: SEC_SERIES, l: "Fund series ingested" },
                ].map((s) => (
                  <div key={s.l}>
                    <dt className="sr-only">{s.l}</dt>
                    <dd>
                      <span className="block font-serif text-2xl font-semibold tracking-tight text-ink">
                        {s.n}
                      </span>
                      <span className="mt-1.5 block text-xs leading-snug text-ink-soft">
                        {s.l}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- Close */}
      <section id="early-access" className="scroll-mt-8 bg-ink">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <h2 className="max-w-2xl font-serif text-3xl leading-[1.12] font-semibold tracking-[-0.01em] text-balance text-white sm:text-[2.8rem]">
            Give your portfolio some radical candor.
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/70">
            You may be diversified. Or you may own the same bet seven different
            ways.
          </p>
          <p className="mt-5 max-w-lg leading-relaxed text-white/60">
            FundScore is opening in stages. Leave your email and we&apos;ll let
            you in.
          </p>

          <div className="mt-9 max-w-xl">
            <EarlyAccess source="home-close" tone="dark" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Footer */}
      <footer className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-6 border-t border-rule pt-8 sm:flex-row sm:items-start sm:justify-between">
          <Wordmark />
          <p className="max-w-xl text-xs leading-relaxed text-ink-soft/80">
            FundScore provides research and analytical tools for self-directed
            investors. It does not provide individualized investment advice or
            recommend that any person buy or sell a security. Sources: SEC
            N-PORT, N-CEN, and prospectus / annual fee filings, with vendor
            pricing and reference data. Holdings are filed with a lag, and the
            figures in product screenshots are real output that will move as new
            filings land.{" "}
            <Link
              href="/methodology"
              className="text-ink underline underline-offset-4"
            >
              Read the methodology
            </Link>
            .
          </p>
        </div>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft/60">
          © {new Date().getFullYear()} FundScore.ai
        </p>
      </footer>
    </div>
  );
}
