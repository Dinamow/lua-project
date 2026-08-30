import { LuaTool } from "lua-cli";
import { z } from "zod";
import { calculateGratuity } from "../../services/gratuity";

export default class CalculateGratuityTool implements LuaTool {
  name = "calculate_gratuity";
  description =
    "Calculate an employee's end-of-service gratuity. KSA uses the exact statutory formula (Articles 84-87: half-month salary/year for the first 5 years, full month/year after, with resignation proration). UAE/Egypt/Jordan use a simplified 1-month-per-year approximation.";

  inputSchema = z.object({
    country: z.enum(["KSA", "UAE", "EGYPT", "JORDAN"]),
    monthlyBasicSalary: z.number().positive(),
    startDate: z.string().describe("ISO hire date"),
    endDate: z.string().describe("ISO last working date"),
    terminationType: z.enum(["resignation", "termination", "end_of_contract"]),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    return calculateGratuity(input);
  }
}
