import { createSeededRandom } from "./seed";
import { AdministrativeDetails } from "../../types";

export function generateAdminDetails(
  fundName: string,
  seed: number
): AdministrativeDetails {
  const rng = createSeededRandom(seed);

  // Extract fund family from fund name
  const familyMap: Record<string, string> = {
    Fidelity: "Fidelity Investments",
    Vanguard: "The Vanguard Group",
    "Dodge & Cox": "Dodge & Cox Funds",
    "T. Rowe": "T. Rowe Price",
    Primecap: "Primecap Management",
    American: "Capital Group",
    PIMCO: "Pacific Investment Management",
    Metropolitan: "Metropolitan West Asset Management",
    Invesco: "Invesco Ltd.",
    Oppenheimer: "OppenheimerFunds",
    Templeton: "Franklin Templeton",
    Oakmark: "Harris Associates",
    Legg: "Franklin Templeton",
    Hussman: "Hussman Funds",
  };

  let fundFamily = "Fund Management Co.";
  for (const [key, value] of Object.entries(familyMap)) {
    if (fundName.includes(key)) {
      fundFamily = value;
      break;
    }
  }

  const shareClasses = ["Investor", "Institutional", "Admiral", "Class A", "Class I"];
  const distributions = ["Quarterly", "Semi-Annually", "Annually", "Monthly"];
  const fiscalYears = ["December", "October", "September", "March"];
  const structures = ["Open-End Fund", "Open-End Fund", "Exchange-Traded Fund"];

  // Generate CUSIP (9 characters)
  const cusipDigits = [];
  for (let i = 0; i < 9; i++) {
    cusipDigits.push(rng.nextInt(0, 9));
  }
  const cusip = cusipDigits.join("");

  // Generate ISIN (US + 10 chars)
  const isinDigits = [];
  for (let i = 0; i < 10; i++) {
    isinDigits.push(rng.nextInt(0, 9));
  }
  const isin = `US${isinDigits.join("")}`;

  const phones = [
    "800-544-8544",
    "800-662-7447",
    "800-621-3979",
    "800-638-5660",
    "800-729-2307",
  ];

  return {
    shareClass: rng.pick(shareClasses),
    cusip,
    isin,
    distributionFrequency: rng.pick(distributions),
    fiscalYearEnd: rng.pick(fiscalYears),
    legalStructure: rng.pick(structures),
    fundFamily,
    phone: rng.pick(phones),
    website: `www.${fundFamily.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12)}.com`,
  };
}
