import { Router } from "express";
import healthRoutes from "./health.routes";
import webhookRoutes from "./webhook.routes";

const router = Router();

router.use("/", healthRoutes);
router.use("/webhook", webhookRoutes);

export default router;
