// app/lib/email/templates/project-invite.tsx

interface ProjectInviteEmailProps {
  inviterName: string | null;
  projectName: string;
  projectDomain: string;
  inviteUrl: string;
}

export function ProjectInviteEmail({
  inviterName,
  projectName,
  projectDomain,
  inviteUrl,
}: ProjectInviteEmailProps) {
  const inviter = inviterName?.trim() || "Someone";

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
        You&apos;ve been invited to a project
      </h1>

      <p style={{ color: "#444", lineHeight: 1.5, marginTop: 0 }}>
        {inviter} invited you to view the SEO audit reports for
        this project.
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
              Project
            </td>
            <td
              style={{
                padding: "8px 0",
                fontSize: "13px",
                color: "#0a2540",
              }}
            >
              {projectName}
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
              Domain
            </td>
            <td
              style={{
                padding: "8px 0",
                fontSize: "13px",
                color: "#0a2540",
              }}
            >
              {projectDomain}
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ color: "#444", lineHeight: 1.5 }}>
        You&apos;ll have view-only access to this project&apos;s
        audits and reports. No billing changes — the project owner
        covers everything.
      </p>

      <a
        href={inviteUrl}
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
        View project
      </a>

      <p
        style={{
          marginTop: "24px",
          fontSize: "12px",
          color: "#888",
        }}
      >
        If you weren&apos;t expecting this, you can ignore this
        email.
      </p>
    </div>
  );
}