// app/lib/email/layout.ts

export function emailLayout({
  previewText,
  heading,
  bodyHtml,
  ctaLabel,
  ctaHref,
}: {
  previewText: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
}): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0a2540;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${previewText}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f9fc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e6ebf1;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0;font-size:20px;font-weight:600;line-height:1.3;color:#0a2540;">${heading}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;font-size:14px;line-height:1.6;color:#425466;">
                ${bodyHtml}
              </td>
            </tr>
            ${
              ctaLabel && ctaHref
                ? `<tr>
              <td style="padding:0 32px 32px 32px;">
                <a href="${ctaHref}" style="display:inline-block;background:#635bff;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600;">${ctaLabel}</a>
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #e6ebf1;font-size:12px;line-height:1.6;color:#8792a2;">
                You're receiving this email because of activity on your account.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}