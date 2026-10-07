// lib/mail.js
import nodemailer from 'nodemailer'

let transporter = null

export function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com'
    const port = parseInt(process.env.SMTP_PORT || '465', 10)
    const secure = process.env.SMTP_SECURE !== 'false' && port === 465
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    if (!user || !pass) {
      throw new Error('SMTP credentials not configured (SMTP_USER, SMTP_PASS)')
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      pool: true,
      maxConnections: 3,
      maxMessages: 100
    })
  }
  return transporter
}

export function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildCertificateEmail({
  recipientName,
  recipientEmail,
  title,
  credentialId,
  code,
  verifyUrl,
  driveLink,
  imageBase64,
  mimeType = 'image/png'
}) {
  const cleanName = escapeHtml(recipientName)
  const cleanTitle = escapeHtml(title)
  const cleanId = escapeHtml(credentialId)
  const cleanCode = escapeHtml(code)
  const safeVerifyUrl = escapeHtml(verifyUrl)

  const issueYear = new Date().getFullYear()
  const issueMonth = new Date().getMonth() + 1
  const linkedInParams = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: title,
    organizationName: 'dBug Labs',
    issueYear: issueYear.toString(),
    issueMonth: issueMonth.toString(),
    certId: credentialId,
    certUrl: verifyUrl
  })
  const linkedInUrl = `https://www.linkedin.com/profile/add?${linkedInParams.toString()}`

  let driveButtonHtml = ''
  if (driveLink && /^https?:\/\//i.test(driveLink)) {
    const safeDriveLink = escapeHtml(driveLink)
    driveButtonHtml = `
      <div style="margin-top: 20px;">
        <a href="${safeDriveLink}" style="display: inline-block; padding: 10px 18px; color: #a99bad; border: 1px solid #76697a; text-decoration: none; border-radius: 6px; font-size: 13px;">Open the Drive folder</a>
        <p style="color: #76697a; font-size: 12px; margin-top: 6px;">A copy of this batch also lives here, in case the attachment goes missing.</p>
      </div>
    `
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 24px 0; background-color: #08050a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f4eef6;">
      <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #0c0710; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; padding: 32px 24px; box-sizing: border-box;">
        <tr>
          <td>
            <div style="font-size: 13px; font-weight: 800; letter-spacing: 2px; color: #ff2d4f; text-transform: uppercase;">DBUG LABS</div>
            <h1 style="font-size: 24px; margin: 12px 0 4px 0; color: #ffffff;">Certificate Issued</h1>
            <p style="color: #a99bad; margin: 0 0 24px 0; font-size: 14px;">Congratulations on your achievement</p>

            <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <div style="font-size: 12px; color: #76697a; text-transform: uppercase;">Issued to</div>
              <div style="font-size: 18px; font-weight: bold; color: #f4eef6; margin-top: 2px;">${cleanName}</div>
              <div style="font-size: 12px; color: #76697a; margin-top: 12px; text-transform: uppercase;">For</div>
              <div style="font-size: 15px; color: #ffffff; margin-top: 2px;">${cleanTitle}</div>
              <div style="margin-top: 14px;">
                <span style="font-family: monospace; font-size: 12px; background: rgba(255,45,79,0.15); color: #ff5a72; padding: 3px 8px; border-radius: 4px; margin-right: 6px;">${cleanId}</span>
                <span style="font-family: monospace; font-size: 12px; background: rgba(139,61,255,0.15); color: #b06bff; padding: 3px 8px; border-radius: 4px;">${cleanCode}</span>
              </div>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <img src="cid:certificate" alt="Certificate for ${cleanName}" style="max-width: 100%; height: auto; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);" />
              <p style="color: #76697a; font-size: 12px; margin-top: 8px;">Your certificate is attached to this email.</p>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${safeVerifyUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(95deg, #f2334f, #8b3dff); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; margin-right: 8px;">Verify this certificate</a>
              <a href="${escapeHtml(linkedInUrl)}" style="display: inline-block; padding: 12px 20px; background: rgba(255,255,255,0.08); color: #f4eef6; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; margin-top: 8px;">Add to LinkedIn</a>
            </div>

            ${driveButtonHtml}

            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 32px 0 16px 0;" />
            <p style="color: #76697a; font-size: 12px; line-height: 1.5; margin: 0;">
              Anyone can confirm this certificate is genuine at:<br/>
              <a href="${safeVerifyUrl}" style="color: #b06bff; text-decoration: none;">${safeVerifyUrl}</a>
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  const safeFilename = `${recipientName.replace(/[^\w]/g, '_')}_Certificate.${mimeType === 'image/jpeg' ? 'jpg' : 'png'}`

  return {
    from: process.env.MAIL_FROM || `"dBug Labs" <${process.env.SMTP_USER}>`,
    to: recipientEmail.toLowerCase().trim(),
    subject: `dBug Labs: your certificate for ${title}`,
    html,
    attachment: {
      filename: safeFilename,
      contentType: mimeType,
      cid: 'certificate',
      contentDisposition: 'attachment',
      contentBase64: imageBase64
    }
  }
}
