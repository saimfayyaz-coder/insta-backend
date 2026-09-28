import crypto from "crypto";
import nodemailer from "nodemailer";

let cachedTransporter = null;

const getTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } =
    process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: SMTP_SECURE === "true",
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return cachedTransporter;
};

export const generateOtp = () => {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  return { code, expiresAt };
};

const getEmailContent = (code, purpose) => {
  const isForgotPassword = purpose === "forgot_password";

  const subject = isForgotPassword
    ? `${code} is your Instagram password reset code`
    : `${code} is your Instagram confirmation code`;

  const title = isForgotPassword
    ? "Reset your password"
    : "Confirm your email address";

  const message = isForgotPassword
    ? "Use the following 6-digit confirmation code to reset your Instagram password:"
    : "Use the following 6-digit confirmation code to complete your Instagram registration:";

  const text = `Your confirmation code is ${code}. It expires in 10 minutes.`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fafafa; padding: 40px 16px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 460px; background-color: #ffffff; border: 1px solid #dbdbdb; border-radius: 8px; padding: 32px 24px;">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #262626; letter-spacing: -0.5px;">Instagram</h1>
                  </td>
                </tr>
                <tr>
                  <td>
                    <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #262626;">${title}</h2>
                    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 20px; color: #737373;">${message}</p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <div style="background-color: #f7f7f7; border: 1px dashed #0095f6; border-radius: 6px; padding: 18px; margin: 0 0 24px 0; letter-spacing: 8px; font-size: 32px; font-weight: 700; color: #0095f6;">
                      ${code}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 12px; line-height: 18px; color: #8e8e8e;">
                      This code expires in 10 minutes. If you did not request this code, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return { subject, text, html };
};

export const sendOtpEmail = async (email, code, purpose = "verification") => {
  // Always log in development for immediate visibility
  console.log("\n==================================================");
  console.log(`🔑 [AUTH OTP CODE] Target: ${email}`);
  console.log(`🔢 Code: ${code}`);
  console.log(`⏱️  Expires in: 10 minutes`);
  console.log(`📋 Purpose: ${purpose}`);
  console.log("==================================================\n");

  const transporter = getTransporter();

  if (transporter) {
    try {
      const { subject, text, html } = getEmailContent(code, purpose);

      await transporter.sendMail({
        from:
          process.env.SMTP_FROM ||
          '"Instagram Clone" <no-reply@instagramclone.com>',
        to: email,
        subject,
        text,
        html,
      });

      console.log(`📧 [SMTP SUCCESS] Verification email delivered to ${email}`);
    } catch (err) {
      console.warn(
        "⚠️ [SMTP ERROR] Failed to send email via SMTP, fallback to console:",
        err.message,
      );
    }
  }

  return true;
};
