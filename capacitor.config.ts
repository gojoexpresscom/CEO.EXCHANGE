import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ceoexchange.app",
  appName: "CEO EXCHANGE",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;