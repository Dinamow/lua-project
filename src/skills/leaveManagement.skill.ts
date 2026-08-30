import { LuaSkill } from "lua-cli";
import CheckLeaveBalanceTool from "./tools/CheckLeaveBalanceTool";
import CalculateLeaveEntitlementTool from "./tools/CalculateLeaveEntitlementTool";
import SubmitLeaveRequestTool from "./tools/SubmitLeaveRequestTool";
import RecordApprovalDecisionTool from "./tools/RecordApprovalDecisionTool";

const leaveManagementSkill = new LuaSkill({
  name: "leave-management-skill",
  description:
    "Handles employee leave requests: balance checks, country entitlement rules, submission, and manager approval routing.",
  context: `Use these tools whenever an employee (in Arabic or English) asks about leave/vacation, or a line manager responds to a leave request.

Typical flow for an employee request ("I want 5 days annual leave starting Sept 10"):
1. check_leave_balance — get their country, tenure, and current balances.
2. calculate_leave_entitlement — explain their yearly entitlement if relevant (e.g. they ask "how many days do I get?").
3. submit_leave_request — validates against balance and files the request; it notifies the line manager automatically.
4. Tell the employee their request is pending manager approval and give them the request id.

When a manager's message looks like a decision on a specific request (e.g. "approve req_abc123" or "reject req_abc123, needs more notice"), call record_approval_decision — it updates the record and notifies the employee automatically. Never fabricate a requestId; only use one that appeared earlier in the conversation or was given by the manager.

Always reply in the same language (Arabic or English) the user is writing in.`,
  tools: [
    new CheckLeaveBalanceTool(),
    new CalculateLeaveEntitlementTool(),
    new SubmitLeaveRequestTool(),
    new RecordApprovalDecisionTool(),
  ],
});

export default leaveManagementSkill;
