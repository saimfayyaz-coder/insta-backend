const formatLinks = (links = []) =>
  links.map((link) => ({
    _id: link._id ? link._id.toString() : (link.id || ''),
    url: link.url,
    title: link.title || '',
  }));

export const formatUserResponse = (user) => ({
  id: user._id || user.id,
  name: user.name || "",
  username: user.username,
  email: user.email,
  avatar: user.avatar || null,
  avatarUrl: user.avatar?.url || null,
  bio: user.bio || "",
  website: user.website || "",
  links: formatLinks(user.links),
  gender: user.gender || "prefer_not_to_say",
  isVerified: user.isVerified,
  postsCount: user.postsCount || 0,
  followersCount: user.followersCount || 0,
  followingCount: user.followingCount || 0,
});

// Another user's profile, as the viewer sees it
export const formatPublicProfile = (user, isFollowing) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  avatar: user.avatar,
  avatarUrl: user.avatar?.url || null,
  bio: user.bio,
  website: user.website,
  links: formatLinks(user.links),
  isVerified: user.isVerified,
  postsCount: user.postsCount || 0,
  followersCount: user.followersCount || 0,
  followingCount: user.followingCount || 0,
  isFollowing,
});

// A row in followers, following and search lists
export const formatUserSummary = (user, isFollowing) => ({
  id: user._id.toString(),
  username: user.username,
  name: user.name || "",
  avatarUrl: user.avatar?.url || null,
  isFollowing,
});

export const USER_SUMMARY_FIELDS = "username name avatar";
