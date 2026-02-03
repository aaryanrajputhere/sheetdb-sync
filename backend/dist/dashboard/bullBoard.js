"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupBullBoard = setupBullBoard;
const api_1 = require("@bull-board/api");
const bullMQAdapter_1 = require("@bull-board/api/bullMQAdapter");
const express_1 = require("@bull-board/express");
const queues_1 = require("../queues");
function setupBullBoard(app) {
    const serverAdapter = new express_1.ExpressAdapter();
    serverAdapter.setBasePath("/admin/queues");
    (0, api_1.createBullBoard)({
        queues: [
            new bullMQAdapter_1.BullMQAdapter(queues_1.dbToSheetQueue),
            new bullMQAdapter_1.BullMQAdapter(queues_1.sheetToDbQueue),
        ],
        serverAdapter,
    });
    app.use("/admin/queues", serverAdapter.getRouter());
    console.log("✅ Bull Board configured at /admin/queues");
}
