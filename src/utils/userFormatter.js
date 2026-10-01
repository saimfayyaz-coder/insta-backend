export const formatUserResponse = (user) => ({
  id: user._id || user.id,
  name: user.name || "",
  username: user.username,
  email: user.email,
  avatar: user.avatar || null,
  avatarUrl: user.avatar?.url || null,
  bio: user.bio || "",
  website: user.website || "",
  gender: user.gender || "prefer_not_to_say",
  isVerified: user.isVerified,
});
