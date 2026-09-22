import crypto from "crypto";

/**
 * Generate a secure 6-digit OTP code and expiry (10 minutes).
 */
export const generateOtp = () => {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return { code, expiresAt };
};

/**
 * Send OTP to the target email.
 * Falls back to console logging in development for seamless local testing.
 */
export const sendOtpEmail = async (email, code, purpose = "verification") => {
  console.log("\n==================================================");
  console.log(`🔑 [AUTH OTP CODE] Target: ${email}`);
  console.log(`🔢 Code: ${code}`);
  console.log(`⏱️  Expires in: 10 minutes`);
  console.log(`📋 Purpose: ${purpose}`);
  console.log("==================================================\n");

  // If SMTP environment variables are configured, attempt real email transmission
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      // Dynamic import to keep nodemailer optional if not yet installed
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransporter({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Instagram Clone" <no-reply@instagramclone.com>',
        to: email,
        subject: `${code} is your Instagram verification code`,
        text: `Your Instagram confirmation code is ${code}. It expires in 10 minutes.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #dbdbdb; border-radius: 8px;">
            <h2 style="color: #262626; margin-bottom: 16px;">Confirm your email address</h2>
            <p style="color: #737373; font-size: 14px; line-height: 1.5;">Use the following 6-digit confirmation code to complete your Instagram registration:</p>
            <div style="background-color: #fafafa; border: 1px dashed #0095f6; border-radius: 6px; padding: 16px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0095f6;">${code}</span>
            </div>
            <p style="color: #8e8e8e; font-size: 12px;">This code will expire in 10 minutes. If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      });
    } catch (err) {
      console.warn("⚠️ SMTP email sending failed, logged to console instead:", err.message);
    }
  }

  return true;
};
