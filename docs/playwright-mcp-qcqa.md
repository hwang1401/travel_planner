# Playwright MCP로 사이트 QC/QA 하기

## 1. Playwright MCP 설정

프로젝트 `.cursor/mcp.json`에 Playwright MCP가 추가되어 있으면, Cursor에서 **MCP 서버를 켜둔 뒤** 채팅/에이전트에서 브라우저 자동화 도구를 사용할 수 있습니다.

- **Cursor**: `Cursor Settings` → `MCP`에서 `playwright`가 켜져 있는지 확인.
- 처음 사용 시 `npx -y @playwright/mcp@latest` 실행으로 Playwright 브라우저가 설치될 수 있습니다.

## 2. QC/QA 시나리오 (우리 사이트)

대상 URL 예:

- 로컬: `http://localhost:5173`
- 배포: `https://travel-planner-livid-gamma.vercel.app` (또는 실제 배포 URL)

### 기본 점검

1. **페이지 열기**  
   - `browser_navigate`로 위 URL 이동  
   - `browser_snapshot`으로 접근성 스냅샷 확인 (에러/빈 화면 여부)

2. **스플래시 → 홈**  
   - 로딩 후 메인 화면이 나오는지  
   - `browser_snapshot`으로 버튼/링크 노출 확인

3. **로그인 플로우**  
   - 로그인 버튼 클릭 → 로그인 페이지 진입  
   - (선택) 테스트 계정으로 로그인 후 홈 복귀 여부

4. **여행 생성 플로우**  
   - "새 여행 만들기" 또는 여행 생성 진입점 클릭  
   - **어디로**: 목적지 검색/선택  
   - **언제**: 출발·귀국일 선택  
   - **일정**: AI 일정 생성 또는 붙여넣기  
   - 각 단계에서 `browser_snapshot`으로 화면 상태·에러 메시지 확인

5. **AI 일정 생성**  
   - 목적지·기간 입력 후 "AI 일정 생성하기" 클릭  
   - "1~2분 걸릴 수 있어요" 안내 노출 여부  
   - 완료 후 일정 미리보기 또는 에러 메시지 확인

6. **콘솔/네트워크**  
   - `browser_console_messages`: 콘솔 에러 여부  
   - `browser_network_requests`: 실패한 요청(4xx/5xx) 여부

### 에이전트에게 시키는 예시 프롬프트

- "Playwright MCP로 `https://우리배포URL` 열고, 스플래시 지난 뒤 홈 화면이 나오는지 스냅샷으로 확인해줘."
- "같은 URL에서 '새 여행 만들기' 들어가서 1단계(어디로)까지 진행하고, 화면에 에러나 빈 영역 있는지 스냅샷으로 점검해줘."
- "AI 일정 생성 버튼 누른 뒤 1~2분 안내 문구가 보이는지, 그리고 완료 후 일정이 보이거나 에러 메시지가 뭔지 확인해줘."

## 3. 모바일 뷰포트로 확인 (선택)

폰에서만 나오는 문제를 보려면:

- Playwright MCP 설정에 `--device "iPhone 15"` 또는 `--viewport-size "390x844"` 같은 옵션을 넣어서 실행하거나,
- Cursor MCP 설정에서 해당 인자를 추가한 뒤 스냅샷/클릭으로 동일 시나리오를 점검할 수 있습니다.

## 4. 정리

- **browser_navigate**: 대상 URL 이동  
- **browser_snapshot**: 현재 페이지 구조·텍스트 확인 (QC/QA의 기본)  
- **browser_click** / **browser_fill_form**: 버튼 클릭, 입력 필드 채우기  
- **browser_console_messages** / **browser_network_requests**: 에러·실패 요청 확인  

Playwright MCP를 켜둔 상태에서 위 프롬프트로 "우리 사이트 QC/QA 해줘"라고 하면, 위 시나리오대로 점검할 수 있습니다.
