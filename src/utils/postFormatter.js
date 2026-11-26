// Author is either a populated user or the request user.
// viewerId is who asked; isLiked is whether they liked this post.
export const formatPostResponse = (post, { author, viewerId, isLiked = false } = {}) => {
  const user = author || post.author;
  const authorId = (user._id || user.id).toString();
  // With hideLikeCount on, only the author sees the number
  const showLikeCount = !post.hideLikeCount || viewerId?.toString() === authorId;

  return {
    id: post._id.toString(),
    author: {
      id: authorId,
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
    likeCount: showLikeCount ? post.likeCount : null,
    commentCount: post.commentCount,
    hideLikeCount: post.hideLikeCount,
    commentsDisabled: post.commentsDisabled,
    createdAt: post.createdAt,
    isLiked,
    // Saves don't exist on the server yet
    isSaved: false,
  };
};

// The like count as this viewer may see it; author may be populated or a bare id
export const visibleLikeCount = (post, viewerId) => {
  const authorId = post.author._id || post.author;
  return !post.hideLikeCount || authorId.equals(viewerId) ? post.likeCount : null;
};
