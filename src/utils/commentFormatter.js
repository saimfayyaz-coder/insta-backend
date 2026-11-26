// Author is either a populated user or the request user.
// viewerId is who asked; postAuthorId lets the post owner delete any comment on their post.
export const formatCommentResponse = (
  comment,
  { author, postAuthorId, viewerId } = {},
) => {
  const user = author || comment.author;
  const authorId = (user._id || user.id).toString();
  const viewer = viewerId?.toString();
  const postOwner = postAuthorId?.toString();

  return {
    id: comment._id.toString(),
    postId: (comment.post._id || comment.post).toString(),
    author: {
      id: authorId,
      username: user.username,
      avatarUrl: user.avatar?.url || null,
    },
    text: comment.text,
    canDelete: Boolean(
      viewer && (viewer === authorId || (postOwner && viewer === postOwner)),
    ),
    createdAt: comment.createdAt,
  };
};
