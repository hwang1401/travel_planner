# Google Places Autocomplete 설정 가이드

주소/장소 검색(AddressSearch, AddPlacePage)에서 Google Places Autocomplete를 사용하려면 Google Cloud에서 API 키를 발급하고 프로젝트에 설정해야 합니다.

## 1. 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 상단 프로젝트 선택 → **새 프로젝트** 또는 기존 프로젝트 선택

## 2. API 활성화

1. **API 및 서비스** → **라이브러리** (또는 Google Maps Platform → API 및 서비스)
2. **Maps JavaScript API** 검색 후 **사용** 클릭  
   - Autocomplete와 Place Details는 이 API의 Places 라이브러리로 사용합니다.
3. (선택) Place Details만 REST로 쓰려면 **Places API**도 활성화 가능합니다.  
   - 현재 구현은 Maps JavaScript API만 사용합니다.

## 3. API 키 생성

1. **API 및 서비스** → **사용자 인증 정보**
2. **사용자 인증 정보 만들기** → **API 키**
3. 생성된 키를 복사합니다.

## 4. 키 제한 (권장)

1. 생성된 API 키 옆 **편집** (연필 아이콘)
2. **API 제한**  
   - "키 제한" 선택  
   - **Maps JavaScript API**만 허용하도록 선택
3. **애플리케이션 제한**  
   - "HTTP 리퍼러(웹사이트)" 선택  
   - 다음 리퍼러 추가:
     - `http://localhost:*/*` (로컬 개발)
     - `https://your-production-domain.com/*` (배포 도메인, 예: `https://travel-planner-livid-gamma.vercel.app/*`)
4. **저장**

## 5. 환경 변수

프로젝트 루트 `.env` 파일에 다음을 추가합니다.

```env
# ── Google Maps / Places (주소·장소 검색) ──
VITE_GOOGLE_MAPS_API_KEY=발급받은_API_키
```

- 키가 없으면 주소/장소 검색 시 결과가 나오지 않습니다.
- `.env`는 Git에 커밋하지 마세요 (이미 `.gitignore`에 포함됨).

## 참고

- **비용**: Places API는 Autocomplete(세션당) + Place Details(선택 시) 단위 과금. 월 $200 무료 크레딧으로 개인/소규모 사용은 보통 충분합니다.
- **키 노출**: 브라우저에서 스크립트로 로드하므로 키가 클라이언트에 노출됩니다. 반드시 HTTP referrer 제한으로 도메인을 제한하세요.
