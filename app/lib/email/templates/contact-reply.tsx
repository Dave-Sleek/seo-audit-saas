// app/lib/email/templates/contact-reply.tsx

interface ContactReplyEmailProps {
  name: string | null;
  subject: string;
  originalMessage: string;
  replyBody: string;
  replyUrl: string;
}

export function ContactReplyEmail({
  name,
  subject,
  originalMessage,
  replyBody,
  replyUrl,
}: ContactReplyEmailProps) {
  const greeting = name?.trim() ? `Hi ${name.trim()},` : "Hi,";

  const truncatedOriginal =
    originalMessage.length > 400
      ? `${originalMessage.slice(0, 400)}…`
      : originalMessage;

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
        Re: {subject}
      </h1>

      <p style={{ color: "#444", lineHeight: 1.5, marginTop: 0 }}>
        {greeting}
      </p>

      <p style={{ color: "#444", lineHeight: 1.5 }}>
        Thanks for getting in touch. Here&apos;s our reply:
      </p>

      <blockquote
        style={{
          margin: "16px 0",
          padding: "12px 16px",
          background: "#f6f9fc",
          borderLeft: "3px solid #635bff",
          borderRadius: "4px",
          fontSize: "14px",
          color: "#425466",
          whiteSpace: "pre-wrap",
        }}
      >
        {replyBody}
      </blockquote>

      <p
        style={{
          fontSize: "12px",
          color: "#8792a2",
          marginTop: "24px",
          marginBottom: "8px",
        }}
      >
        Your original message:
      </p>

      <blockquote
        style={{
          margin: 0,
          padding: "12px 16px",
          background: "#fafbfc",
          borderLeft: "3px solid #e6ebf1",
          borderRadius: "4px",
          fontSize: "13px",
          color: "#8792a2",
          whiteSpace: "pre-wrap",
        }}
      >
        {truncatedOriginal}
      </blockquote>

      <a
        href={replyUrl}
        style={{
          display: "inline-block",
          marginTop: "24px",
          padding: "12px 20px",
          background: "#000",
          color: "#fff",
          borderRadius: "6px",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Reply again
      </a>

      <p
        style={{
          marginTop: "24px",
          fontSize: "12px",
          color: "#888",
        }}
      >
        You can reply directly to this email, or use the link above to
        send a follow-up.
      </p>
    </div>
  );
}