// End-of-service gratuity. KSA follows Saudi Labour Law Articles 84-87; UAE/Egypt/Jordan
// use a simplified 1-month-per-year approximation, flagged as such in the result.

export type Country = "KSA" | "UAE" | "EGYPT" | "JORDAN";
export type TerminationType = "resignation" | "termination" | "end_of_contract";

export interface GratuityInput {
  country: Country;
  monthlyBasicSalary: number;
  startDate: string;
  endDate: string;
  terminationType: TerminationType;
}

export interface GratuityResult {
  country: Country;
  serviceYears: number;
  fullGratuity: number;
  payableGratuity: number;
  proration: string;
  basis: string;
  currency: "SAR" | "AED" | "EGP" | "JOD";
}

const CURRENCY: Record<Country, GratuityResult["currency"]> = {
  KSA: "SAR",
  UAE: "AED",
  EGYPT: "EGP",
  JORDAN: "JOD",
};

function serviceYears(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return Math.max(0, (end - start) / (365.25 * 24 * 60 * 60 * 1000));
}

function calculateKSA(input: GratuityInput): GratuityResult {
  const years = serviceYears(input.startDate, input.endDate);
  const salary = input.monthlyBasicSalary;

  if (years < 1) {
    return {
      country: "KSA",
      serviceYears: round(years),
      fullGratuity: 0,
      payableGratuity: 0,
      proration: "No entitlement — under 1 year of service",
      basis: "Articles 84-87",
      currency: "SAR",
    };
  }

  // Half a month's salary per year for the first 5 years, full month/year after (Article 84).
  const firstFiveYears = Math.min(years, 5) * 0.5 * salary;
  const remainingYears = Math.max(years - 5, 0) * salary;
  const fullGratuity = firstFiveYears + remainingYears;

  // Article 85 proration on resignation; termination/end-of-contract are paid in full (Article 87).
  let fraction = 1;
  let proration =
    "Full amount — employer termination or end of contract (Article 87)";
  if (input.terminationType === "resignation") {
    if (years < 2) {
      fraction = 0;
      proration =
        "No entitlement on resignation — under 2 years of service (Article 85)";
    } else if (years < 5) {
      fraction = 1 / 3;
      proration =
        "1/3 of full amount — resignation, 2-5 years of service (Article 85)";
    } else if (years < 10) {
      fraction = 2 / 3;
      proration =
        "2/3 of full amount — resignation, 5-10 years of service (Article 85)";
    } else {
      fraction = 1;
      proration =
        "Full amount — resignation, 10+ years of service (Article 85)";
    }
  }

  return {
    country: "KSA",
    serviceYears: round(years),
    fullGratuity: round(fullGratuity),
    payableGratuity: round(fullGratuity * fraction),
    proration,
    basis: "Articles 84-87",
    currency: "SAR",
  };
}

function calculateSimplified(input: GratuityInput): GratuityResult {
  const years = serviceYears(input.startDate, input.endDate);
  const fullGratuity = years * input.monthlyBasicSalary;
  const payable =
    input.terminationType === "resignation" && years < 1 ? 0 : fullGratuity;

  return {
    country: input.country,
    serviceYears: round(years),
    fullGratuity: round(fullGratuity),
    payableGratuity: round(payable),
    proration:
      input.terminationType === "resignation" && years < 1
        ? "No entitlement on resignation — under 1 year of service"
        : "Full amount — no proration modelled for this country in the demo",
    basis:
      "Simplified 1-month-per-year approximation — not the exact statutory formula",
    currency: CURRENCY[input.country],
  };
}

export function calculateGratuity(input: GratuityInput): GratuityResult {
  if (input.country === "KSA") return calculateKSA(input);
  return calculateSimplified(input);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
