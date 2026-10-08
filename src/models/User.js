import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: '',
      maxlength: 50,
    },

    avatar: {
      url: {
        type: String,
        default: null,
      },
      publicId: {
        type: String,
        default: null,
      },
    },

    bio: {
      type: String,
      trim: true,
      default: '',
      maxlength: [150, 'Bio cannot exceed 150 characters'],
    },

    website: {
      type: String,
      trim: true,
      default: '',
    },

    links: [
      {
        url: {
          type: String,
          trim: true,
          required: true,
        },
        title: {
          type: String,
          trim: true,
          default: '',
          maxlength: 100,
        },
      },
    ],

    gender: {
      type: String,
      enum: ['male', 'female', 'custom', 'prefer_not_to_say'],
      default: 'prefer_not_to_say',
    },

    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [
        /^[a-zA-Z0-9._]+$/,
        "Username can only contain letters, numbers, periods, and underscores",
      ],
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    otp: {
      code: {
        type: String,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
    },

    refreshToken: {
      type: String,
      default: null,
      select: false,
    },

    deviceToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);

export default User;
