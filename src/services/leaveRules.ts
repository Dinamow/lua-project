// Simplified KSA/UAE/Egypt/Jordan leave entitlement rules — illustrative, not legal advice.
// Each branch cites the article it approximates.

export type Country = "KSA" | "UAE" | "EGYPT" | "JORDAN";
export type LeaveType = "annual" | "sick" | "emergency";

const SUPPORTED_COUNTRIES: readonly Country[] = [
  "KSA",
  "UAE",
  "EGYPT",
  "JORDAN",
];

/** True for the 4 jurisdictions this demo's entitlement law is modeled for. */
export function isSupportedCountry(country: string): country is Country {
  return (SUPPORTED_COUNTRIES as readonly string[]).includes(country);
}

/**
 * Maps a free-form HRIS leave label (e.g. "Annual Leave/Holiday") to a modeled leave type.
 * Returns undefined for types with no entitlement rule here (e.g. Bereavement) — those can
 * still be balance-checked, just not entitlement-checked.
 */
export function inferEntitlementLeaveType(
  rawLeaveType: string,
): LeaveType | undefined {
  const lower = rawLeaveType.toLowerCase();
  if (lower.includes("annual")) return "annual";
  if (lower.includes("sick")) return "sick";
  if (lower.includes("emergency")) return "emergency";
  return undefined;
}

export interface EntitlementInput {
  country: Country;
  leaveType: LeaveType;
  tenureYears: number;
}

export interface EntitlementResult {
  leaveType: LeaveType;
  country: Country;
  annualDays: number;
  basis: string;
}

const EMERGENCY_DAYS_PER_YEAR = 5;

function annualEntitlement(
  country: Country,
  tenureYears: number,
): EntitlementResult {
  switch (country) {
    case "KSA":
      // Saudi Labour Law, Article 109: 21 days/year, 30 days/year once tenure >= 5 years.
      return tenureYears >= 5
        ? {
            leaveType: "annual",
            country,
            annualDays: 30,
            basis: "Article 109 — tenure >= 5 years",
          }
        : {
            leaveType: "annual",
            country,
            annualDays: 21,
            basis: "Article 109 — tenure < 5 years",
          };
    case "UAE":
      // Federal Decree-Law No. 33/2021, Article 29: 30 days/year after 1 year of service, else 2 days/month accrued.
      if (tenureYears >= 1) {
        return {
          leaveType: "annual",
          country,
          annualDays: 30,
          basis: "Article 29 — tenure >= 1 year",
        };
      }
      return {
        leaveType: "annual",
        country,
        annualDays: Math.round(tenureYears * 12 * 2),
        basis: "Article 29 — accrued at 2 days/month, tenure < 1 year",
      };
    case "EGYPT":
      // Labour Law No. 12/2003, Article 47: 21 days/year, 30 days/year once tenure >= 10 years.
      return tenureYears >= 10
        ? {
            leaveType: "annual",
            country,
            annualDays: 30,
            basis: "Article 47 — tenure >= 10 years",
          }
        : {
            leaveType: "annual",
            country,
            annualDays: 21,
            basis: "Article 47 — tenure < 10 years",
          };
    case "JORDAN":
      // Jordanian Labour Law, Article 61: 14 days/year, 21 days/year once tenure >= 5 years.
      return tenureYears >= 5
        ? {
            leaveType: "annual",
            country,
            annualDays: 21,
            basis: "Article 61 — tenure >= 5 years",
          }
        : {
            leaveType: "annual",
            country,
            annualDays: 14,
            basis: "Article 61 — tenure < 5 years",
          };
  }
}

function sickEntitlement(country: Country): EntitlementResult {
  // Flat figures — KSA's real rule is tiered (30 full-pay / 60 at 75% / 30 unpaid).
  const days: Record<Country, number> = {
    KSA: 30,
    UAE: 90,
    EGYPT: 180,
    JORDAN: 14,
  };
  return {
    leaveType: "sick",
    country,
    annualDays: days[country],
    basis: "Simplified flat figure for demo purposes",
  };
}

export function getEntitlement(input: EntitlementInput): EntitlementResult {
  const { country, leaveType, tenureYears } = input;
  if (leaveType === "annual") return annualEntitlement(country, tenureYears);
  if (leaveType === "sick") return sickEntitlement(country);
  return {
    leaveType: "emergency",
    country,
    annualDays: EMERGENCY_DAYS_PER_YEAR,
    basis: "Flat emergency-leave allowance for demo purposes",
  };
}

/** Whole years of tenure between a hire date and a reference date (default: now). */
export function tenureYearsBetween(
  hireDate: string | Date,
  asOf: string | Date = new Date(),
): number {
  const start = new Date(hireDate).getTime();
  const end = new Date(asOf).getTime();
  return (end - start) / (365.25 * 24 * 60 * 60 * 1000);
}

/** Inclusive count of calendar days between two ISO dates. */
export function daysBetweenInclusive(
  startDate: string,
  endDate: string,
): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}
