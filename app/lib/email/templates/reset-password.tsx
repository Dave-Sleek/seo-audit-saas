interface ResetPasswordEmailProps {
  name: string;
  resetUrl: string;
}

export function ResetPasswordEmail({
  name,
  resetUrl,
}: ResetPasswordEmailProps) {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "24px", maxWidth: "560px" }}>
      <h1 style={{ fontSize: "20px", marginBottom: "8px" }}>
        Reset your password
      </h1>
      <p style={{ color: "#444", lineHeight: 1.5 }}>
        Hi {name}, we received a request to reset your password. This
        link expires in 1 hour.
      </p>
      <a
        href={resetUrl}
        style={{
          display: "inline-block",
          marginTop: "16px",
          padding: "12px 20px",
          background: "#000",
          color: "#fff",
          borderRadius: "6px",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Reset password
      </a>
      <p style={{ marginTop: "24px", fontSize: "12px", color: "#888" }}>
        If you didn&apos;t request this, you can safely ignore this email.
        Your password won&apos;t change.
      </p>
    </div>
  );
}