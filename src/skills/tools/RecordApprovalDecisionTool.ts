import { LuaTool, Data, Channels } from "lua-cli";
import { z } from "zod";

export default class RecordApprovalDecisionTool implements LuaTool {
  name = "record_approval_decision";
  description =
    'Record a line manager\'s approve/reject decision on a pending leave request and confirm the outcome back to the employee. Call this when a manager replies with something like "approve <requestId>" or "reject <requestId>".';

  inputSchema = z.object({
    requestId: z.string(),
    decision: z.enum(["approved", "rejected"]),
    managerNote: z.string().optional(),
    language: z.enum(["ar", "en"]).default("en"),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    let entry;
    try {
      entry = await Data.getEntry("leave-requests", input.requestId);
    } catch (error) {
      return {
        success: false,
        reason: `No leave request found with id ${input.requestId}`,
      };
    }
    if (entry.data.status !== "pending") {
      return {
        success: false,
        reason: `Request ${input.requestId} was already ${entry.data.status}`,
      };
    }

    await entry.update({
      status: input.decision,
      managerNote: input.managerNote ?? "",
      decisionAt: new Date().toISOString(),
    });

    if (entry.data.employeePhoneNumber) {
      const approved = input.decision === "approved";
      const text =
        input.language === "ar"
          ? `طلب إجازتك (${entry.data.leaveType}, ${entry.data.startDate} إلى ${entry.data.endDate}) تم ${approved ? "الموافقة عليه" : "رفضه"}.${input.managerNote ? " ملاحظة: " + input.managerNote : ""}`
          : `Your ${entry.data.leaveType} leave request (${entry.data.startDate} to ${entry.data.endDate}) was ${approved ? "approved" : "rejected"}.${input.managerNote ? " Note: " + input.managerNote : ""}`;

      await Channels.send({
        channel: "whatsapp",
        to: { phoneNumber: entry.data.employeePhoneNumber },
        text,
      }).catch((error) => console.warn("Could not notify employee:", error));
    }

    return {
      success: true,
      requestId: input.requestId,
      status: input.decision,
      employeeName: entry.data.employeeName,
    };
  }
}
