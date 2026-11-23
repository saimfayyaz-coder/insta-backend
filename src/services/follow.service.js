import Follow from "../models/Follow.js";

// Ids (as strings) of the given users that the viewer follows, in one query
export const getFollowedIds = async (viewerId, userIds) => {
  if (userIds.length === 0) return new Set();
  const follows = await Follow.find({ follower: viewerId, following: { $in: userIds } }).select(
    "following",
  );
  return new Set(follows.map((follow) => follow.following.toString()));
};

export const isFollowingUser = async (viewerId, userId) =>
  Boolean(await Follow.exists({ follower: viewerId, following: userId }));
