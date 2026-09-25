// app/lib/email/templates/support-ticket-created.tsx

interface TicketCreatedEmailProps {
  name?: string | null;
  reference: string;
  subject: string;
  ticketUrl: string;
}

export function TicketCreatedEmail({
  name,
  reference,
  subject,
  ticketUrl,
}: TicketCreatedEmailProps) {
  const greeting = name?.trim() ? `Hi ${name.trim()},` : "Hi,";

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
        We received your ticket
      </h1>

      <p style={{ color: "#444", lineHeight: 1.5, marginTop: 0 }}>
        {greeting}
      </p>

      <p style={{ color: "#444", lineHeight: 1.5 }}>
        Thanks for reaching out. Your support ticket has been created
        and our team will get back to you as soon as we can.
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
            <td
              style={{
                padding: "8px 0",
                fontSize: "13px",
                color: "#8792a2",
                width: "120px",
              }}
            >
              Reference
            </td>
            <td
              style={{
                padding: "8px 0",
                fontSize: "13px",
                color: "#0a2540",
                fontFamily: "monospace",
              }}
            >
              {reference}
            </td>
          </tr>
          <tr>
            <td
              style={{
                padding: "8px 0",
                fontSize: "13px",
                color: "#8792a2",
              }}
            >
              Subject
            </td>
            <td
              style={{
                padding: "8px 0",
                fontSize: "13px",
                color: "#0a2540",
              }}
            >
              {subject}
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ color: "#444", lineHeight: 1.5 }}>
        You can view the ticket and add more details at any time using
        the link below.
      </p>

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
        View your ticket
      </a>

      <p
        style={{
          marginTop: "24px",
          fontSize: "12px",
          color: "#888",
        }}
      >
        You&apos;re receiving this because you submitted a support
        ticket.
      </p>
    </div>
  );
}