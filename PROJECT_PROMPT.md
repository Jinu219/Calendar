# Calendar Window App 유지보수 맥락

## 제품

Calendar는 Windows 전용 데스크톱 캘린더 위젯이다. 메인 창은 닫을 때 종료하지 않고 트레이로 숨기지만, 동적으로 생성한 메모창은 닫을 때 반드시 파괴되어 창 라벨을 반환해야 한다.

## 기술 구성

- Tauri v2 + Rust: 트레이, 단일 인스턴스, 시작 프로그램, 창 레벨과 작업표시줄 동작
- React 19 + TypeScript + Vite: 전체 UI와 로컬 상태
- FullCalendar 6: 월간·주간 보기와 일정 드래그/크기 변경
- localStorage + 앱 데이터 폴더의 JSON 파일 미러(`persistItem`/`hydrateFromDisk`): 일정, 설정, 메모. 창 위치·캐시는 localStorage만

## 코드 책임

- `Calendar/src/pages/CalendarPage.tsx`: 메인 기능 조합만 담당한다. 반복 일정의 "이 날짜만/전체" 확인(`withScope`)도 여기서 한 곳으로 처리한다.
- `Calendar/src/components`: 표현과 사용자 입력을 담당한다. 모든 모달은 `ModalShell`(Esc·포커스 가두기·aria-modal), 버튼 묶음은 `SegmentedControl`, 추가/수정 폼은 `EventForm`을 쓴다.
- `Calendar/src/hooks`: 저장 상태 및 Tauri 창과 연결되는 부수 효과를 담당한다.
- `Calendar/src/utils`: React와 무관한 날짜·일정·공휴일 로직을 담당한다.
  - `todoUtils.ts`: 반복 회차 계산(`getOccurrenceStartOn`, `listOccurrenceStarts`, `isOccurrenceDone`)과 드래그 결과 반영(`shiftTodoToTiming`). 달력·타임라인·할 일 패널·알림이 모두 이것만 사용해야 서로 어긋나지 않는다.
  - `holidayUtils.ts`: 공휴일·대체공휴일을 법령 규칙으로 직접 계산한다. 공휴일 API는 미리 알 수 없는 날짜(임시공휴일)만 보탠다.
- `Calendar/src/dev/browserPreview.ts`: 개발 모드에서 Tauri 없이 일반 브라우저로 UI를 띄우기 위한 mock. 프로덕션 번들에는 포함되지 않는다.
- `Calendar/src-tauri/src/lib.rs`: Windows 네이티브 창 정책과 트레이를 담당한다.
- `Calendar/src-tauri/src/storage.rs`: 고정된 파일 이름(`todos`/`settings`/`memos`, `backups/calendar-backup-YYYY-MM-DD.json`)만 쓴다. ICS 다운로드(CORS 회피)도 여기서 한다.
- `Calendar/src-tauri/src/hotkey.rs`: Win+Alt+C(실패 시 Ctrl+Alt+C) 전역 단축키.
- `Calendar/mcp/server.mjs` + `Calendar/src/mcp/calendarTools.ts`: Claude 대화용 MCP 서버(stdio JSON-RPC). 도구는 `add_calendar_events`·`list_calendar_events` 두 개. `npm run build:mcp`가 `vite.mcp.config.ts`로 공유 TS까지 `mcp/dist/calendar-mcp.mjs` 하나로 묶는다. `src/mcp`와 거기서 쓰는 utils는 utils 배럴(Tauri를 끌어옴) 대신 개별 파일을 import한다.
- `Calendar/src/utils/inboxUtils.ts`: Claude가 보낸 항목 검증(`parseInboxEvent`) — MCP 서버와 앱이 같은 함수를 쓴다. `Calendar/src-tauri/src/inbox.rs`의 `take_inbox`가 `<앱 데이터>/inbox/*.json`을 읽고 지우며, `useAssistantInbox`가 2초마다(그리고 창 포커스 때) 가져가 `addTodos` 한 번으로 넣는다.
- `Calendar/src/utils/scheduleParser.ts`: 빠른 추가의 한국어 문장 규칙 파서(`parseScheduleText`) — 날짜(내일·다음 주 화요일·11/20·15일·이번 주말), 범위(~, 부터…까지), 시간(오후 3시 반, 3시~5시, 정오), 반복(매주 월수금·격주·평일·매달 N일·매년), 알림, #카테고리, "X까지" 마감. 결과는 `InboxEventInput`이라 `parseInboxEvent`를 거친다.
- `Calendar/src/utils/geminiUtils.ts` + `Calendar/src-tauri/src/gemini.rs`: ✨/Shift+Enter 때만 Gemini `generateContent`(무료 등급, `x-goog-api-key`, `responseJsonSchema`)로 문장을 읽는다. 키는 `Calendar/GeminiApiKey`, 모델은 Rust 허용 목록(`gemini-3.5-flash-lite`, `gemini-3.8-flash`)만.
- `Calendar/src/utils/timelineUtils.ts`: 타임라인 일/주/월 범위(`getTimelineRange`, 주는 일~토), 이동, 제목, 일 보기의 30분 칸 배치(`getDaySlots`).
- `Calendar/src-tauri/src/vault.rs`: Windows 자격 증명 관리자(CredWrite/CredRead/CredDelete) 공용 코드. `notion.rs`와 `gemini.rs`가 쓴다.
- `Calendar/src-tauri/src/notion.rs`: Notion 통합 토큰을 `Calendar/NotionToken`에 보관하고, `https://api.notion.com` 아래 `/v1/…` 경로로만 요청한다(`Notion-Version: 2025-09-03`, 메서드는 GET/POST/PATCH만).
- `Calendar/src/utils/notionUtils.ts`: 데이터베이스 열 구성, 일정 → 페이지 속성 변환, 내보낼 범위, 응답 오류 해석. `useNotion.ts`가 요청 순서·속도 제한·페이지 연결 표(`cwa:notion-map`)를 맡는다.

## 유지해야 할 불변 조건

1. 일정의 `date`와 `startDate`를 이동할 때 다일 일정의 기간을 보존한다.
2. FullCalendar의 종일 종료일은 exclusive이므로 저장 시 마지막 포함 날짜로 변환한다.
3. 메모창 간 데이터는 `storage` 이벤트로 동기화한다.
4. 메인 창에만 `CloseRequested` 숨김 정책을 적용한다.
5. Tauri capability에는 실제 프런트엔드에서 사용하는 창 권한만 둔다.
6. 저장 데이터를 읽을 때 이전 버전이나 손상된 JSON을 기본값으로 정규화한다.
7. 반복 일정의 특정 발생을 수정·삭제할 때는 원본 반복 규칙을 건드리지 않고 `Todo.exceptions`에 발생일을 추가하거나, 별도의 `repeat: "none"` 일정으로 분리한다.
8. `write_text_file`/`read_text_file` Rust 커맨드는 네이티브 다이얼로그로 사용자가 직접 고른 경로에만 사용한다(임의 경로를 프런트엔드에서 전달하지 않는다).
9. 업데이트 서명 개인키(`src-tauri/keys/*.key`)는 저장소에 커밋하지 않는다. `tauri.conf.json`에는 공개키만 둔다.
10. 완료 상태: 반복 없는 일정은 `done`, 반복 일정은 회차 시작일 목록 `doneDates`로 관리한다. 반복 일정의 `done`은 항상 `false`다.
11. 반복 일정을 드래그/리사이즈하면 범위를 묻는다. "이 날짜만"은 분리(`repeat: "none"`)하고, "전체"는 시리즈 시작일·`exceptions`·`doneDates`·`repeatEndDate`를 같은 일수만큼 함께 옮긴다. 한 번의 조작은 한 번의 Ctrl+Z로 되돌아가야 한다(여러 필드를 바꿔도 `mutate` 한 번).
12. 할 일 패널의 끌어서 순서 바꾸기는 `sortOrder`만 바꾼다. 날짜는 절대 바꾸지 않는다.
13. FullCalendar의 날짜 셀 콜백 인자에는 `dateStr`이 없다(타입이 임의 속성을 허용해 컴파일은 되지만 항상 `undefined`). `fmtDate(arg.date)`를 쓴다.
14. FullCalendar `changeView` 같은 동기 재렌더 호출은 React 커밋 중에 하지 않는다(다음 틱으로 미룬다).
15. 음력 공휴일 표(`LUNAR_HOLIDAYS`)는 2035년까지 있다(2031~2035는 천문 계산값). 이후 연도는 Intl 중국력으로 추정하므로 한국천문연구원 자료로 표를 늘려 둔다.
16. 중요한 저장은 `localStorage.setItem` 대신 `persistItem`을 쓴다(파일 미러와 저장 시각 기록). 시작 시 `hydrateFromDisk`가 렌더 전에 끝나야 한다.
17. 구독 캘린더 항목(`Todo.sourceId`)은 읽기 전용이다. `todos` 상태에 섞지 않고 표시할 때만 합친다(선택·수정·삭제·알림·통계 대상 아님).
18. 반복 회차 판정은 `doesOccurrenceStartOn` 하나가 결정한다. `listOccurrenceStarts`는 보이는 범위를 하루씩 훑으며 그것만 호출한다. 새 반복 규칙은 여기와 `describeRepeat`, ICS의 `toRepeat`만 고치면 된다.
19. 하위 체크리스트는 반복 없는 항목에만 둔다(회차별 상태를 만들지 않기 위해).
20. MCP 서버는 앱 데이터 파일(todos/settings/memos)을 절대 쓰지 않는다. 추가는 `inbox/`에 요청 파일 하나(임시 파일에 쓴 뒤 이름 바꾸기)로만 하고, 앱이 다시 검증해 넣는다. 그래서 앱이 켜져 있어도 저장 충돌이 없다.
21. 한 요청의 항목은 전부 통과해야 남긴다(하나라도 틀리면 아무것도 추가하지 않고 고칠 점을 돌려준다). 다시 시도해도 중복이 생기지 않게 하기 위해서다. 한 요청은 앱에서 Ctrl+Z 한 번으로 되돌아간다.
22. `take_inbox`는 고정 폴더의 `.json`만 읽고(256KB 초과·`.tmp` 제외), 읽은 파일은 바로 지운다. 동시 호출은 잠금으로 막아 같은 요청이 두 번 들어오지 않는다. 설정 "대화에서 일정 받기"(`assistantInbox`)가 꺼져 있으면 앱은 가져가지 않고, MCP 서버도 추가를 거절한다.
23. 앱 화면 안에는 유료 AI 호출을 두지 않는다(2026-11에 넣었던 Claude API 기능은 사용자 요청으로 제거, 기록은 6e4f461). Claude는 사용자의 대화 쪽에서 MCP로 들어오고, 앱 안 AI는 사용자의 무료 Gemini 키로 누를 때만 쓴다(30번).
24. 설정 서랍은 화면·일정·연동·앱 네 탭, 한 줄짜리 행(`SettingControls.tsx`)으로 만든다. 켜고 끄기는 `Switch`(role="switch"), 여러 값은 `SelectRow`, 설명 문장은 꼭 필요한 곳(Notion 설정 방법 등)에만 접어서 둔다.
25. Notion 토큰도 웹뷰로 돌려보내지 않고 localStorage·파일·백업에 쓰지 않는다. `notion_request`는 `/v1/`로 시작하고 `..`가 없는 경로만 받는다(웹뷰가 임의 주소로 토큰을 보내지 못하게).
26. Notion 연동은 앱 → Notion 한 방향이다. Notion 페이지를 지우거나 보관하지 않고, Notion의 변경을 앱으로 가져오지 않는다. 양방향은 충돌 규칙을 먼저 정한 뒤에만 넣는다.
27. Notion API는 데이터 소스 방식(2025-09-03)을 쓴다: 데이터베이스 → `data_sources[0].id` → 속성 조회·추가, 페이지 부모는 `data_source_id`. 같은 이름인데 종류가 다른 열은 덮어쓰지 않고 사용자에게 이름을 바꾸라고 알린다.
28. 내보내기는 항목마다 속성 지문을 저장해 바뀐 것만 보낸다. 요청 사이 350ms 간격, 429는 Retry-After만큼 기다려 최대 3번 다시 시도한다. 토큰·권한·네트워크 오류는 그 자리에서 멈추고, 항목 하나의 오류는 세고 계속한다.
29. 빠른 추가의 Enter는 항상 규칙 파서(`parseScheduleText`)만 쓰고 네트워크를 쓰지 않는다. 입력 중 미리보기도 같은 함수로 만든다. 새 표현은 `scheduleParser.ts`와 테스트에만 추가한다. "시" 뒤에는 조사만 허용(시험·시작을 시간으로 읽지 않게), 시간 앞 숫자가 날짜의 일부("11/20")면 시간이 아니다. 오전/오후 없는 1~6시는 오후, 7~12시는 그대로.
30. Gemini는 사용자가 ✨/Shift+Enter를 누를 때만 부르고, 문장·오늘 날짜/시각·선택한 날짜·카테고리 이름 외에는 보내지 않는다(다른 일정 금지). 키는 웹뷰로 돌려보내지 않는다. 응답은 `readGeminiResponse` → `parseInboxEvent`를 통과한 항목만 `addTodos` 한 번으로 넣고 실행 취소 토스트를 띄운다. 진행 중 중복 요청은 막고, 사용 횟수는 상태 업데이트 함수 밖에서 센다.
31. Gemini 요청에는 temperature 같은 생성 옵션을 넣지 않는다(Gemini 3 계열은 기본값 권장). 선택 필드는 null 대신 생략하도록 스키마를 만들고, 혹시 온 null은 지운 뒤 검증한다.
32. 반복 일정 범위는 "이 날짜만 / 이후 모두 / 전체" 세 가지다(`RecurrenceScope`). "이후 모두"는 지금 삭제에만 있다: `endSeriesBefore`가 `repeatEndDate`를 그 전날로 당기고 그날 이후의 `exceptions`·`doneDates`를 지우며, 앞에 남는 회차가 없으면 일정을 통째로 지운다. 수정·이동에 넣으려면 시리즈를 둘로 나누는 설계(이후 부분을 새 반복 일정으로)가 필요하다.
33. 브라우저 우클릭 메뉴(새로고침·다른 이름으로 저장)는 개발 모드 포함 두 창 모두에서 막는다(텍스트 입력칸은 잘라내기·붙여넣기 메뉴 유지). 새로고침·인쇄·저장·개발자 도구 키는 빌드에서만 막는다. 일정 우클릭은 수정(할 일 패널과 같음).

## 검증 기준

변경 후 `Calendar`에서 `npm run check`를 실행한다. 화면만 바뀐 경우에는 `npm run dev`로 띄운 http://localhost:1420 을 일반 브라우저에서 열어 확인할 수 있다(네이티브 기능은 mock). 창 동작 변경은 가능하면 `npm run tauri dev`에서 다음을 수동 확인한다.

- 메인 창 닫기 → 트레이로 숨김
- 메모창 닫기 → 실제 파괴 후 같은 슬롯 재사용
- 일정 이동·크기 변경 → 날짜와 기간 보존
- 메모 입력 → 다른 메모창에 동기화
- 트레이와 설정 화면의 시작 프로그램 상태 일치
- 반복 일정에서 "이 일정만" 수정/삭제 → 다른 발생은 그대로 유지
- 반복 일정 드래그 → 범위 선택 창, 취소하면 원래 자리로 복귀
- 반복 일정 한 회차 완료 → 그 날짜만 완료 표시
- 창 이동 후 재시작 → 같은 위치, 모니터를 뺀 뒤 재시작 → 화면 안에 표시
- 일정 삭제/이동 후 Ctrl+Z → 원상 복구, 다시 Ctrl+Y → 재적용
- 설정 → 데이터 백업 내보내기/가져오기 → 일정·메모·설정 복원
