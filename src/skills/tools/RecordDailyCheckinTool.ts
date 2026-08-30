import { LuaTool } from "lua-cli";
import { z } from "zod";
import GoogleSheetsService from "../../services/googleSheets.service";

export default class RecordDailyCheckinTool implements LuaTool {
  name = "record_daily_checkin";
  description =
    "Record a team lead's daily check-in for one team member (what was accomplished, blockers, and a 1-5 productivity rating). Appends a row to the live Google Sheets performance dashboard. Ask the team lead for each field if they don't provide it up front.";

  inputSchema = z.object({
    teamLead: z
      .string()
      .describe("Name of the team lead submitting the check-in"),
    teamMember: z
      .string()
      .describe("Name of the team member the check-in is about"),
    accomplishments: z.string(),
    blockers: z.string().default("None"),
    rating: z
      .number()
      .int()
      .min(1)
      .max(5)
      .describe("Productivity rating, 1 (poor) to 5 (excellent)"),
    date: z.string().optional().describe("ISO date; defaults to today"),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const sheets = new GoogleSheetsService();
    await sheets.ensureSheetReady();

    const date = input.date ?? new Date().toISOString().slice(0, 10);
    await sheets.appendCheckin({
      date,
      teamLead: input.teamLead,
      teamMember: input.teamMember,
      accomplishments: input.accomplishments,
      blockers: input.blockers,
      rating: input.rating,
    });

    return {
      success: true,
      date,
      teamMember: input.teamMember,
      rating: input.rating,
    };
  }
}
