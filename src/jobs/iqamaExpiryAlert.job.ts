// Scans the employee directory for Iqamas expiring within 30/14/7 days and
// pings the employee and their manager over WhatsApp.

import { LuaJob, Data, Channels } from "lua-cli";

const ALERT_THRESHOLDS = [30, 14, 7];

const iqamaExpiryAlertJob = new LuaJob({
  name: "iqama-expiry-alert",
  description:
    "Daily check for KSA employees with an Iqama expiring soon; sends WhatsApp reminders.",

  schedule: {
    type: "cron",
    expression: "0 7 * * *", // Every day at 7am
    timezone: "Asia/Riyadh",
  },

  timeout: 120,
  retry: { maxAttempts: 2, backoffSeconds: 60 },

  execute: async () => {
    const employeesResponse = await Data.get("employees", {}, 1, 500);
    const employees = employeesResponse.data || [];

    let alertsSent = 0;

    for (const entry of employees) {
      const employee = entry.data;
      if (!employee.iqamaExpiry) continue;

      const daysRemaining = Math.ceil(
        (new Date(employee.iqamaExpiry).getTime() - Date.now()) /
          (24 * 60 * 60 * 1000),
      );

      if (!ALERT_THRESHOLDS.includes(daysRemaining)) continue;

      const text = `⚠️ Iqama expiry reminder: ${employee.firstName} ${employee.lastName}'s Iqama expires on ${employee.iqamaExpiry} (${daysRemaining} day(s) remaining). Please initiate renewal.`;

      if (employee.phoneNumber) {
        await Channels.send({
          channel: "whatsapp",
          to: { phoneNumber: employee.phoneNumber },
          text,
        }).catch((error) =>
          console.warn(`Could not notify ${employee.id}:`, error),
        );
        alertsSent++;
      }

      const supervisor = employees.find(
        (e: any) => e.data.id === employee.supervisorId,
      )?.data;
      if (supervisor?.phoneNumber && supervisor.id !== employee.id) {
        await Channels.send({
          channel: "whatsapp",
          to: { phoneNumber: supervisor.phoneNumber },
          text: `HR notice: your team member ${employee.firstName} ${employee.lastName}'s Iqama expires in ${daysRemaining} day(s) (${employee.iqamaExpiry}).`,
        }).catch((error) =>
          console.warn(`Could not notify supervisor of ${employee.id}:`, error),
        );
      }
    }

    return {
      success: true,
      employeesScanned: employees.length,
      alertsSent,
      ranAt: new Date().toISOString(),
    };
  },
});

export default iqamaExpiryAlertJob;
