import LegalLayout from "@/app/components/legal/LegalLayout";

export const metadata = {
  title: "Privacy Policy — [Company Name]",
  description:
    "How [Company Name] collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Privacy Policy"
      lastUpdated="September 18, 2026"
    >
      <p>
        This Privacy Policy explains how <strong>[Company Name]</strong>{" "}
        (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses,
        and shares information about you when you use{" "}
        <a href="https://[yourdomain].com">[yourdomain].com</a> and any
        related services (the &quot;Service&quot;).
      </p>

      <p>
        By using the Service, you agree to the collection and use of
        information in accordance with this policy. If you do not agree,
        please do not use the Service.
      </p>

      <h2>1. Information we collect</h2>

      <h3>Information you provide</h3>

      <ul>
        <li>
          <strong>Account information.</strong> When you create an account,
          we collect your name, email address, and a hashed password. We
          never store passwords in plain text.
        </li>
        <li>
          <strong>Billing information.</strong> When you subscribe to a paid
          plan, our payment processor (Paystack) collects your payment
          details. We do not store full card numbers on our servers. We
          receive a limited confirmation from Paystack, including the last
          four digits of the card, the card brand, and the payment status.
        </li>
        <li>
          <strong>Support communications.</strong> If you contact us for
          support, we keep a record of the conversation, including any
          information you choose to share.
        </li>
      </ul>

      <h3>Information we collect automatically</h3>

      <ul>
        <li>
          <strong>Usage data.</strong> We collect information about how you
          use the Service, such as the URLs you audit, the pages you visit,
          and the features you use.
        </li>
        <li>
          <strong>Audit data.</strong> When you run an audit, we store the
          results on our servers so you can access your history. This
          includes crawl data, SEO issues found, scores, and metadata
          extracted from the audited website.
        </li>
        <li>
          <strong>Device and log information.</strong> We collect your IP
          address, browser type, operating system, and timestamps of your
          requests.
        </li>
        <li>
          <strong>Cookies.</strong> We use a single session cookie to keep
          you logged in. We do not use cookies for advertising or
          third-party tracking.
        </li>
      </ul>

      <h2>2. How we use your information</h2>

      <p>We use the information we collect to:</p>

      <ul>
        <li>Provide, maintain, and improve the Service</li>
        <li>Process subscriptions and payments</li>
        <li>Send transactional emails (account verification, password reset)</li>
        <li>Send service updates and security alerts</li>
        <li>Respond to your support requests</li>
        <li>Detect, prevent, and address fraud, abuse, and security issues</li>
        <li>Comply with legal obligations</li>
      </ul>

      <p>
        We do <strong>not</strong> sell your personal information to third
        parties.
      </p>

      <h2>3. Legal bases for processing</h2>

      <p>
        If you are located in a jurisdiction with data protection laws
        (such as the EU GDPR or the UK GDPR), we process your information
        on the following legal bases:
      </p>

      <ul>
        <li>
          <strong>Contract.</strong> To perform the contract we have with
          you, including delivering the Service you have subscribed to.
        </li>
        <li>
          <strong>Legitimate interests.</strong> To operate, secure, and
          improve the Service.
        </li>
        <li>
          <strong>Consent.</strong> Where you have given explicit consent,
          such as for marketing emails.
        </li>
        <li>
          <strong>Legal obligation.</strong> Where we are required to
          process data to comply with the law.
        </li>
      </ul>

      <h2>4. How we share your information</h2>

      <p>
        We share information only in the limited circumstances described
        below.
      </p>

      <h3>Service providers</h3>

      <p>
        We use trusted third parties to operate the Service. These include:
      </p>

      <ul>
        <li>
          <strong>Paystack</strong> — for payment processing and
          subscription management
        </li>
        <li>
          <strong>Hosting providers</strong> — to run our servers and store
          data
        </li>
        <li>
          <strong>Email providers</strong> — to send transactional emails
        </li>
        <li>
          <strong>Analytics providers</strong> — to understand how the
          Service is used
        </li>
      </ul>

      <p>
        Each provider is contractually required to protect your information
        and use it only for the purpose we have specified.
      </p>

      <h3>Legal requests</h3>

      <p>
        We may disclose information when we believe in good faith that it
        is necessary to comply with a legal obligation, protect our rights
        or property, prevent fraud, or protect the safety of any person.
      </p>

      <h3>Business transfers</h3>

      <p>
        If we are involved in a merger, acquisition, or sale of assets,
        your information may be transferred as part of that transaction.
        We will notify you before your information becomes subject to a
        different privacy policy.
      </p>

      <h2>5. Data retention</h2>

      <p>
        We retain your personal information for as long as your account is
        active. If you delete your account, we delete or anonymize your
        personal information within 30 days, except where we are required
        to retain it for legal, tax, or fraud-prevention purposes.
      </p>

      <p>
        Audit data and crawl results are retained until you delete them or
        delete your account.
      </p>

      <h2>6. Data security</h2>

      <p>
        We take reasonable measures to protect your information, including:
      </p>

      <ul>
        <li>Encryption in transit (HTTPS everywhere)</li>
        <li>Hashed passwords using modern algorithms</li>
        <li>Access controls limiting employee access to personal data</li>
        <li>Regular backups and monitoring for unusual activity</li>
      </ul>

      <p>
        No system is completely secure. We cannot guarantee that
        unauthorized access, hacking, or other breaches will never occur.
      </p>

      <h2>7. Your rights</h2>

      <p>
        Depending on where you live, you may have the right to:
      </p>

      <ul>
        <li>Access the personal information we hold about you</li>
        <li>Correct inaccurate information</li>
        <li>Delete your information</li>
        <li>Object to or restrict how we process your information</li>
        <li>Export your information in a portable format</li>
        <li>Withdraw consent at any time</li>
      </ul>

      <p>
        To exercise any of these rights, contact us at{" "}
        <a href="mailto:legal@[yourdomain].com">
          legal@[yourdomain].com
        </a>
        . We will respond within a reasonable timeframe.
      </p>

      <h2>8. Children&apos;s privacy</h2>

      <p>
        The Service is not intended for anyone under the age of 16. We do
        not knowingly collect personal information from children. If you
        believe we have collected information from a child, please contact
        us so we can delete it.
      </p>

      <h2>9. International transfers</h2>

      <p>
        Your information may be transferred to and processed in countries
        other than your own. Where required, we rely on appropriate
        safeguards (such as standard contractual clauses) to protect your
        information during these transfers.
      </p>

      <h2>10. Changes to this policy</h2>

      <p>
        We may update this Privacy Policy from time to time. If we make
        material changes, we will notify you by email or by posting a
        notice in the Service before the changes take effect.
      </p>

      <h2>11. Contact us</h2>

      <p>
        If you have questions about this Privacy Policy, contact us at{" "}
        <a href="mailto:legal@[yourdomain].com">
          legal@[yourdomain].com
        </a>
        .
      </p>

      <blockquote>
        This document is a template and does not constitute legal advice.
        Please consult a qualified lawyer in your jurisdiction before
        publishing it.
      </blockquote>
    </LegalLayout>
  );
}