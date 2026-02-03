import { google } from "googleapis";
import fs from "fs";

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(fs.readFileSync("service-account.json", "utf-8")),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const sheets = google.sheets({ version: "v4", auth });

export async function findRowById(id: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: "Sheet1!A:F",
  });

  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) return i + 1;
  }
  return null;
}
