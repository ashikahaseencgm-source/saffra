import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { lookupCustomerHandler, createCustomerHandler } from "./customers.controller.js";
import { lookupCustomerSchema, createCustomerSchema } from "./customers.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/lookup", validate(lookupCustomerSchema, "query"), lookupCustomerHandler);
router.post("/", validate(createCustomerSchema), createCustomerHandler);

export default router;
