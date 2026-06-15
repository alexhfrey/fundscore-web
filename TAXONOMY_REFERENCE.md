# Fund Taxonomy System — Reference

*Generated: March 6, 2026*

---

## Architecture: 4 Orthogonal Dimensions

Every fund gets classified along 4 independent dimensions, producing a **peer_group** key like `EQ.US.BROAD.LARGE`:

### 1. Asset Class (`asset_class`)

| Code | Meaning |
|------|---------|
| `EQ` | Equity |
| `FI` | Fixed Income |
| `MU` | Municipal Bonds |
| `MA` | Multi-Asset / Allocation |
| `ALT` | Alternatives |
| `RE` | Real Estate |
| `OT` | Other (defined but unused) |

### 2. Geography (`geography`)

| Value | Meaning |
|-------|---------|
| `US` | United States |
| `INTL` | International Developed |
| `EM` | Emerging Markets |
| `GLOBAL` | Global (mix of US + non-US) |
| `BROAD` | Not geography-specific (MA, ALT, RE) |
| Country codes | `JP`, `GB`, `CN`, etc. — fall back to parent (`INTL` or `EM`) if peer group too small |

### 3. Focus (`focus`) — varies by asset class

| Asset Class | Valid Focus Values |
|-------------|-------------------|
| EQ | `BROAD`, `TECH`, `HEALTH`, `FINANC`, `ENERGY`, `CONSDISC`, `CONSSTAPL`, `INDUST`, `UTILS`, `COMMSERV`, `MATERIALS` |
| FI | `IG_BROAD`, `IG_CORP`, `HY`, `GOVT`, `SPECIALTY` |
| MU | `IG`, `HY` |
| MA | `TARGET_DATE`, `ALLOC_AGGR`, `ALLOC_MOD`, `ALLOC_CONS` |
| ALT | `LONG_SHORT`, `MKTNEUT`, `MANAGED_FUT`, `EVENT`, `MULTI` |
| RE | `REIT`, `COMMODITY`, `INFRA` |

### 4. Size (`size`) — varies by asset class

| Asset Class | Valid Size Values |
|-------------|-------------------|
| EQ | `LARGE`, `MID`, `SMALL`, `ALLCAP` |
| FI | `ULTRASHORT`, `SHORT`, `INTERM`, `LONG`, `BROAD` |
| MU | `ULTRASHORT`, `SHORT`, `INTERM`, `LONG`, `BROAD` |
| MA, ALT, RE | `BROAD` |

---

## Scorability (Level 0 — before classification)

| Flag | Meaning | Count |
|------|---------|-------|
| `SCORABLE` | Enters scoring pipeline | 18,983 |
| `PASSIVE` | Index/ETF — excluded from scoring | 5,163 |
| `EXCLUDED_MONEY_MARKET` | Money market fund | 650 |
| `EXCLUDED_UNSCORABLE` | Derivatives/short-heavy | 675 |

---

## Structural Gates (before cascade)

Three gates fire first, routing funds before the confidence cascade:

1. **Target-date** → `MA.BROAD.TARGET_DATE.BROAD`
2. **FoF allocation** → `MA.BROAD.ALLOC_AGGR|MOD|CONS.BROAD`
3. **RE/REIT** → `RE.{geo}.{focus}.BROAD`

---

## Cascade Classification Engine

For non-gated funds, 5 signal sources each propose per-dimension classifications with confidence scores:

| Source | AC Authority | Geo Authority | Focus Authority | Size Authority |
|--------|-------------|---------------|-----------------|----------------|
| `holdings` | STRONG (0.85) | MODERATE (0.70, EQ only) | UNABLE (FI), STRONG (EQ sector) | UNABLE (EQ), MODERATE (FI maturity) |
| `benchmark` | MODERATE (0.70) | STRONG (0.85) | STRONG (0.85, EQ sector) | STRONG (0.85) |
| `name` | WEAK (0.50) | STRONG-DEFINITIVE | DEFINITIVE (HY/TIPS/muni) | MODERATE (0.70) |
| `ncen` | DEFINITIVE (0.95, TD only) | MODERATE | DEFINITIVE (TD) | MODERATE |
| `etf_blend` | R²×WEAK | R²×WEAK | R²×WEAK | R²×WEAK |

Resolution: **max confidence wins per dimension independently**. Geography/focus/size only consider proposals matching the winning asset class.

---

## Peer Group Construction

```
peer_group = f"{asset_class}.{geography}.{focus}.{size}"
```

Progressive fallback for groups < 30 funds:

1. Drop size: `EQ.JP.BROAD.ALLCAP` → `EQ.JP.BROAD`
2. Broaden geo: `EQ.JP.BROAD` → `EQ.INTL.BROAD`
3. Drop focus: `EQ.INTL.BROAD` → `EQ.INTL`
4. AC only: `EQ`

---

## Current Distribution (25,471 series)

- 90 unique peer groups after fallback
- Top 5: `EQ.US.BROAD.LARGE` (2,794), `EQ.US.BROAD.ALLCAP` (2,443), `EQ.GLOBAL.BROAD.ALLCAP` (1,081), `EQ.US.BROAD.SMALL` (992), `EQ.INTL.BROAD.ALLCAP` (980)
- 19,001 series have a peer_group assignment
- 6,470 series have null asset_class (no signals available)

---

## Cross-Cutting Flags (independent of taxonomy)

| Flag | Source |
|------|--------|
| `is_passive` | N-CEN `is_index` or name pattern |
| `is_etf` | N-CEN `is_etf` |
| `is_fund_of_funds` | N-CEN flag |
| `is_non_diversified` | N-CEN flag |

---

## Confidence Tiers

| Tier | Criteria | Meaning |
|------|----------|---------|
| 1 | AC confidence >= 0.85 AND focus resolved | High confidence |
| 2 | AC confidence >= 0.50 | Moderate confidence |
| 3 | Low confidence or conflicts | Needs review |

Soft conflicts (`focus_conflict`, `geo_conflict`, `benchmark_ac_mismatch`) floor at tier 2. Hard conflicts (`ac_conflict`) force tier 3.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/fundscore/taxonomy/models.py` | Enums, valid values, defaults |
| `src/fundscore/taxonomy/level0.py` | Scorability filter |
| `src/fundscore/taxonomy/structural_gates.py` | Target-date, FoF, RE gates |
| `src/fundscore/taxonomy/proposals.py` | 5 signal source proposers |
| `src/fundscore/taxonomy/cascade.py` | Per-dimension confidence resolution |
| `src/fundscore/taxonomy/pipeline.py` | Orchestrator + peer group fallback |
| `src/fundscore/taxonomy/config.py` | Thresholds |
