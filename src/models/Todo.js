import mongoose from "mongoose";

const todoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Id made on the phone, so a retried request updates the same todo instead of adding a copy
    clientId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

todoSchema.index({ userId: 1, clientId: 1 }, { unique: true });

const Todo = mongoose.model("Todo", todoSchema);

export default Todo;
