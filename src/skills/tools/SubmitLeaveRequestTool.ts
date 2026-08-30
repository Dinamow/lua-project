import { LuaTool, Data, Channels } from "lua-cli";
import { z } from "zod";
import BambooHRService from "../../services/bambooHR.service";
import {
  daysBetweenInclusive,
  tenureYearsBetween,
  getEntitlement,
  isSupportedCountry,
  inferEntitlementLeaveType,
} from "../../services/leaveRules";

export default class SubmitLeaveRequestTool implements LuaTool {
  name = "submit_leave_request";
  description =
    "Submit a leave request for an employee after checking their balance and entitlement. Validates the request against the remaining balance, stores it as pending, notifies the line manager over WhatsApp/web for approval, and returns the request id (used later by record_approval_decision). leaveType must match one of the leave types returned by check_leave_balance for this employee.";

  inputSchema = z.object({
    employeeIdOrEmail: z.string(),
    leaveType: z
      .string()
      .describe(
        "One of the leaveType values returned by check_leave_balance for this employee",
      ),
    startDate: z.string().describe("ISO date, e.g. 2026-09-10"),
    endDate: z.string().describe("ISO date, inclusive"),
    reason: z.string().optional(),
    language: z.enum(["ar", "en"]).default("en"),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const bambooHR = new BambooHRService();
    const employee = await bambooHR.getEmployee(input.employeeIdOrEmail);
    const balances = await bambooHR.getTimeOffBalances(employee.id);
    const balance = balances.find((b) => b.leaveType === input.leaveType);
    const requestedDays = daysBetweenInclusive(input.startDate, input.endDate);

    if (!balance) {
      return {
        success: false,
        reason: `No "${input.leaveType}" leave balance found for this employee. Available types: ${balances.map((b) => b.leaveType).join(", ")}.`,
      };
    }

    const entitlementLeaveType = isSupportedCountry(employee.country)
      ? inferEntitlementLeaveType(input.leaveType)
      : undefined;
    const entitlement = entitlementLeaveType
      ? getEntitlement({
          country: employee.country,
          leaveType: entitlementLeaveType,
          tenureYears: tenureYearsBetween(employee.hireDate),
        })
      : undefined;

    if (requestedDays > balance.balanceDays) {
      return {
        success: false,
        reason: `Requested ${requestedDays} day(s) but only ${balance.balanceDays} day(s) of ${input.leaveType} leave remain${entitlement ? ` (yearly entitlement: ${entitlement.annualDays} days)` : ""}.`,
      };
    }

    const bambooHRResult = await bambooHR.createTimeOffRequest({
      employeeId: employee.id,
      leaveType: input.leaveType,
      timeOffTypeId: balance.timeOffTypeId,
      startDate: input.startDate,
      endDate: input.endDate,
      amountDays: requestedDays,
    });

    const supervisor = await bambooHR
      .getEmployee(employee.supervisorId)
      .catch(() => undefined);

    const entry = await Data.create(
      "leave-requests",
      {
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeePhoneNumber: employee.phoneNumber,
        country: employee.country,
        leaveType: input.leaveType,
        startDate: input.startDate,
        endDate: input.endDate,
        days: requestedDays,
        reason: input.reason ?? "",
        status: "pending",
        supervisorId: employee.supervisorId,
        supervisorPhoneNumber: supervisor?.phoneNumber,
        bambooHRRequestId: bambooHRResult.bambooHRRequestId,
        requestedAt: new Date().toISOString(),
      },
      `${employee.firstName} ${employee.lastName} ${input.leaveType} leave pending`,
    );

    if (supervisor?.phoneNumber) {
      const text =
        input.language === "ar"
          ? `طلب إجازة جديد من ${employee.firstName} ${employee.lastName}: ${input.leaveType} من ${input.startDate} إلى ${input.endDate} (${requestedDays} يوم). للموافقة أو الرفض، أرسل: approve ${entry.id} أو reject ${entry.id}`
          : `New leave request from ${employee.firstName} ${employee.lastName}: ${input.leaveType} leave, ${input.startDate} to ${input.endDate} (${requestedDays} day(s)). Reply "approve ${entry.id}" or "reject ${entry.id}".`;

      await Channels.send({
        channel: "whatsapp",
        to: { phoneNumber: supervisor.phoneNumber },
        text,
      }).catch((error) => console.warn("Could not notify supervisor:", error));
    }

    return {
      success: true,
      requestId: entry.id,
      status: "pending",
      days: requestedDays,
      remainingBalanceAfterApproval: balance.balanceDays - requestedDays,
      notifiedSupervisor: Boolean(supervisor?.phoneNumber),
    };
  }
}
