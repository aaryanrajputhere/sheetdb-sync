import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { dbToSheetQueue, sheetToDbQueue } from "../queues";

export function setupBullBoard(app: any) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: [
      new BullMQAdapter(dbToSheetQueue),
      new BullMQAdapter(sheetToDbQueue),
    ],
    serverAdapter,
  });

  app.use("/admin/queues", serverAdapter.getRouter());

  console.log("✅ Bull Board configured at /admin/queues");
}
