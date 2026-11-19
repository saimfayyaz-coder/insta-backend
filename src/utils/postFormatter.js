// Author is either a populated user or the request user
export const formatPostResponse = (post, author) => {
  const user = author || post.author;

  return {
    id: post._id.toString(),
    author: {
      id: (user._id || user.id).toString(),
      username: user.username,
      avatarUrl: user.avatar?.url || null,
    },
    media: post.media.map((item) => ({
      id: item._id.toString(),
      url: item.url,
      thumbUrl: item.thumbUrl,
      width: item.width,
      height: item.height,
      altText: item.altText || "",
    })),
    aspectRatio: post.aspectRatio,
    caption: post.caption || "",
    location: post.location || "",
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    hideLikeCount: post.hideLikeCount,
    commentsDisabled: post.commentsDisabled,
    createdAt: post.createdAt,
    // Likes and saves don't exist on the server yet
    isLiked: false,
    isSaved: false,
  };
};

const CURSOR_SEPARATOR = "_";

export const encodePostCursor = (post) =>
  Buffer.from(`${post.createdAt.toISOString()}${CURSOR_SEPARATOR}${post._id}`).toString("base64url");

export const decodePostCursor = (cursor) => {
  try {
    const [createdAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split(CURSOR_SEPARATOR);
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime()) || !/^[a-f0-9]{24}$/.test(id)) return null;
    return { createdAt: date, id };
  } catch {
    return null;
  }
};
