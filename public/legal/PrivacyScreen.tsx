import React from 'react';

export default function PrivacyScreen() {
  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-gray-400 mb-8">Last updated: August 31, 2026</p>

      <div className="space-y-6 text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">1. Information We Collect</h2>
          <p>We may collect the following types of information:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Account Information: Name, email address, phone number, username, and profile information you provide when creating an account.</li>
            <li>Transaction Information: Details related to listings, purchases, sales, and communications between users.</li>
            <li>Device and Usage Information: IP address, browser type, device information, pages visited, and other usage data.</li>
            <li>Location Information: Approximate location based on IP address or information you choose to provide.</li>
            <li>Communications: Messages you send through the Platform or to our support team.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Provide, operate, and maintain the Platform</li>
            <li>Process transactions and send related notifications</li>
            <li>Improve and personalize user experience</li>
            <li>Communicate with you about your account or the Service</li>
            <li>Detect, prevent, and address fraud or security issues</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">3. Sharing of Information</h2>
          <p>We may share your information in the following situations:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>With other users as necessary to facilitate transactions (e.g., seller contact information when a purchase is made)</li>
            <li>With service providers who assist us in operating the Platform</li>
            <li>When required by law or to protect our rights and safety</li>
            <li>In connection with a business transfer (merger, acquisition, etc.)</li>
          </ul>
          <p className="mt-2">We do not sell your personal information to third parties.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">4. Data Retention</h2>
          <p>We retain your information for as long as your account is active or as needed to provide the Service, comply with legal obligations, resolve disputes, and enforce our agreements.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">5. Security</h2>
          <p>We implement reasonable administrative, technical, and physical security measures to protect your information. However, no method of transmission over the Internet or electronic storage is 100% secure.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">6. Your Rights</h2>
          <p>Depending on your location, you may have the right to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your information</li>
            <li>Object to or restrict certain processing</li>
          </ul>
          <p className="mt-2">To exercise these rights, contact us at ceo.privacy.v@gmail.com</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">7. Third-Party Links</h2>
          <p>The Platform may contain links to third-party websites. We are not responsible for the privacy practices of those websites.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">8. Children’s Privacy</h2>
          <p>The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children under 18.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">9. Changes to This Privacy Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the “Last updated” date.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">10. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at ceo.privacy.v@gmail.com</p>
        </section>
      </div>
    </div>
  );
}