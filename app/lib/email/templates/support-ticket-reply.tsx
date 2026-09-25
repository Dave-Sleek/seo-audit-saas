// app/lib/email/templates/support-ticket-reply.tsx

import type { CSSProperties } from "react";

interface TicketReplyEmailProps {
  name?: string | null;
  reference: string;
  subject: string;
  replyBody: string;
  ticketUrl: string;
  newStatus: "open" | "pending" | "resolved";
}

export function TicketReplyEmail({
  name,
  reference,
  subject,
  replyBody,
  ticketUrl,
  newStatus,
}: TicketReplyEmailProps) {
  const greeting = name?.trim() ? `Hi ${name.trim()},` : "Hi,";

  const statusLine =
    newStatus === "pending"
      ? "Your ticket is now waiting on you — reply to keep it moving."
      : newStatus === "resolved"
        ? "This ticket has been marked resolved. Reply if you still need help."
        : "The support team has replied to your ticket.";

  const preview =
    replyBody.length > 200 ? `${replyBody.slice(0, 200)}…` : replyBody;

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
        New reply on your support ticket
      </h1>

      <p style={{ color: "#444", lineHeight: 1.5, marginTop: 0 }}>
        {greeting}
      </p>

      <p style={{ color: "#444", lineHeight: 1.5 }}>{statusLine}</p>

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
            <td style={labelCell}>Subject</td>
            <td style={valueCell}>{subject}</td>
          </tr>
        </tbody>
      </table>

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

      <p style={{ color: "#444", lineHeight: 1.5 }}>
        Reply directly on the ticket to continue the conversation.
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
        View reply
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