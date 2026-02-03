"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sheets = void 0;
exports.findRowById = findRowById;
const googleapis_1 = require("googleapis");
const fs_1 = __importDefault(require("fs"));
const auth = new googleapis_1.google.auth.GoogleAuth({
    credentials: JSON.parse(fs_1.default.readFileSync("service-account.json", "utf-8")),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
exports.sheets = googleapis_1.google.sheets({ version: "v4", auth });
async function findRowById(id) {
    const res = await exports.sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: "Sheet1!A:F",
    });
    const rows = res.data.values || [];
    for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id)
            return i + 1;
    }
    return null;
}
