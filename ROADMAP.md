# Calendar 로드맵

## 완료 (2026-11)

| 항목 | 구현 위치 |
|---|---|
| 파일 기반 저장(localStorage 미러, 최신 쪽 우선 복원) | `src/utils/persistence.ts`, `src-tauri/src/storage.rs` |
| 매일 자동 백업(최근 7개), 지금 백업, 백업 폴더 열기 | `src/hooks/useAutoBackup.ts`, `storage.rs` |
| vitest 단위 테스트(38개) + GitHub Actions CI | `src/utils/*.test.ts`, `.github/workflows/ci.yml` |
| 반복 확장: N일/주/개월/년마다, 평일, 격주·요일 지정, 매월 N번째(마지막) 요일, 매년 | `src/utils/todoUtils.ts` |
| 알림: 일정별 알림 시간(하루 전 포함), 종일 일정 아침 알림, 할 일 마감 전날 알림 | `src/hooks/useReminders.ts` |
| 지난 할 일 이월("오늘로", "모두 오늘로") | `TodoPanel`, `useTodos.carryOverTodos` |
| 검색(Ctrl+F) | `src/components/SearchModal.tsx` |
| 카테고리(색상 이름) + 🏷 필터 | `CategoryFilter.tsx`, 설정 → 카테고리 |
| 트레이 한 번 클릭, 전역 단축키(Win+Alt+C / Ctrl+Alt+C), "오늘 남은 일정 N개" 툴팁 | `lib.rs`, `hotkey.rs`, `useTrayStatus.ts` |
| 업데이트 하루 한 번 자동 확인 → 토스트에서 바로 설치 | `useAutoUpdate.ts` |
| ICS/webcal 구독(읽기 전용, 6시간마다 갱신) | `icsUtils.ts`, `useCalendarFeeds.ts`, `FeedSettings.tsx` |
| 밤(다크)·고대비 테마 | `constants`, `App.css` |
| 통계(주간 완료율, 30일, 반복 습관 연속 기록) | `statsUtils.ts`, `StatsModal.tsx` |
| 메모 체크리스트(☑ 줄 추가·눌러서 체크), 메모 날짜 연결(달력 📝·패널 표시) | `MemoBoard.tsx` |
| 하위 체크리스트 | `EventForm`, `TodoPanel` |
| 코드 정리: `useSelection`·`useRecurrenceScopePrompt` 분리, 모니터·배율 인식 창 배치, 메모창 `alert()` → 토스트, 음력표 2035년까지 | `hooks/`, `utils/windowPlacement.ts` |

### Claude AI 연동 (2026-11, 제거됨)

앱 안에서 API 키로 Claude를 부르는 기능(문장 → 일정, 단계 추천, 브리핑)을 넣었다가, 사용자가 원한 것은 "대화 중에 Claude가 앱에 일정을 넣어 주는 것"이어서 아래 MCP 연결로 바꾸고 제거했습니다. 코드는 커밋 6e4f461에 남아 있습니다.

### 화면 정리와 Claude 대화 연결 (2026-11)

| 항목 | 구현 위치 |
|---|---|
| 설정을 화면·일정·연동·앱 탭, 한 줄 행·스위치·드롭다운으로 압축, 설명 문구 제거 | `SettingsDrawer.tsx`, `SettingControls.tsx` |
| 테마는 버튼 하나 → 팝업에서 8개 고르기 | `ThemePicker.tsx` |
| 달 위상(초승달·하현달…) 표시 삭제 | `lunarUtils.ts`, `useLunarDate.ts` |
| 타임라인 일(30분 칸)/주(일~토)/월 선택, 선택 기억 | `TimelineView.tsx`, `timelineUtils.ts` |
| 🏷 카테고리 팝업이 달력 뒤로 숨던 문제(제목줄 z-index) | `App.css` `.titlebar` |
| ? 도움말 버튼을 설정 → 앱 → 단축키로 이동 | `TitleBar.tsx`, `SettingsDrawer.tsx` |
| Claude 대화 → 앱 일정 추가(MCP 서버, inbox 폴더, 2초 폴링, 한 번에 실행 취소) | `mcp/server.mjs`, `src/mcp/calendarTools.ts`, `inboxUtils.ts`, `inbox.rs`, `useAssistantInbox.ts` |

### 문장으로 일정 추가 (2026-11)

| 항목 | 구현 위치 |
|---|---|
| 한국어 날짜·시간·반복·알림·카테고리 규칙 파서, 입력 중 미리보기 | `scheduleParser.ts`, `TodoPanel.tsx` |
| ✨ / Shift+Enter → Gemini 무료 등급(여러 일정 한 번에), 키는 자격 증명 관리자 | `geminiUtils.ts`, `useGemini.ts`, `gemini.rs`, `GeminiSettings.tsx` |
| 반복 간격(격주 등)을 외부 입력 형식에 추가 | `inboxUtils.ts` `repeatInterval`, MCP 스키마 |

### 반복 삭제 범위와 우클릭 (2026-11)

| 항목 | 구현 위치 |
|---|---|
| 반복 일정 삭제: 이 날짜만 / 이 날짜부터 이후 모두 / 전체 | `RecurrenceScopeModal.tsx`, `todoUtils.ts` `endSeriesBefore`, `useTodos` `deleteFollowing` |
| 브라우저 우클릭 메뉴 막기(개발 모드·메모창 포함), 일정 우클릭 = 수정 | `usePreventBrowserBehaviors.ts`, `CalendarView.tsx` |
| 빠른 추가 "3시 반복…"을 3시 반으로 읽던 문제 | `scheduleParser.ts` |

### Notion 내보내기 (2026-11)

| 항목 | 구현 위치 |
|---|---|
| 통합 토큰 보관(자격 증명 관리자), `/v1/` 경로만 허용하는 요청 | `src-tauri/src/notion.rs`, `vault.rs` |
| 데이터베이스 주소로 연결, 없는 열 자동 추가 | `useNotion.ts` `connect`, `notionUtils.ts` `planSchemaChanges` |
| 일정 → 페이지(날짜·완료·종류·카테고리·반복, 체크리스트는 할 일 블록) | `buildPageProperties`, `buildPageChildren` |
| 바뀐 항목만 갱신, 지워진 페이지는 새로 만들기, 속도 제한 처리 | `useNotion.ts` `exportTodos` |
| 내보낼 범위, 수동/자동(수정 후 20초) 내보내기 | `NotionSettings.tsx`, `CalendarPage.tsx` |

## 실제 Tauri 창에서 확인이 필요한 것

브라우저 미리보기와 단위 테스트로는 확인할 수 없어서 `npm run tauri dev`에서 직접 봐야 합니다.

- 첫 실행 시 `%APPDATA%\com.calendar.app\todos.json` 등이 생기는지, WebView 데이터를 지운 뒤 다시 켜면 복구되는지
- `backups` 폴더에 하루 한 개씩 생기고 8일째부터 오래된 것이 지워지는지
- 트레이 아이콘 한 번 클릭, 툴팁 문구, Win+Alt+C 전역 단축키
- 설치본에서 알림을 눌렀을 때 위젯이 앞으로 나오는지(Windows가 앱을 다시 실행하면 단일 인스턴스 처리로 창을 띄우는 방식)
- 실제 Google 캘린더 비공개 iCal 주소 구독
- 보조 모니터·배율 125%/150%에서 메모창 위치
- MCP 등록 후 새 Claude 대화에서 "내일 3시 치과 넣어줘" → 켜진 앱에 2초 안에 들어오는지, 앱을 끈 채로 추가한 뒤 켜면 들어오는지, 토스트의 실행 취소
- 설정 서랍이 실제 창 크기·배율(125%/150%)에서도 탭마다 스크롤 없이 보이는지
- 실제 Gemini 무료 키로 ✨ 응답 품질과 속도, 무료 한도(429) 안내 문구, `Calendar/GeminiApiKey` 저장·삭제
- 실제 Notion 통합 토큰과 데이터베이스로 연결 → 열 자동 추가 → 내보내기 → 다시 내보내기(그대로) → 앱에서 고친 뒤 갱신, Notion에서 페이지를 지운 뒤 다시 만들어지는지
- `Calendar/NotionToken`이 자격 증명 관리자에 생기고 "토큰 삭제"로 지워지는지

## 다음 후보

### Claude 대화 연결 다음 단계
- 도구 추가: 일정 수정·완료 표시·삭제(삭제는 확인 문구 필수), 제목으로 검색
- 빈 시간 찾기 도구: "이번 주 2시간 공부할 시간" → 일정 사이 빈 칸 제안
- 설치본에 MCP 서버를 함께 넣고 설정에서 "Claude에 연결" 버튼으로 등록 명령 복사

### Notion 다음 단계
- Notion에서 체크한 완료 상태만 앱으로 가져오기(완료 열 하나만, 충돌 시 최근 변경 우선)
- 체크리스트를 고치면 페이지 본문 할 일 블록도 갱신(지금은 처음 만들 때만 씀)
- 앱에서 지운 일정의 페이지를 Notion에서 보관할지 선택하는 옵션

### 그 밖에
- 반복 일정 수정·이동에도 "이후 모두"(시리즈를 둘로 나누기)
- 반복 규칙: 매월 여러 날짜(1일·15일), 마지막 날, 공휴일 건너뛰기
- 일정에 장소·메모 필드, 링크 열기
- 구독 캘린더 일정도 알림 받기(선택)
- 통계: 카테고리별 시간 사용량
- `CalendarPage.tsx` 추가 분리(백업/업데이트 핸들러를 `useAppNotifications` 같은 훅으로)
