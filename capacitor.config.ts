import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.travelunu.app',
  appName: 'Travelunu',
  webDir: 'dist',
  server: {
    // 프로덕션에서는 제거, 개발 시에만 사용
    // url: 'http://localhost:3000',
    // cleartext: true,
  },
};

export default config;
