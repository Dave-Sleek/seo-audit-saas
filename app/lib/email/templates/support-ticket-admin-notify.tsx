

interface TicketAdminNotifyEmailProps {
  reference: string;
  subject: string;
  category: string;
  priority: string;
  body: string;
  userEmail: string;
  userName?: string | null;
  ticketUrl: string;
}

export function TicketAdminNotifyEmail({
  reference,
  subject,
  category,
  priority,
  body,
  userEmail,
  userName,
  ticketUrl,
}: TicketAdminNotifyEmailProps) {
  const from = userName?.trim()
    ? `${userName.trim()} <${userEmail}>`
    : userEmail;

  const preview = body.length > 200 ? `${body.slice(0, 200)}…` : body;

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        padding: "24px",
        maxWidth: "560px",
        color: "#0a2540",
      }}
    >
      <h1 style={{ fontSize: "20px", marginBottom: "8px" }}>
        New support ticket
      </h1>

      <p style={{ color: "#444", lineHeight: 1.5, marginTop: 0 }}>
        A new ticket just came in.
      </p>

      <table
        cellPadding={0}
        cellSpacing={0}
        style={{
          width: "100%",
          borderCollapse: "collapse",
          margin: "16px 0",
        }}
      >
        <tbody>
          <tr>
            <td style={labelCell}>Reference</td>
            <td style={{ ...valueCell, fontFamily: "monospace" }}>
              {reference}
            </td>
          </tr>
          <tr>
            <td style={labelCell}>From</td>
            <td style={valueCell}>{from}</td>
          </tr>
          <tr>
            <td style={labelCell}>Subject</td>
            <td style={valueCell}>{subject}</td>
          </tr>
          <tr>
            <td style={labelCell}>Category</td>
            <td style={valueCell}>{category}</td>
          </tr>
          <tr>
            <td style={labelCell}>Priority</td>
            <td style={valueCell}>{priority}</td>
          </tr>
        </tbody>
      </table>

      <p
        style={{
          fontSize: "13px",
          color: "#8792a2",
          marginBottom: "8px",
        }}
      >
        Message preview
      </p>

      <blockquote
        style={{
          margin: "0 0 16px 0",
          padding: "12px 16px",
          background: "#f6f9fc",
          borderLeft: "3px solid #635bff",
          borderRadius: "4px",
          fontSize: "13px",
          color: "#425466",
          whiteSpace: "pre-wrap",
        }}
      >
        {preview}
      </blockquote>

      <a
        href={ticketUrl}
        style={{
          display: "inline-block",
          marginTop: "8px",
          padding: "12px 20px",
          background: "#000",
          color: "#fff",
          borderRadius: "6px",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Open in admin queue
      </a>
    </div>
  );
}

const labelCell: CSSProperties = {
  padding: "8px 0",
  fontSize: "13px",
  color: "#8792a2",
  width: "120px",
  verticalAlign: "top",
};

const valueCell: CSSProperties = {
  padding: "8px 0",
  fontSize: "13px",
  color: "#0a2540",
};