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

### Claude AI 연동 (2026-11)

| 항목 | 구현 위치 |
|---|---|
| API 키 보관(Windows 자격 증명 관리자), Rust에서만 요청 | `src-tauri/src/claude.rs` |
| 문장 → 일정 초안(JSON 스키마) → 추가 창에서 확인 | `claudeUtils.ts` `toEventDraft`, 빠른 추가 ✨ / Shift+Enter |
| 할 일 → 체크리스트 단계 추천 | `EventForm` ✨ 단계 추천 |
| 오늘 브리핑(하루 캐시) | `BriefingModal.tsx` |
| 모델 선택, 이번 달 사용량·추정 비용 | `ClaudeSettings.tsx`, `useClaude.ts` |

## 실제 Tauri 창에서 확인이 필요한 것

브라우저 미리보기와 단위 테스트로는 확인할 수 없어서 `npm run tauri dev`에서 직접 봐야 합니다.

- 첫 실행 시 `%APPDATA%\com.calendar.app\todos.json` 등이 생기는지, WebView 데이터를 지운 뒤 다시 켜면 복구되는지
- `backups` 폴더에 하루 한 개씩 생기고 8일째부터 오래된 것이 지워지는지
- 트레이 아이콘 한 번 클릭, 툴팁 문구, Win+Alt+C 전역 단축키
- 설치본에서 알림을 눌렀을 때 위젯이 앞으로 나오는지(Windows가 앱을 다시 실행하면 단일 인스턴스 처리로 창을 띄우는 방식)
- 실제 Google 캘린더 비공개 iCal 주소 구독
- 보조 모니터·배율 125%/150%에서 메모창 위치
- 실제 API 키로 문장 → 일정, 단계 추천, 브리핑 응답 품질과 걸리는 시간(미리보기는 가짜 응답)
- 자격 증명 관리자(제어판 → 자격 증명 관리자 → Windows 자격 증명)에 `Calendar/ClaudeApiKey`가 생기고 삭제되는지

## 다음 후보

### Claude AI 다음 단계
- 여러 일정을 한 번에: "이번 주 월수금 7시 헬스, 금요일 6시 저녁 약속" → 여러 초안을 목록으로 확인
- 메일·공지 붙여넣기 → 일정 추출(학사 공지, 과제 공지)
- 빈 시간 찾기: "이번 주 2시간 공부할 시간" → 일정 사이 빈 칸 제안

### Notion 연동 (Notion API 무료)
- 할 일을 Notion 데이터베이스로 내보내기(단방향)부터. 양방향 동기화는 충돌 처리 설계 후.

### 그 밖에
- 반복 규칙: 매월 여러 날짜(1일·15일), 마지막 날, 공휴일 건너뛰기
- 일정에 장소·메모 필드, 링크 열기
- 구독 캘린더 일정도 알림 받기(선택)
- 통계: 카테고리별 시간 사용량
- `CalendarPage.tsx` 추가 분리(백업/업데이트 핸들러를 `useAppNotifications` 같은 훅으로)
