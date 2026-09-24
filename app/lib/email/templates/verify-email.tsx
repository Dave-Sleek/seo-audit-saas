interface VerifyEmailProps {
  name: string;
  verifyUrl: string;
  expiresInHours?: number;
}

export function VerifyEmail({
  name,
  verifyUrl,
  expiresInHours = 24,
}: VerifyEmailProps) {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        padding: "24px",
        maxWidth: "560px",
      }}
    >
      <h1
        style={{
          fontSize: "20px",
          marginBottom: "8px",
        }}
      >
        Verify your email
      </h1>

      <p
        style={{
          color: "#444",
          lineHeight: 1.5,
        }}
      >
        Hi {name}, welcome to SEO Audit. Please confirm your
        email address by clicking the button below.
      </p>

      <a
        href={verifyUrl}
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
        Verify email
      </a>

      <p
        style={{
          marginTop: "24px",
          fontSize: "12px",
          color: "#888",
          lineHeight: 1.5,
        }}
      >
        This link expires in {expiresInHours} hours. If you
        didn&apos;t create this account, you can safely ignore
        this email.
      </p>

      <p
        style={{
          marginTop: "16px",
          fontSize: "11px",
          color: "#aaa",
          wordBreak: "break-all",
        }}
      >
        Or paste this into your browser: {verifyUrl}
      </p>
    </div>
  );
}