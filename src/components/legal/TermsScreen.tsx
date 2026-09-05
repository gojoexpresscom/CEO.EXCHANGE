import React from "react";

export default function TermsScreen() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#fff",
        padding: "18px 16px 40px",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <article
        style={{
          width: "100%",
          maxWidth: 760,
          margin: "0 auto",
        }}
      >
        <header style={{ marginBottom: 28 }}>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(28px, 7vw, 40px)",
              lineHeight: 1.08,
              fontWeight: 750,
              letterSpacing: "-0.025em",
            }}
          >
            Terms of Service
          </h1>

          <p
            style={{
              color: "#777",
              margin: "10px 0 0",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Last updated: August 31, 2026
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gap: 22,
            color: "#c4c4c4",
            lineHeight: 1.7,
            fontSize: 14,
          }}
        >
          <section>
            <h2 style={h2}>1. Eligibility</h2>
            <p>
              You must be at least 18 years old to use the Service. By using
              the Service, you represent and warrant that you have the legal
              capacity to enter into these Terms.
            </p>
          </section>

          <section>
            <h2 style={h2}>2. Account Registration</h2>
            <p>
              You are responsible for maintaining the confidentiality of your
              account credentials. You agree to provide accurate, current, and
              complete information during registration and to update such
              information as needed. You are solely responsible for all
              activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 style={h2}>3. Nature of the Platform</h2>
            <p>
              CEO Exchange is a peer-to-peer marketplace that allows users to
              list, discover, buy, and sell products or services. We are not a
              party to any transaction between users. We do not own, inspect,
              guarantee, or take possession of any items listed on the Platform.
              All transactions are solely between the buyers and sellers.
            </p>
          </section>

          <section>
            <h2 style={h2}>4. User Conduct</h2>
            <p>You agree not to:</p>

            <ul style={ul}>
              <li>
                List or sell illegal, stolen, counterfeit, or prohibited items
              </li>
              <li>
                Engage in fraudulent, misleading, or deceptive practices
              </li>
              <li>Harass, threaten, or abuse other users</li>
              <li>
                Attempt to interfere with the proper functioning of the
                Platform
              </li>
              <li>Use the Service for any unlawful purpose</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>5. Fees and Payments</h2>
            <p>
              Certain features or transactions may be subject to fees. All
              applicable fees will be clearly disclosed before you complete a
              transaction. You are responsible for any taxes associated with
              your use of the Service.
            </p>
          </section>

          <section>
            <h2 style={h2}>6. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
              WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR
              IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, AND NON-INFRINGEMENT. WE DO NOT GUARANTEE THE QUALITY,
              SAFETY, OR LEGALITY OF ANY ITEMS LISTED, OR THE TRUTHFULNESS OF
              ANY USER CONTENT.
            </p>
          </section>

          <section>
            <h2 style={h2}>7. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, CEO EXCHANGE AND ITS
              AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
              PROFITS OR REVENUE, WHETHER INCURRED DIRECTLY OR INDIRECTLY,
              ARISING FROM YOUR USE OF THE SERVICE OR ANY TRANSACTION
              CONDUCTED THROUGH THE PLATFORM.
            </p>
          </section>

          <section>
            <h2 style={h2}>8. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless CEO Exchange, its
              officers, directors, employees, and agents from any claims,
              damages, losses, or expenses (including reasonable attorneys’
              fees) arising out of your use of the Service, your violation of
              these Terms, or your violation of any rights of another party.
            </p>
          </section>

          <section>
            <h2 style={h2}>9. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any
              time, with or without notice, for any reason, including violation
              of these Terms.
            </p>
          </section>

          <section>
            <h2 style={h2}>10. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. The updated version
              will be indicated by an updated “Last updated” date. Continued
              use of the Service after changes constitutes acceptance of the
              new Terms.
            </p>
          </section>

          <section>
            <h2 style={h2}>11. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with
              the laws of the jurisdiction in which the Platform operates,
              without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 style={h2}>12. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at
              ceo.support.v@gmail.com
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}

const h2: React.CSSProperties = {
  margin: 0,
  color: "#fff",
  fontSize: 19,
  lineHeight: 1.25,
  fontWeight: 700,
};

const ul: React.CSSProperties = {
  margin: "8px 0 0",
  paddingLeft: 22,
  display: "grid",
  gap: 5,
};
