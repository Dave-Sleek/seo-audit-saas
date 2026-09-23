interface WelcomeEmailProps {
  name: string;
  loginUrl: string;
}

export function WelcomeEmail({ name, loginUrl }: WelcomeEmailProps) {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "24px", maxWidth: "560px" }}>
      <h1 style={{ fontSize: "20px", marginBottom: "8px" }}>
        Welcome to SEO Audit, {name}!
      </h1>
      <p style={{ color: "#444", lineHeight: 1.5 }}>
        Your account is ready. You can now run SEO audits, track site
        health, and get AI-powered recommendations to improve your
        rankings.
      </p>
      <a
        href={loginUrl}
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
        Go to dashboard
      </a>
      <p style={{ marginTop: "24px", fontSize: "12px", color: "#888" }}>
        If you didn&apos;t create this account, you can safely ignore this email.
      </p>
    </div>
  );
}