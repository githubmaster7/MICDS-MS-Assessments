import nodemailer from 'nodemailer'
import { APP_NAME, SCHOOL_NAME } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST     ?? 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT ?? '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM_ADDRESS = process.env.SMTP_FROM ?? `"${APP_NAME}" <noreply@micds.org>`
const APP_URL      = process.env.NEXTAUTH_URL ?? 'https://pe.micds.org'

// ---------------------------------------------------------------------------
// Shared template helpers
// ---------------------------------------------------------------------------

function htmlWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .header { background: #1a3a5c; padding: 28px 36px; }
    .header-school { color: #a8c4e0; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 6px; }
    .header-title { color: #ffffff; font-size: 20px; font-weight: 600; margin: 0; }
    .body { padding: 32px 36px; }
    .body p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #333; }
    .body p:last-child { margin-bottom: 0; }
    .btn { display: inline-block; margin: 20px 0; padding: 12px 28px; background: #1a3a5c; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 500; }
    .code { display: inline-block; font-family: monospace; font-size: 22px; letter-spacing: 0.15em; background: #f0f4f8; padding: 10px 20px; border-radius: 6px; color: #1a3a5c; font-weight: 700; }
    .muted { font-size: 13px; color: #777; }
    .footer { padding: 20px 36px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <p class="header-school">${SCHOOL_NAME}</p>
      <h1 class="header-title">${title}</h1>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${SCHOOL_NAME} &mdash; ${APP_NAME}
    </div>
  </div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// sendVerificationEmail
// ---------------------------------------------------------------------------

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`

  const body = `
    <p>Thank you for registering with the ${APP_NAME} system.</p>
    <p>Please verify your email address by clicking the button below. This link expires in 24 hours.</p>
    <p><a href="${verifyUrl}" class="btn">Verify Email Address</a></p>
    <p class="muted">If the button does not work, copy and paste this URL into your browser:<br />${verifyUrl}</p>
    <p class="muted">If you did not register for this account, you can safely ignore this email.</p>
  `

  await transporter.sendMail({
    from:    FROM_ADDRESS,
    to:      email,
    subject: `Verify your ${APP_NAME} email address`,
    html:    htmlWrapper('Verify Your Email', body),
  })
}

// ---------------------------------------------------------------------------
// sendApprovalEmail
// ---------------------------------------------------------------------------

export async function sendApprovalEmail(email: string, role: string): Promise<void> {
  const loginUrl = `${APP_URL}/login`
  const roleLabel = role.charAt(0) + role.slice(1).toLowerCase()

  const body = `
    <p>Your ${APP_NAME} account has been approved by an administrator.</p>
    <p>You have been granted <strong>${roleLabel}</strong> access. You can now sign in and begin using the system.</p>
    <p><a href="${loginUrl}" class="btn">Sign In Now</a></p>
    <p class="muted">If you have any questions, contact your school administrator.</p>
  `

  await transporter.sendMail({
    from:    FROM_ADDRESS,
    to:      email,
    subject: `Your ${APP_NAME} account has been approved`,
    html:    htmlWrapper('Account Approved', body),
  })
}

// ---------------------------------------------------------------------------
// sendRejectionEmail
// ---------------------------------------------------------------------------

export async function sendRejectionEmail(email: string, reason?: string): Promise<void> {
  const reasonText = reason
    ? `<p>The reason provided was: <em>${reason}</em></p>`
    : ''

  const body = `
    <p>We were unable to approve your registration request for the ${APP_NAME} system.</p>
    ${reasonText}
    <p>If you believe this is an error, please contact your school administrator directly.</p>
    <p class="muted">This is an automated message. Please do not reply to this email.</p>
  `

  await transporter.sendMail({
    from:    FROM_ADDRESS,
    to:      email,
    subject: `Your ${APP_NAME} registration request`,
    html:    htmlWrapper('Registration Not Approved', body),
  })
}

// ---------------------------------------------------------------------------
// sendPasswordResetEmail
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`

  const body = `
    <p>We received a request to reset the password for your ${APP_NAME} account.</p>
    <p>Click the button below to choose a new password. This link expires in 1 hour.</p>
    <p><a href="${resetUrl}" class="btn">Reset Password</a></p>
    <p class="muted">If the button does not work, copy and paste this URL into your browser:<br />${resetUrl}</p>
    <p class="muted">If you did not request a password reset, you can safely ignore this email. Your password has not been changed.</p>
  `

  await transporter.sendMail({
    from:    FROM_ADDRESS,
    to:      email,
    subject: `Reset your ${APP_NAME} password`,
    html:    htmlWrapper('Password Reset Request', body),
  })
}
