import express from "express";
import { getTodos, saveTodo, deleteTodo } from "../controllers/todo.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getTodos);

router.put("/:clientId", saveTodo);

router.delete("/:clientId", deleteTodo);

export default router;
