import mongoose from "mongoose";

const CURSOR_SEPARATOR = "_";

// Cursors point at the last item of a page sorted by createdAt and _id, newest first
export const encodeCursor = (doc) =>
  Buffer.from(`${doc.createdAt.toISOString()}${CURSOR_SEPARATOR}${doc._id}`).toString("base64url");

export const decodeCursor = (cursor) => {
  try {
    const [createdAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split(CURSOR_SEPARATOR);
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime()) || !/^[a-f0-9]{24}$/.test(id)) return null;
    return { createdAt: date, id };
  } catch {
    return null;
  }
};

// Filter for the items after the cursor
export const afterCursor = (cursor) => ({
  $or: [
    { createdAt: { $lt: cursor.createdAt } },
    { createdAt: cursor.createdAt, _id: { $lt: new mongoose.Types.ObjectId(cursor.id) } },
  ],
});
