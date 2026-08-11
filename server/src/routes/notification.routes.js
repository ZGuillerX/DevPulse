import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as AlertService from "../services/alert.service.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === "true";
    const notifications = await AlertService.listNotifications(req.user.id, { unreadOnly });
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

router.patch("/:notificationId/read", async (req, res, next) => {
  try {
    await AlertService.markNotificationRead(req.params.notificationId, req.user.id);
    res.json({ message: "Notificación marcada como leída." });
  } catch (err) {
    next(err);
  }
});

export default router;
