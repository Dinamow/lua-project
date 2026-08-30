// Wraps BambooHR's REST API via Lua's Integrations passthrough (see
// https://documentation.bamboohr.com/reference/get-employee). Falls back to
// mockEmployees.ts when the integration isn't connected.

import { Integrations } from "lua-cli";
import {
  findEmployee,
  mockEmployees,
  type MockEmployee,
} from "./mockEmployees";

export interface EmployeeRecord {
  id: string;
  firstName: string;
  lastName: string;
  /** Free-form as returned by the HRIS — not limited to the 4 jurisdictions leaveRules.ts models. */
  country: string;
  hireDate: string;
  monthlyBasicSalary: number;
  phoneNumber: string;
  email: string;
  supervisorId: string;
  supervisorPhoneNumber?: string;
}

export interface TimeOffBalance {
  leaveType: string;
  balanceDays: number;
  /** BambooHR's numeric time-off-type id, required by createTimeOffRequest's timeOffTypeId. Undefined for mock data. */
  timeOffTypeId?: string;
}

function toEmployeeRecord(m: MockEmployee): EmployeeRecord {
  const supervisor = mockEmployees.find((e) => e.id === m.supervisorId);
  return {
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    country: m.country,
    hireDate: m.hireDate,
    monthlyBasicSalary: m.monthlyBasicSalary,
    phoneNumber: m.phoneNumber,
    email: m.email,
    supervisorId: m.supervisorId,
    supervisorPhoneNumber: supervisor?.phoneNumber,
  };
}

export default class BambooHRService {
  /** Fetch one employee by BambooHR id (or mock id/email as a fallback). */
  async getEmployee(idOrEmail: string): Promise<EmployeeRecord> {
    try {
      const res = await Integrations.passthrough("bamboohr", {
        method: "GET",
        path: `v1/employees/${idOrEmail}`,
        query: {
          fields:
            "firstName,lastName,country,hireDate,payRate,workPhone,workEmail,supervisorEId",
        },
        headers: { Accept: "application/json" },
      });
      if (res.status >= 200 && res.status < 300 && res.data) {
        return this.mapBambooHRResponse(res.data);
      }
      console.warn(
        `BambooHR passthrough returned ${res.status} for ${idOrEmail}; using mock data.`,
      );
    } catch (error) {
      console.warn(
        "BambooHR integration not available; using mock data.",
        error,
      );
    }

    const mock = findEmployee(idOrEmail);
    if (!mock)
      throw new Error(
        `No employee found for "${idOrEmail}" (checked BambooHR and mock directory)`,
      );
    return toEmployeeRecord(mock);
  }

  /** Fetch time-off balances for an employee across the leave types we model. */
  async getTimeOffBalances(employeeId: string): Promise<TimeOffBalance[]> {
    try {
      const res = await Integrations.passthrough("bamboohr", {
        method: "GET",
        path: `v1/employees/${employeeId}/time_off/calculator`,
        headers: { Accept: "application/json" },
      });
      if (res.status >= 200 && res.status < 300 && Array.isArray(res.data)) {
        return res.data.map((entry: any) => ({
          leaveType: this.mapTimeOffType(entry.name),
          balanceDays: Number(entry.balance ?? 0),
          timeOffTypeId:
            entry.timeOffType !== undefined
              ? String(entry.timeOffType)
              : undefined,
        }));
      }
      console.warn(
        `BambooHR time-off passthrough returned ${res.status} for ${employeeId}; using mock balances.`,
      );
    } catch (error) {
      console.warn(
        "BambooHR integration not available; using mock balances.",
        error,
      );
    }

    // Deterministic mock balances so the demo is repeatable.
    return [
      { leaveType: "annual", balanceDays: 14 },
      { leaveType: "sick", balanceDays: 8 },
      { leaveType: "emergency", balanceDays: 3 },
    ];
  }

  /** Creates a time-off request in BambooHR; no-op if not connected (caller persists it locally either way). */
  async createTimeOffRequest(input: {
    employeeId: string;
    leaveType: string;
    timeOffTypeId?: string;
    startDate: string;
    endDate: string;
    amountDays: number;
  }): Promise<{ createdInBambooHR: boolean; bambooHRRequestId?: string }> {
    try {
      const res = await Integrations.passthrough("bamboohr", {
        method: "PUT",
        path: `v1/employees/${input.employeeId}/time_off/request`,
        data: {
          status: "requested",
          start: input.startDate,
          end: input.endDate,
          timeOffTypeId: input.timeOffTypeId ?? input.leaveType,
          amount: input.amountDays,
        },
        headers: { Accept: "application/json" },
      });
      if (res.status >= 200 && res.status < 300) {
        const data = res.data as { id?: string } | undefined;
        return { createdInBambooHR: true, bambooHRRequestId: data?.id };
      }
      console.warn(
        `BambooHR time-off creation returned ${res.status}; recording locally only.`,
      );
    } catch (error) {
      console.warn(
        "BambooHR integration not available; recording locally only.",
        error,
      );
    }
    return { createdInBambooHR: false };
  }

  private mapTimeOffType(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "_").trim();
  }

  private mapBambooHRResponse(data: any): EmployeeRecord {
    return {
      id: String(data.id),
      firstName: data.firstName,
      lastName: data.lastName,
      country: (data.country || "KSA").toUpperCase(),
      hireDate: data.hireDate,
      monthlyBasicSalary: Number(data.payRate?.replace(/[^0-9.]/g, "") || 0),
      phoneNumber: data.workPhone,
      email: data.workEmail,
      supervisorId: String(data.supervisorEId ?? ""),
    };
  }
}
