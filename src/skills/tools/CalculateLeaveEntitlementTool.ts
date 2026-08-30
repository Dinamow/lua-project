import { LuaTool } from "lua-cli";
import { z } from "zod";
import { getEntitlement } from "../../services/leaveRules";

export default class CalculateLeaveEntitlementTool implements LuaTool {
  name = "calculate_leave_entitlement";
  description =
    "Calculate an employee's yearly leave entitlement in days for their country and leave type (e.g. KSA annual leave is 21 days under 5 years tenure, 30 days at 5+ years). Use the country and tenureYears returned by check_leave_balance.";

  inputSchema = z.object({
    country: z.enum(["KSA", "UAE", "EGYPT", "JORDAN"]),
    leaveType: z.enum(["annual", "sick", "emergency"]),
    tenureYears: z.number().min(0),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    return getEntitlement(input);
  }
}
