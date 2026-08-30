// Performance dashboard backed by a Google Sheet. No Integrations passthrough covers
// Sheets, so this does the service-account JWT exchange by hand with crypto + axios —
// google-auth-library pulls in gaxios, which needs a global ReadableStream that Lua's
// sandboxed runtime doesn't have.
//
// Env (via `lua env`): GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
// GOOGLE_SHEET_ID. Share the sheet with the service account as Editor. Expects a
// "Checkins" tab: Date | Team Lead | Team Member | Accomplishments | Blockers | Rating

import crypto from "node:crypto";
import axios from "axios";
import { env } from "lua-cli";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_TAB = "Checkins";
const HEADER_ROW = [
  "Date",
  "Team Lead",
  "Team Member",
  "Accomplishments",
  "Blockers",
  "Rating",
];

export interface CheckinRow {
  date: string; // ISO date
  teamLead: string;
  teamMember: string;
  accomplishments: string;
  blockers: string;
  rating: number; // 1-5
}

export default class GoogleSheetsService {
  private async getAccessToken(): Promise<string> {
    const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKey = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")?.replace(
      /\\n/g,
      "\n",
    );
    if (!email || !privateKey) {
      throw new Error(
        "Google Sheets is not configured — set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY with `lua env`.",
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const base64url = (payload: object) =>
      Buffer.from(JSON.stringify(payload)).toString("base64url");
    const unsigned = `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })}`;
    const signature = crypto
      .createSign("RSA-SHA256")
      .update(unsigned)
      .sign(privateKey, "base64url");
    const assertion = `${unsigned}.${signature}`;

    const { data } = await axios.post("https://oauth2.googleapis.com/token", {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });
    if (!data.access_token)
      throw new Error("Failed to obtain a Google access token.");
    return data.access_token;
  }

  private getSheetId(): string {
    const sheetId = env("GOOGLE_SHEET_ID");
    if (!sheetId)
      throw new Error("GOOGLE_SHEET_ID is not set — set it with `lua env`.");
    return sheetId;
  }

  private async authHeaders() {
    return { Authorization: `Bearer ${await this.getAccessToken()}` };
  }

  async appendCheckin(row: CheckinRow): Promise<void> {
    const headers = await this.authHeaders();
    await axios.post(
      `${SHEETS_API_BASE}/${this.getSheetId()}/values/${encodeURIComponent(`${SHEET_TAB}!A:F`)}:append`,
      {
        values: [
          [
            row.date,
            row.teamLead,
            row.teamMember,
            row.accomplishments,
            row.blockers,
            row.rating,
          ],
        ],
      },
      { headers, params: { valueInputOption: "USER_ENTERED" } },
    );
  }

  /** All check-in rows between two ISO dates (inclusive), optionally filtered by team lead. */
  async getCheckins(
    startDate: string,
    endDate: string,
    teamLead?: string,
  ): Promise<CheckinRow[]> {
    const headers = await this.authHeaders();
    const res = await axios.get(
      `${SHEETS_API_BASE}/${this.getSheetId()}/values/${encodeURIComponent(`${SHEET_TAB}!A2:F`)}`,
      { headers },
    );

    const rows: string[][] = res.data.values || [];
    return rows
      .map((r): CheckinRow => ({
        date: r[0],
        teamLead: r[1],
        teamMember: r[2],
        accomplishments: r[3],
        blockers: r[4],
        rating: Number(r[5]),
      }))
      .filter((r) => r.date >= startDate && r.date <= endDate)
      .filter(
        (r) => !teamLead || r.teamLead.toLowerCase() === teamLead.toLowerCase(),
      );
  }

  /** Creates the sheet tab + header row if they don't exist yet. Safe to call repeatedly. */
  async ensureSheetReady(): Promise<void> {
    const headers = await this.authHeaders();
    const spreadsheetId = this.getSheetId();
    const meta = await axios.get(`${SHEETS_API_BASE}/${spreadsheetId}`, {
      headers,
    });
    const hasTab = meta.data.sheets?.some(
      (s: any) => s.properties?.title === SHEET_TAB,
    );

    if (!hasTab) {
      await axios.post(
        `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
        { requests: [{ addSheet: { properties: { title: SHEET_TAB } } }] },
        { headers },
      );
      await axios.post(
        `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(`${SHEET_TAB}!A:F`)}:append`,
        { values: [HEADER_ROW] },
        { headers, params: { valueInputOption: "USER_ENTERED" } },
      );
    }
  }
}
