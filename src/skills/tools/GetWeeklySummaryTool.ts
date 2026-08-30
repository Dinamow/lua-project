import { LuaTool } from "lua-cli";
import { z } from "zod";
import GoogleSheetsService from "../../services/googleSheets.service";

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const result = new Date(d);
  result.setDate(d.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

export default class GetWeeklySummaryTool implements LuaTool {
  name = "get_weekly_summary";
  description =
    "Summarize a team's daily check-ins for a given week from the Google Sheets performance dashboard — e.g. \"How did Ahmad's team perform this week?\" Returns per-member stats plus the raw rows so the agent can phrase a natural-language summary.";

  inputSchema = z.object({
    teamLead: z.string().describe("Team lead whose team to summarize"),
    weekStartDate: z
      .string()
      .optional()
      .describe(
        "ISO date for the start of the week; defaults to the current week (Sunday-Saturday)",
      ),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const start = input.weekStartDate
      ? new Date(input.weekStartDate)
      : startOfWeek(new Date());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startIso = start.toISOString().slice(0, 10);
    const endIso = end.toISOString().slice(0, 10);

    const sheets = new GoogleSheetsService();
    const rows = await sheets.getCheckins(startIso, endIso, input.teamLead);

    const byMember = new Map<
      string,
      { ratings: number[]; blockers: string[]; accomplishments: string[] }
    >();
    for (const row of rows) {
      const bucket = byMember.get(row.teamMember) ?? {
        ratings: [],
        blockers: [],
        accomplishments: [],
      };
      bucket.ratings.push(row.rating);
      if (row.blockers && row.blockers.toLowerCase() !== "none")
        bucket.blockers.push(row.blockers);
      bucket.accomplishments.push(row.accomplishments);
      byMember.set(row.teamMember, bucket);
    }

    const perMember = Array.from(byMember.entries()).map(
      ([teamMember, bucket]) => ({
        teamMember,
        checkinsLogged: bucket.ratings.length,
        averageRating:
          Math.round(
            (bucket.ratings.reduce((a, b) => a + b, 0) /
              bucket.ratings.length) *
              10,
          ) / 10,
        blockers: bucket.blockers,
        accomplishments: bucket.accomplishments,
      }),
    );

    const allRatings = rows.map((r) => r.rating);
    const teamAverageRating = allRatings.length
      ? Math.round(
          (allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10,
        ) / 10
      : null;

    return {
      teamLead: input.teamLead,
      weekStart: startIso,
      weekEnd: endIso,
      totalCheckins: rows.length,
      teamAverageRating,
      perMember,
    };
  }
}
