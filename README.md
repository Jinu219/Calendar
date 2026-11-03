# Calendar Window App

Windows 바탕화면에서 사용하는 캘린더·할 일·메모 위젯입니다. Tauri v2, React, TypeScript, Rust로 구성되어 있으며 월간/주간 캘린더, 반복 일정, 메모 분리창, 테마, 시작 프로그램, 트레이 동작을 지원합니다.

## 주요 기능

- 월간·주간·타임라인(일/주/월) 보기, 제목(예: 2026년 11월)을 눌러 원하는 달로 바로 이동
- 날짜별 할 일, 시간 일정, 반복 일정, 다일 일정
- 빠른 추가: 할 일 패널 입력창에 문장으로 적고 Enter — `내일 3시 치과`, `다음 주 화요일 오후 2시~4시 스터디 30분 전 알림`, `매주 월수금 7시 헬스 12월 31일까지`, `11/11~11/13 대동제 #축제`, `금요일까지 보고서`(할 일). 무엇으로 들어갈지 입력창 아래에 미리 보여 주고, 인터넷 없이 동작
- 반복: 매일·평일·N일/주/개월/년마다, 격주 요일 지정, 매월 N번째(마지막) 요일, 매년 — 특정 회차만 수정·삭제·이동, "이 날짜부터 이후 모두" 삭제, 회차별 완료 표시
- 하위 체크리스트, 지난 할 일 "오늘로" 이월, 검색(Ctrl+F), 카테고리(색상 이름) 필터, 통계(주간 완료율·습관 연속 기록)
- Google 캘린더·학사일정 ICS/webcal 구독(읽기 전용)
- 일정 우클릭으로 수정(브라우저 메뉴는 뜨지 않음), 드래그 이동·크기 변경(시간·기간 보존), 키보드 복사/붙여넣기, 실행 취소·다시 실행(Ctrl+Z / Ctrl+Y, 토스트의 "실행 취소" 버튼)
- 키보드 단축키(`?` 또는 설정 → 앱 → 단축키로 도움말): ←/→ 이동, T 오늘, 1/2/3 보기 전환, N 새 항목, `/` 빠른 추가, Enter 완료, Delete 삭제, Ctrl+F 검색, S 통계, 어디서든 Win+Alt+C(사용 중이면 Ctrl+Alt+C)로 보이기/숨기기
- 한국 공휴일·대체공휴일(2023년 개정 규칙 포함)을 오프라인에서도 계산
- 여러 메모와 최대 5개의 분리 메모창, 메모 체크리스트, 메모를 날짜에 연결(달력 📝)
- 8가지 테마(밤·고대비 포함), 글꼴, 글꼴 크기(화면 전체에 적용), 투명도, 패널 크기 설정 — 설정은 화면·일정·연동·앱 탭으로 나뉘어 스크롤 없이 한눈에
- 접근성: 모든 버튼의 스크린리더 라벨, 키보드 포커스 표시, Esc로 닫히는 대화상자, Windows "애니메이션 끄기" 설정 존중
- Windows 알림: 일정별 알림 시간(하루 전까지), 종일 일정 아침 알림, 할 일 마감 전날 알림
- 트레이 아이콘 한 번 클릭으로 열기, 툴팁에 "오늘 남은 일정 N개"
- 데이터 백업 내보내기·가져오기(JSON), 매일 자동 백업(최근 7개)
- GitHub Releases 기반 업데이트(하루 한 번 자동 확인, 알림에서 바로 설치)
- Windows 트레이, 시작 프로그램, 항상 위/항상 아래 동작
- 일정·메모·설정은 `localStorage`와 앱 데이터 폴더의 파일에 함께 저장(WebView 데이터가 지워져도 복구)

## Claude 대화로 일정 추가 (MCP)

Claude(Claude Code·Claude 데스크톱 앱의 Code 탭)와 대화하다가 "이거 캘린더에 넣어줘"라고 하면 Claude가 이 앱에 바로 추가합니다. API 키나 추가 비용은 없습니다.

1. 한 번만 빌드: `cd Calendar` 후 `npm run build:mcp` → `Calendar/mcp/dist/calendar-mcp.mjs`
2. Claude Code에 등록: `claude mcp add calendar -s user -- node "<저장소 경로>/Calendar/mcp/dist/calendar-mcp.mjs"`
3. 새 대화에서 "다음 주 화요일 3시 치과 일정 넣어줘"처럼 말하면 됩니다.

- Claude가 쓰는 도구: `add_calendar_events`(일정·할 일 추가, 반복·알림·카테고리·체크리스트 지원), `list_calendar_events`(기간의 일정 보기)
- 추가는 앱 데이터 폴더의 `inbox\`에 요청 파일로 들어가고, 켜져 있는 앱이 2초 안에 가져가 실행 취소 가능한 한 번의 변경으로 추가합니다. 앱이 꺼져 있으면 다음 실행 때 추가됩니다.
- 설정 → 연동 → "대화에서 일정 받기"를 끄면 받지 않습니다.

## ✨ 무료 AI로 문장 읽기 (Gemini, 선택)

규칙으로 못 알아듣는 문장이나 여러 일정을 한 번에 넣을 때 씁니다. Google AI Studio의 무료 등급 키를 쓰므로 비용이 없습니다.

1. aistudio.google.com 에 로그인 → Get API key → 키 만들기(카드 필요 없음)
2. 설정 → 연동 → 무료 AI에서 켜고 키(`AIza…`)를 저장
3. 빠른 추가 칸에 "이번 주 월수금 7시 헬스, 금요일 6시 저녁 약속"처럼 적고 ✨ 또는 Shift+Enter

- 모델: 3.5 Flash-Lite(기본, 하루 수백 회) / 3.8 Flash(더 정확, 무료 횟수 적음). 정확한 무료 한도는 AI Studio에서 확인할 수 있고, 설정에 오늘 사용 횟수가 보입니다.
- 보내는 내용은 입력한 문장, 오늘 날짜·시각, 선택한 날짜, 카테고리 이름뿐입니다. 무료 등급에 보낸 문장은 Google이 서비스 개선에 쓸 수 있습니다.
- 키는 Windows 자격 증명 관리자(`Calendar/GeminiApiKey`)에만 저장되고, Enter(규칙)로는 아무것도 보내지 않습니다.

## Notion 내보내기 (선택)

일정을 내 Notion 데이터베이스로 내보냅니다(앱 → Notion 한 방향, Notion API는 무료).

1. notion.so/profile/integrations 에서 내부 통합을 만들고 토큰(`ntn_…`)을 복사합니다. 기능에서 콘텐츠 읽기·입력·업데이트를 켭니다.
2. 내보낼 데이터베이스를 열고 ··· → 연결 → 방금 만든 통합을 추가합니다.
3. 설정 → Notion에서 토큰을 저장하고 데이터베이스 주소를 붙여 넣어 연결합니다. 없는 열(날짜·완료·종류·카테고리·반복·Calendar ID)은 자동으로 만들어집니다.
4. "지금 Notion으로 내보내기"를 누르거나, "고칠 때마다 자동"을 켜면 수정 후 20초 뒤에 바뀐 항목만 보냅니다.

- 범위: 오늘부터(기본) / 최근 30일부터 / 전체. 끝나지 않은 할 일과 진행 중인 반복 일정은 늘 포함되고, 구독 캘린더 항목은 보내지 않습니다.
- 다시 내보내면 같은 페이지를 고치고, 바뀌지 않은 항목은 요청하지 않습니다. 앱에서 지운 일정의 페이지는 Notion에 그대로 둡니다(원격 삭제 없음).
- 반복 일정은 페이지 하나로, "반복" 열에 규칙(예: 매주 월·수)을 적습니다. 회차별 완료는 앱에만 있습니다.
- 토큰은 Windows 자격 증명 관리자(`Calendar/NotionToken`)에만 저장됩니다.

## 개발 환경

- Node.js 20 이상
- Rust stable 및 Windows MSVC 도구 체인
- WebView2 Runtime

```powershell
cd Calendar
npm install
npm run tauri dev
```

PowerShell 실행 정책이 `npm.ps1`을 막는 환경에서는 `npm.cmd`를 사용하면 됩니다.

화면만 고칠 때는 Rust 빌드 없이 `npm run dev`로 띄운 http://localhost:1420 을 일반 브라우저에서 열어도 됩니다. Tauri API는 개발용 mock(`src/dev/browserPreview.ts`)으로 대체되어 트레이·알림·파일 대화상자 같은 네이티브 기능만 동작하지 않습니다.

## 검증과 빌드

```powershell
cd Calendar
npm run typecheck
npm test
npm run build
npm run check:rust
npm run check
npm run tauri build
```

`npm run check`는 TypeScript 검사, vitest 단위 테스트, Vite 프로덕션 빌드, MCP 서버 번들, Rust 포맷 검사와 Clippy를 순서대로 수행합니다. 같은 검사가 GitHub Actions(`.github/workflows/ci.yml`)에서 push·PR마다 돌아갑니다.

## 구조

```text
Calendar/
├── src/
│   ├── components/   # 캘린더, 할 일, 설정, 메모 UI
│   ├── hooks/        # 상태, 저장소, 창 동작
│   ├── pages/        # 메인 창과 메모 창 조합
│   ├── utils/        # 날짜, 반복 회차 계산, 공휴일, 음력, 식별자
│   ├── mcp/          # Claude가 쓰는 MCP 도구 정의(순수 함수)
│   ├── dev/          # 브라우저 미리보기용 Tauri mock (개발 전용)
│   ├── constants/    # 테마와 기본값
│   └── types/        # 공유 TypeScript 타입
├── mcp/server.mjs    # Claude용 MCP 서버(stdio) — npm run build:mcp로 mcp/dist에 묶음
└── src-tauri/
    ├── src/lib.rs    # 트레이와 Windows 창 동작
    ├── src/storage.rs # 데이터 파일 미러, 자동 백업, ICS 다운로드
    ├── src/hotkey.rs  # 전역 단축키
    ├── src/inbox.rs   # Claude 대화에서 온 추가 요청(inbox 폴더) 가져오기
    ├── src/gemini.rs  # Gemini 키 보관과 generateContent 요청(모델 제한)
    ├── src/notion.rs  # Notion 토큰 보관과 API 요청(경로 제한)
    ├── src/vault.rs   # Windows 자격 증명 관리자 읽기·쓰기
    └── capabilities/ # Tauri 창 권한
```

자세한 유지보수 맥락은 [PROJECT_PROMPT.md](PROJECT_PROMPT.md)를 참고하세요.

## 저장 데이터

| 키 | 내용 |
|---|---|
| `cwa-todos-v4` | 일정과 할 일 |
| `cwa-settings-v4` | 화면 및 창 설정 |
| `cwa:memos` | 메모 내용과 순서 |
| `cwa-win-pos` | 메인 창 위치 |
| `cwa:holidays-api:<연도>` | 공휴일 API 응답 캐시(7일) |
| `cwa:feed-cache` | 구독 캘린더 캐시(6시간마다 갱신) |
| `cwa:notion-map` | 일정 ↔ Notion 페이지 연결과 마지막으로 보낸 내용의 지문 |
| `cwa:notion-last-export` | 마지막 Notion 내보내기 결과 |
| `cwa:inbox-last` | Claude 대화에서 마지막으로 받은 항목 |
| `cwa:gemini-usage` | 오늘 Gemini 요청 횟수 |

`todos`·`settings`·`memos`는 `%APPDATA%\com.calendar.app\` 아래 같은 이름의 `.json` 파일에도 저장되고, 시작할 때 둘 중 최신 쪽으로 맞춥니다. 자동 백업은 같은 폴더의 `backups\`에 하루 하나씩, 최근 7개를 보관합니다.

PC를 옮길 때는 설정 화면의 "데이터 백업 → 내보내기"로 JSON 파일을 만들어 두면 앱 재설치나 PC 초기화 후 "가져오기"로 복원할 수 있습니다.

## 자동 업데이트

`src-tauri/tauri.conf.json`의 `plugins.updater`가 GitHub Releases의 `latest.json`을 확인하도록 설정되어 있습니다. 새 버전을 배포하려면:

1. `src-tauri/tauri.conf.json`의 `version`을 올린다.
2. GitHub 저장소 시크릿에 `TAURI_SIGNING_PRIVATE_KEY`(서명 키 파일 내용)와 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`(빈 문자열이면 빈 값)를 등록한다. 서명 키는 `npm run tauri signer generate`로 만들며, 개인키(`src-tauri/keys/*.key`)는 저장소에 커밋하지 않는다.
3. `v0.1.1`과 같은 태그를 푸시하면 `.github/workflows/release.yml`이 서명된 설치 파일과 `latest.json`을 GitHub Release로 게시한다.
4. 워크플로는 Release를 **초안(draft)** 으로 만든다. 초안은 `releases/latest`에 잡히지 않으므로, GitHub에서 Publish해야 앱이 새 버전을 찾는다.

앱은 설정 화면의 "업데이트 확인" 버튼으로 새 버전 여부를 확인하고 설치할 수 있습니다.
