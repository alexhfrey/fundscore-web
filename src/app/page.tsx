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
  MACRO_FACTORS,
  EXPOSURE_DIMENSIONS,
  ACTIVE_FUNDS,
  SEC_SERIES,
  HOLDINGS_ROWS,
  DEMO_PORTFOLIO_FEE_BPS,
  DEMO_BLEND_FEE_BPS,
  DEMO_COST_PER_100K,
  DEMO_LT_TOP10_PCT,
  DEMO_LT_NVDA_PCT,
  DEMO_FUNDS_HOLDING_NVDA,
} from "./_landing/facts";

export const metadata: Metadata = {
  title:
    "FundScore.ai — You might own the AI trade seven times, and call it diversification.",
  description:
    "Star ratings rank funds on last decade's returns. FundScore looks through every fund to reveal the companies, themes, factors and macro risks actually driving your portfolio — and how much value your managers added beyond just riding them. No brokerage login required.",
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
 * live "X-ray my portfolio" button: the X-Ray is closed to anonymous visitors,
 * and a button that bounces you back to the page you're on is worse than an
 * email capture. When the gate lifts (LAUNCHED=true), the CtaLink targets below
 * and this form become the real product CTAs — see page_specs/home.md § CTA.
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
      <WaitlistForm source={source} label="Request early access" tone={tone} />
      <p
        className={`mt-2 text-xs ${dark ? "text-white/45" : "text-ink-soft/80"}`}
      >
        No brokerage login required. No trading access.
      </p>
    </div>
  );
}

/**
 * Secondary CTAs mid-page. Pre-launch they scroll to the early-access form at
 * the close. At launch, swap the href for the real route in the label→route map
 * in page_specs/home.md (X-ray my portfolio → /xray, Explore funds → /screener,
 * Analyze a fund → /funds/{ticker}).
 */
function CtaLink({ children }: { children: React.ReactNode }) {
  return (
    <Link
      href="#early-access"
      className="inline-flex rounded-xl border border-rule bg-white px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {children}
    </Link>
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
            Star ratings rank funds on the last decade&apos;s returns. FundScore
            shows you the macro bets hiding inside the portfolio you{" "}
            <em className="text-ink not-italic underline decoration-primary/40 decoration-2 underline-offset-4">
              already own
            </em>{" "}
            — and how much value your managers actually added beyond just riding
            them.
          </p>

          <div className="mt-10">
            <EarlyAccess source="home-hero" />
          </div>
        </div>
      </section>

      {/* ------------------------------------- A five-star rating can't show this */}
      <section className="border-y border-rule bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
            <div>
              <Eyebrow>One real portfolio</Eyebrow>
              <h2 className="mt-5 font-serif text-3xl leading-[1.12] font-semibold tracking-[-0.01em] text-balance sm:text-[2.6rem]">
                A five-star rating can&apos;t tell you this.
              </h2>
              <p className="mt-6 leading-relaxed text-ink-soft">
                Here is a real three-fund portfolio: an S&amp;P 500 index fund,
                an active growth fund, and an international fund. On paper,
                diversified.
              </p>
              <p className="mt-5 leading-relaxed text-ink-soft">
                FundScore shows that {DEMO_FUNDS_HOLDING_NVDA} of the funds hold
                Nvidia, that it is {DEMO_LT_NVDA_PCT} of everything you own, that
                your top ten names are {DEMO_LT_TOP10_PCT} of the book — and that
                you are paying {DEMO_PORTFOLIO_FEE_BPS} basis points for a
                portfolio the index would have handed you for{" "}
                {DEMO_BLEND_FEE_BPS}. That gap is {DEMO_COST_PER_100K} a year on
                $100,000.
              </p>
              <p className="mt-7 font-serif text-xl leading-snug font-semibold text-ink">
                Knowing the category is not the same as understanding the bet.
              </p>
              <div className="mt-8">
                <CtaLink>X-ray my portfolio</CtaLink>
              </div>
            </div>

            <Shot
              src={xrayShot}
              alt="FundScore Portfolio X-Ray fee gap: a blended fee of 36 basis points against a passive blend costing 13, a gap of 23 basis points or $227 a year on $100,000, and the solved blend of IWF and VEU."
              caption="The same three funds, priced against the passive blend that tracks them (R² 0.97). Where a holding has no honest passive match, FundScore says so rather than forcing one."
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------- See what you really own */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-center lg:gap-20">
          <div className="lg:order-first">
            <Eyebrow>What do I really own?</Eyebrow>
            <h2 className="mt-5 font-serif text-3xl leading-[1.12] font-semibold tracking-[-0.01em] text-balance sm:text-[2.6rem]">
              See what you really own.
            </h2>
            <p className="mt-6 leading-relaxed text-ink-soft">
              FundScore builds your <strong className="font-semibold text-ink">
                Best Passive Alternative
              </strong>{" "}
              — the low-cost ETF portfolio that most closely replicates what you
              already hold. Then it shows the active bets, fees, and manager
              value layered on top, mapping your portfolio across{" "}
              {EXPOSURE_DIMENSIONS} exposure dimensions — companies and
              industries, investment themes ({THEME_EXAMPLES.slice(0, 3).join(", ")}{" "}
              and more), style and factor tilts, and macro sensitivity to{" "}
              {MACRO_FACTORS}.
            </p>

            <ul className="mt-7 space-y-2.5 text-sm leading-relaxed text-ink-soft">
              <Bullet>Where you are unintentionally concentrated</Bullet>
              <Bullet>
                Whether your active funds diversify — or quietly cancel each
                other out
              </Bullet>
              <Bullet>
                Which stocks, sectors, macro factors and themes are driving your
                returns
              </Bullet>
              <Bullet>
                How much you pay above the passive alternative you could buy
                yourself
              </Bullet>
            </ul>

            <p className="mt-7 leading-relaxed text-ink-soft">
              Fund names and categories can create the appearance of
              diversification while hiding the same underlying bets. The S&amp;P
              500 keeps {SP500_MEGACAP_PCT} of its value in seven companies, and
              the median US large-cap active fund holds {ACTIVE_MEDIAN_MEGACAP_PCT}{" "}
              in the same names.
            </p>

            <p className="mt-8 font-mono text-xs leading-relaxed tracking-[0.04em] text-ink-soft/85">
              {MOST_HELD.join(" · ")}
              <span className="mt-1.5 block tracking-normal text-ink-soft/60">
                The seven most widely held stocks across every active equity fund
                we cover. Not one non-tech name until you reach Visa.
              </span>
            </p>

            <div className="mt-8">
              <CtaLink>X-ray my portfolio</CtaLink>
            </div>
          </div>

          <Shot
            src={lookThroughShot}
            alt="FundScore look-through: the stocks inside a three-fund portfolio, with Nvidia at 6.46% held by 3 of 3 funds, Microsoft by 3 of 3, and the top ten names making up 29.9% of the portfolio against 35.8% for the passive alternative."
            caption="A real look-through: an S&P 500 index fund, an active growth fund and an international fund. Nvidia and Microsoft are in all three."
          />
        </div>
      </section>

      {/* -------------------------------------------------------- Attribution */}
      <section className="border-y border-rule bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-20">
            <Shot
              src={fundShot}
              alt="A FundScore fund profile (the fund name is redacted): a Value Score of about breakeven against the fund's closest passive alternative — it came out roughly even, net of fees — with an Exposure X-Ray showing it 26.6 percentage points underweight technology versus that alternative."
              caption="A real FundScore profile. The Value Score is backward-looking and relative to that fund's own passive alternative — never a forecast, and never a recommendation."
            />

            <div className="lg:order-first">
              <Eyebrow>Did the manager earn it?</Eyebrow>
              <h2 className="mt-5 font-serif text-3xl leading-[1.12] font-semibold tracking-[-0.01em] text-balance sm:text-[2.6rem]">
                See what active management actually delivered.
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
                <Bullet>Broad market returns</Bullet>
                <Bullet>
                  Systematic sector, style, theme and macro effects
                </Bullet>
                <Bullet>Security-selection value</Bullet>
                <Bullet>Fees</Bullet>
              </ul>
              <p className="mt-7 font-serif text-xl leading-snug font-semibold text-ink">
                Are you paying for real skill — or expensive access to a trend you
                could get for less?
              </p>
              <div className="mt-8">
                <CtaLink>Analyze a fund</CtaLink>
              </div>
            </div>
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
            <ul className="mt-6 space-y-2.5 text-sm leading-relaxed text-ink-soft">
              <Bullet>Large-cap funds with less exposure to the AI trade</Bullet>
              <Bullet>Funds positioned for falling real rates</Bullet>
              <Bullet>ETFs and mutual funds exposed to reshoring</Bullet>
              <Bullet>
                Active managers with broad-based security-selection value
              </Bullet>
              <Bullet>
                Funds that diversify your current holdings instead of duplicating
                them
              </Bullet>
            </ul>
            <p className="mt-7 leading-relaxed text-ink-soft">
              Across ETFs and open-end mutual funds, using the criteria you
              choose.
            </p>
            <p className="mt-6 font-serif text-xl leading-snug font-semibold text-ink">
              You bring the investment idea. FundScore provides the receipts.
            </p>
            <div className="mt-8">
              <CtaLink>Explore fund exposures</CtaLink>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Monitoring */}
      <section className="border-y border-rule bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-16">
            <div>
              <Eyebrow>Know when it changes</Eyebrow>
              <h2 className="mt-5 font-serif text-3xl leading-[1.12] font-semibold tracking-[-0.01em] text-balance sm:text-[2.6rem]">
                Know when the investment changes.
              </h2>
            </div>
            <div>
              <p className="text-lg leading-relaxed text-ink-soft">
                A fund can keep the same name while quietly becoming a very
                different investment — new sector bets, drifting factor tilts, a
                fresh manager reshaping the book.
              </p>
              <p className="mt-5 leading-relaxed text-ink-soft">
                FundScore tracks changes in a fund&apos;s positioning and tells
                you when it drifts from the role you hired it to play — so you
                learn it from the filings, not from the next statement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Built on data */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-16">
          <div>
            <Eyebrow>Where the numbers come from</Eyebrow>
            <h2 className="mt-5 font-serif text-3xl leading-[1.12] font-semibold tracking-[-0.01em] text-balance sm:text-[2.6rem]">
              Built from the ground up on hard data.
            </h2>
          </div>
          <div className="space-y-7">
            <p className="text-lg leading-relaxed text-ink-soft">
              FundScore analyses the actual holdings inside every fund, sourced
              directly from SEC filings — not fund names, marketing language,
              category labels, or vague reputations. Every exposure traces back
              to the securities underneath it. Every assessment shows the
              components behind the number.
            </p>

            <div className="rounded-2xl border border-primary/20 bg-primary-light px-6 py-5">
              <p className="leading-relaxed text-primary-dark">
                We charge users, not fund companies. No paid placements. No
                affiliate-incentive ranking. The scores you see are not for sale.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-lg font-semibold text-ink">
                Wrong data is worse than no data.
              </h3>
              <p className="mt-2 leading-relaxed text-ink-soft">
                When something is missing, stale, or unsupported, we say so and
                suppress the claim rather than fill the hole. A fund with no fair
                passive stand-in does not get a number it hasn&apos;t earned.
              </p>
            </div>
          </div>
        </div>
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
            Different funds don&apos;t always mean different bets.
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/70">
            See what&apos;s driving your portfolio, what you&apos;re paying for,
            and whether your active managers delivered something genuinely
            different. Your portfolio may be diversified. Or it may be the same
            trade in seven different wrappers.
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
