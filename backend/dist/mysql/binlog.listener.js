"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBinlogListener = startBinlogListener;
const mysql_events_1 = __importStar(require("@rodrigogs/mysql-events"));
const queues_1 = require("../queues");
async function startBinlogListener() {
    const instance = new mysql_events_1.default({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    }, {
        startAtEnd: true,
    });
    await instance.start();
    instance.addTrigger({
        name: "users-table-sync",
        expression: `${process.env.DB_NAME}.users`,
        statement: mysql_events_1.STATEMENTS.ALL,
        onEvent: async (event) => {
            console.log("📦 BINLOG EVENT:", JSON.stringify(event, null, 2));
            const row = event.affectedRows?.[0]?.after;
            if (!row)
                return;
            // Determine action based on event type
            let action;
            if (event.type === "INSERT")
                action = "insert";
            else if (event.type === "UPDATE")
                action = "update";
            else if (event.type === "DELETE")
                action = "delete";
            else
                return; // Unknown event type
            await queues_1.dbToSheetQueue.add("db_to_sheet", {
                action,
                source: "db",
                table: "users",
                recordId: row.id,
                data: {
                    name: row.name,
                    age: row.age,
                },
                version: row.version,
                lastModifiedAt: row.last_modified_at,
            });
        },
    });
    console.log("✅ Binlog listener started");
}
