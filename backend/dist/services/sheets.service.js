"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sheetsService = exports.SheetsService = void 0;
const googleapis_1 = require("googleapis");
const fs_1 = __importDefault(require("fs"));
const env_1 = require("../config/env");
const auth = new googleapis_1.google.auth.GoogleAuth({
    credentials: JSON.parse(fs_1.default.readFileSync("service-account.json", "utf-8")),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = googleapis_1.google.sheets({ version: "v4", auth });
class SheetsService {
    constructor() {
        if (!env_1.env.SHEET_ID) {
            console.warn("⚠️ SHEET_ID not configured - Google Sheets integration disabled");
        }
        this.spreadsheetId = env_1.env.SHEET_ID || "";
    }
    async findRowById(id) {
        if (!this.spreadsheetId)
            return null;
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: "Sheet1!A:F",
        });
        const rows = res.data.values || [];
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === id)
                return i + 1;
        }
        return null;
    }
    async appendRow(data) {
        if (!this.spreadsheetId)
            return;
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
    async updateRow(rowIndex, data) {
        if (!this.spreadsheetId)
            return;
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
    async deleteRow(rowIndex) {
        if (!this.spreadsheetId)
            return;
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
}
exports.SheetsService = SheetsService;
exports.sheetsService = new SheetsService();
