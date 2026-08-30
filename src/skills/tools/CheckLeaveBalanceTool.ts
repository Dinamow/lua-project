import { LuaTool } from "lua-cli";
import { z } from "zod";
import BambooHRService from "../../services/bambooHR.service";
import { tenureYearsBetween } from "../../services/leaveRules";

export default class CheckLeaveBalanceTool implements LuaTool {
  name = "check_leave_balance";
  description =
    "Look up an employee's leave balances (annual, sick, emergency), country, and tenure from BambooHR. Use this before calculating entitlement or submitting a leave request.";

  inputSchema = z.object({
    employeeId: z.string().describe("BambooHR employee id of the employee"),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const bambooHR = new BambooHRService();
    const employee = await bambooHR.getEmployee(input.employeeId);
    const balances = await bambooHR.getTimeOffBalances(employee.id);

    return {
      employeeId: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      country: employee.country,
      tenureYears: Math.round(tenureYearsBetween(employee.hireDate) * 10) / 10,
      hireDate: employee.hireDate,
      supervisorId: employee.supervisorId,
      balances,
    };
  }
}
