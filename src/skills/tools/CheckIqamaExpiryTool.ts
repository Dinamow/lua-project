import { LuaTool, Data } from "lua-cli";
import { z } from "zod";

export default class CheckIqamaExpiryTool implements LuaTool {
  name = "check_iqama_expiry";
  description =
    "Look up a KSA employee's Iqama (residency permit) expiry date and how many days remain. Reads from the mock employee directory seeded by seed_mock_data.";

  inputSchema = z.object({
    employeeId: z.string(),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const results = await Data.get("employees", { id: input.employeeId }, 1, 1);
    const record = results.data?.[0]?.data;

    if (!record) {
      return {
        found: false,
        reason: `No employee record found for ${input.employeeId}. Run seed_mock_data first.`,
      };
    }
    if (!record.iqamaExpiry) {
      return {
        found: true,
        hasIqama: false,
        reason: `${record.firstName} ${record.lastName} has no Iqama on file (non-KSA employee).`,
      };
    }

    const daysRemaining = Math.ceil(
      (new Date(record.iqamaExpiry).getTime() - Date.now()) /
        (24 * 60 * 60 * 1000),
    );

    return {
      found: true,
      hasIqama: true,
      employeeName: `${record.firstName} ${record.lastName}`,
      iqamaExpiry: record.iqamaExpiry,
      daysRemaining,
      urgency:
        daysRemaining <= 7
          ? "critical"
          : daysRemaining <= 30
            ? "warning"
            : "ok",
    };
  }
}
