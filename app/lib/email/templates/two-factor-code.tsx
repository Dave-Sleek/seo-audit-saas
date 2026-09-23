interface TwoFactorCodeEmailProps {
  name: string;
  code: string;
}

export function TwoFactorCodeEmail({ name, code }: TwoFactorCodeEmailProps) {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "24px", maxWidth: "560px" }}>
      <h1 style={{ fontSize: "20px", marginBottom: "8px" }}>
        Your verification code
      </h1>
      <p style={{ color: "#444", lineHeight: 1.5 }}>
        Hi {name}, here is your one-time code to sign in:
      </p>
      <div
        style={{
          marginTop: "16px",
          padding: "16px",
          background: "#f4f4f5",
          borderRadius: "8px",
          textAlign: "center",
          fontSize: "28px",
          fontWeight: "bold",
          letterSpacing: "6px",
          fontFamily: "monospace",
        }}
      >
        {code}
      </div>
      <p style={{ marginTop: "16px", fontSize: "12px", color: "#888" }}>
        This code expires in 10 minutes. If you didn&apos;t request this, you can
        safely ignore this email.
      </p>
    </div>
  );
}