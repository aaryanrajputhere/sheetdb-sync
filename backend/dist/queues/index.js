"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sheetToDbQueue = exports.dbToSheetQueue = void 0;
var db_to_sheet_queue_1 = require("./db-to-sheet.queue");
Object.defineProperty(exports, "dbToSheetQueue", { enumerable: true, get: function () { return db_to_sheet_queue_1.dbToSheetQueue; } });
var sheet_to_db_queue_1 = require("./sheet-to-db.queue");
Object.defineProperty(exports, "sheetToDbQueue", { enumerable: true, get: function () { return sheet_to_db_queue_1.sheetToDbQueue; } });
