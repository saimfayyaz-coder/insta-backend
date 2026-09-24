import jwt from "jsonwebtoken";

export const generateAccessToken = (userId) => {
  return jwt.sign(
    {
      userId,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    },
  );
};

export const generateRefreshToken = (userId) => {
  return jwt.sign(
    {
      userId,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    },
  );
};

export const generateResetToken = (userId, email) => {
  return jwt.sign(
    {
      userId,
      email,
      purpose: "reset_password",
    },
    process.env.RESET_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "15m",
    },
  );
};

export const verifyResetToken = (token) => {
  return jwt.verify(
    token,
    process.env.RESET_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET,
  );
};

