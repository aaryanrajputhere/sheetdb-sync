import { google } from "googleapis";
import fs from "fs";
import { env } from "../config/env";

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(fs.readFileSync("service-account.json", "utf-8")),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

export class SheetsService {
  private spreadsheetId: string;
  private currentSchema: string[] = [];

  constructor() {
    if (!env.SHEET_ID) {
      console.warn(
        "⚠️ SHEET_ID not configured - Google Sheets integration disabled",
      );
    }
    this.spreadsheetId = env.SHEET_ID || "";
  }

  async findRowById(id: string): Promise<number | null> {
    if (!this.spreadsheetId) return null;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: "Sheet1!A:F",
    });

    const rows = res.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) return i + 1;
    }
    return null;
  }

  async appendRow(data: {
    id: string;
    name: string;
    age: number;
    version: number;
    source: string;
    lastModifiedAt: string;
  }): Promise<void> {
    if (!this.spreadsheetId) return;

    await sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: "Sheet1!A:F",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            data.id,
            data.name,
            data.age,
            data.version,
            data.source,
            data.lastModifiedAt,
          ],
        ],
      },
    });
  }

  async updateRow(
    rowIndex: number,
    data: {
      id: string;
      name: string;
      age: number;
      version: number;
      source: string;
      lastModifiedAt: string;
    },
  ): Promise<void> {
    if (!this.spreadsheetId) return;

    await sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Sheet1!A${rowIndex}:F${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            data.id,
            data.name,
            data.age,
            data.version,
            data.source,
            data.lastModifiedAt,
          ],
        ],
      },
    });
  }

  async deleteRow(rowIndex: number): Promise<void> {
    if (!this.spreadsheetId) return;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0,
                dimension: "ROWS",
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });
  }

  async updateHeaderRow(columns: string[]): Promise<void> {
    if (!this.spreadsheetId) return;

    console.log(`🔄 Updating Google Sheets header row with columns:`, columns);

    // Notify Apps Script to pause change tracking
    await this.setMigrationLock(true);

    await sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: "Sheet1!A1:ZZ1",
      valueInputOption: "RAW",
      requestBody: {
        values: [columns],
      },
    });

    this.currentSchema = columns;
    console.log(`✅ Header row updated successfully`);
  }

  async appendRowDynamic(data: Record<string, any>): Promise<void> {
    if (!this.spreadsheetId) return;

    const values = this.currentSchema.map((col) => data[col] || "");

    await sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: "Sheet1!A:ZZ",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [values],
      },
    });
  }

  async updateRowDynamic(
    rowIndex: number,
    data: Record<string, any>,
  ): Promise<void> {
    if (!this.spreadsheetId) return;

    const values = this.currentSchema.map((col) => data[col] || "");

    await sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Sheet1!A${rowIndex}:ZZ${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [values],
      },
    });
  }

  setCurrentSchema(columns: string[]): void {
    this.currentSchema = columns;
  }

  getCurrentSchema(): string[] {
    return this.currentSchema;
  }

  async getSheetHeaderRow(): Promise<string[]> {
    if (!this.spreadsheetId) return [];

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: "Sheet1!A1:ZZ1",
    });

    return (res.data.values?.[0] || []) as string[];
  }

  async setMigrationLock(locked: boolean): Promise<void> {
    if (!this.spreadsheetId) return;

    try {
      const lockValue = locked ? "MIGRATING" : "READY";
      console.log(
        `${locked ? "🔒" : "🔓"} Setting migration lock: ${lockValue}`,
      );

      // Write to AA1 (column 27 - safe within grid limits) as flag cell
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: "Sheet1!AA1", // Use column AA (within 27 column limit)
        valueInputOption: "RAW",
        requestBody: {
          values: [[lockValue]],
        },
      });
    } catch (error) {
      console.error("Failed to set migration lock:", error);
    }
  }

  detectSchemaChanges(
    oldSchema: string[],
    newSchema: string[],
  ): {
    added: string[];
    removed: string[];
    renamed: Array<{ from: string; to: string }>;
  } {
    const added = newSchema.filter((col) => !oldSchema.includes(col));
    const removed = oldSchema.filter((col) => !newSchema.includes(col));
    const renamed: Array<{ from: string; to: string }> = [];

    // Detect potential renames (if one removed and one added in same position)
    if (removed.length === 1 && added.length === 1) {
      const removedIdx = oldSchema.indexOf(removed[0]);
      const addedIdx = newSchema.indexOf(added[0]);
      if (removedIdx === addedIdx) {
        renamed.push({ from: removed[0], to: added[0] });
        return { added: [], removed: [], renamed };
      }
    }

    return { added, removed, renamed };
  }

  async migrateExistingData(
    oldSchema: string[],
    newSchema: string[],
  ): Promise<void> {
    if (!this.spreadsheetId) return;

    console.log(`🔄 Migrating existing data from old schema to new schema`);

    // Get all existing rows (skip header)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: "Sheet1!A2:ZZ",
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      console.log(`ℹ️ No data to migrate`);
      await this.setMigrationLock(false);
      return;
    }

    // Map old data to new schema
    const migratedRows = rows.map((row) => {
      const oldData: Record<string, any> = {};
      oldSchema.forEach((col, idx) => {
        oldData[col] = row[idx] || "";
      });

      // Rearrange data according to new schema
      return newSchema.map((col) => oldData[col] || "");
    });

    // Update all rows at once using RAW to minimize triggers
    await sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Sheet1!A2:ZZ${rows.length + 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: migratedRows,
      },
    });

    console.log(`✅ Migrated ${rows.length} rows to new schema`);

    // Release migration lock after a delay to ensure all events settle
    setTimeout(() => {
      this.setMigrationLock(false).catch((err) =>
        console.error("Failed to release migration lock:", err),
      );
    }, 2000);
  }
}

export const sheetsService = new SheetsService();
