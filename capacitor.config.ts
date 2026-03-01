import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.travelunu.app',
  appName: 'TravelUNU',
  webDir: 'dist',
  ios: {
    scheme: 'TravelUNU',
  },
  server: {
    // 프로덕션에서는 제거, 개발 시에만 사용
    // url: 'http://localhost:3000',
    // cleartext: true,
  },
  plugins: {
    App: {
      // 커스텀 URL 스킴 (OAuth 딥링크)
      url: 'com.travelunu.app',
    },
  },
};

export default config;
