import { LuaTool, Data } from "lua-cli";
import { z } from "zod";
import { mockEmployees } from "../../services/mockEmployees";

export default class SeedMockDataTool implements LuaTool {
  name = "seed_mock_data";
  description =
    'One-time setup: seeds the "employees" Data collection with mock employee records (used for Iqama expiry checks and as a BambooHR fallback). Safe to call more than once — it skips seeding if records already exist.';

  inputSchema = z.object({
    force: z
      .boolean()
      .default(false)
      .describe("Re-seed even if records already exist"),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const existing = await Data.get("employees", {}, 1, 1);
    if (existing.data && existing.data.length > 0 && !input.force) {
      return {
        seeded: false,
        reason:
          "employees collection already has records; pass force: true to re-seed.",
      };
    }

    let created = 0;
    for (const employee of mockEmployees) {
      await Data.create(
        "employees",
        employee,
        `${employee.firstName} ${employee.lastName} ${employee.country}`,
      );
      created++;
    }

    return { seeded: true, employeesCreated: created };
  }
}
