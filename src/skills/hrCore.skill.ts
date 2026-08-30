import { LuaSkill } from "lua-cli";
import CalculateGratuityTool from "./tools/CalculateGratuityTool";
import CheckIqamaExpiryTool from "./tools/CheckIqamaExpiryTool";
import SeedMockDataTool from "./tools/SeedMockDataTool";

const hrCoreSkill = new LuaSkill({
  name: "hr-core-skill",
  description:
    "Cross-cutting HR utilities: gratuity calculation, Iqama expiry lookups, and one-time mock data setup.",
  context: `Use calculate_gratuity whenever an employee or HR asks about end-of-service pay, gratuity, or "how much would I get if I resigned/were let go".

Use check_iqama_expiry when someone asks about Iqama/residency expiry for a specific KSA employee.

Use seed_mock_data once, the first time this agent is tested, to populate demo employee records — mention it in setup instructions, not something an end user would normally ask for.

Always reply in the same language (Arabic or English) the user is writing in.`,
  tools: [
    new CalculateGratuityTool(),
    new CheckIqamaExpiryTool(),
    new SeedMockDataTool(),
  ],
});

export default hrCoreSkill;
