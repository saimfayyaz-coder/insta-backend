import Todo from "../models/Todo.js";
import ApiResponse from "../utils/ApiResponse.js";
import { ErrorCodes } from "../utils/ErrorCodes.js";

const formatTodo = (todo) => ({
  clientId: todo.clientId,
  title: todo.title,
  description: todo.description,
  completed: todo.completed,
  updatedAt: todo.updatedAt,
});

const isFilled = (value) => typeof value === "string" && value.trim().length > 0;

export const getTodos = async (req, res) => {
  try {
    const todos = await Todo.find({ userId: req.user._id }).sort({ createdAt: -1 });

    return res
      .status(200)
      .json(new ApiResponse(true, "Todos fetched", { todos: todos.map(formatTodo) }));
  } catch (error) {
    console.error("Get todos error:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, "Internal server error", null, null, ErrorCodes.SERVER_ERROR));
  }
};

// Creates or updates, so sending the same request twice is safe
export const saveTodo = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { title, description, completed = false } = req.body;

    if (!isFilled(title) || !isFilled(description)) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            false,
            "Title and description are required",
            null,
            null,
            ErrorCodes.VALIDATION_FAILED,
          ),
        );
    }

    const todo = await Todo.findOneAndUpdate(
      { userId: req.user._id, clientId },
      { title, description, completed: Boolean(completed) },
      { new: true, upsert: true, runValidators: true },
    );

    return res.status(200).json(new ApiResponse(true, "Todo saved", { todo: formatTodo(todo) }));
  } catch (error) {
    console.error("Save todo error:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, "Internal server error", null, null, ErrorCodes.SERVER_ERROR));
  }
};

// Succeeds even if the todo is already gone, so a retried delete doesn't fail
export const deleteTodo = async (req, res) => {
  try {
    await Todo.deleteOne({ userId: req.user._id, clientId: req.params.clientId });

    return res.status(200).json(new ApiResponse(true, "Todo deleted"));
  } catch (error) {
    console.error("Delete todo error:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, "Internal server error", null, null, ErrorCodes.SERVER_ERROR));
  }
};
