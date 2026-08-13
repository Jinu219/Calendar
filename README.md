# Calendar Window App

Windows 바탕화면에서 사용하는 캘린더·할 일·메모 위젯입니다. Tauri v2, React, TypeScript, Rust로 구성되어 있으며 월간/주간 캘린더, 반복 일정, 메모 분리창, 테마, 시작 프로그램, 트레이 동작을 지원합니다.

## 주요 기능

- 월간·주간 FullCalendar 보기
- 날짜별 할 일, 시간 일정, 반복 일정, 다일 일정
- 드래그 이동·크기 변경과 키보드 복사/붙여넣기
- 여러 메모와 최대 5개의 분리 메모창
- 5가지 색상 테마, 글꼴, 투명도, 패널 크기 설정
- Windows 트레이, 시작 프로그램, 항상 위/항상 아래 동작
- `localStorage` 기반 설정·일정·메모 보존

## 개발 환경

- Node.js 20 이상
- Rust stable 및 Windows MSVC 도구 체인
- WebView2 Runtime

```powershell
cd CWA
npm install
npm run tauri dev
```

PowerShell 실행 정책이 `npm.ps1`을 막는 환경에서는 `npm.cmd`를 사용하면 됩니다.

## 검증과 빌드

```powershell
cd CWA
npm run typecheck
npm run build
npm run check:rust
npm run check
npm run tauri build
```

`npm run check`는 TypeScript 검사, Vite 프로덕션 빌드, Rust 포맷 검사와 Clippy를 순서대로 수행합니다.

## 구조

```text
CWA/
├── src/
│   ├── components/   # 캘린더, 할 일, 설정, 메모 UI
│   ├── hooks/        # 상태, 저장소, 창 동작
│   ├── pages/        # 메인 창과 메모 창 조합
│   ├── utils/        # 날짜, 일정 확장, 공휴일, 식별자
│   ├── constants/    # 테마와 기본값
│   └── types/        # 공유 TypeScript 타입
└── src-tauri/
    ├── src/lib.rs    # 트레이와 Windows 창 동작
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

데이터는 현재 기기의 WebView 로컬 저장소에만 보관됩니다. 앱 데이터나 WebView 캐시를 삭제하기 전에 별도 백업이 필요합니다.
