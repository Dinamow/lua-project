import { LuaSkill } from "lua-cli";
import RecordDailyCheckinTool from "./tools/RecordDailyCheckinTool";
import GetWeeklySummaryTool from "./tools/GetWeeklySummaryTool";

const performanceManagementSkill = new LuaSkill({
  name: "performance-management-skill",
  description:
    "Collects daily team check-ins into a live Google Sheets dashboard and summarizes weekly performance on request.",
  context: `Use record_daily_checkin when a team lead reports on a team member's day — accomplishments, blockers, and a 1-5 rating. If any of those are missing, ask for them before calling the tool; don't guess a rating.

Use get_weekly_summary when someone asks how a team performed over a week (e.g. "How did Ahmad's team perform this week?"). Turn the returned per-member stats and blockers into a short natural-language summary rather than dumping raw JSON.

Always reply in the same language (Arabic or English) the user is writing in.`,
  tools: [new RecordDailyCheckinTool(), new GetWeeklySummaryTool()],
});

export default performanceManagementSkill;
