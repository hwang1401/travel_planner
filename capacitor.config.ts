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
  android: {
    // edge-to-edge 비활성화: 시스템 바 영역에 콘텐츠가 들어가지 않도록
    SystemBars: {
      insetsHandling: 'disable',
    },
  },
  plugins: {
    App: {
      url: 'com.travelunu.app',
    },
    SystemBars: {
      insetsHandling: 'disable',
    },
  },
};

export default config;
