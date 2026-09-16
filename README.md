# Calendar Window App

Windows 바탕화면에서 사용하는 캘린더·할 일·메모 위젯입니다. Tauri v2, React, TypeScript, Rust로 구성되어 있으며 월간/주간 캘린더, 반복 일정, 메모 분리창, 테마, 시작 프로그램, 트레이 동작을 지원합니다.

## 주요 기능

- 월간·주간 FullCalendar 보기
- 날짜별 할 일, 시간 일정, 반복 일정, 다일 일정
- 반복 일정의 특정 발생만 수정·삭제하는 예외 처리
- 드래그 이동·크기 변경과 키보드 복사/붙여넣기, 실행 취소·다시 실행(Ctrl+Z / Ctrl+Y)
- 여러 메모와 최대 5개의 분리 메모창
- 5가지 색상 테마, 글꼴, 투명도, 패널 크기 설정
- 시간이 지정된 일정·할 일에 대한 Windows 데스크톱 알림(리마인더)
- 데이터 백업 내보내기·가져오기(JSON)
- GitHub Releases 기반 자동 업데이트 확인·설치
- Windows 트레이, 시작 프로그램, 항상 위/항상 아래 동작
- `localStorage` 기반 설정·일정·메모 보존

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

## 검증과 빌드

```powershell
cd Calendar
npm run typecheck
npm run build
npm run check:rust
npm run check
npm run tauri build
```

`npm run check`는 TypeScript 검사, Vite 프로덕션 빌드, Rust 포맷 검사와 Clippy를 순서대로 수행합니다.

## 구조

```text
Calendar/
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

데이터는 현재 기기의 WebView 로컬 저장소에만 보관됩니다. 설정 화면의 "데이터 백업 → 내보내기"로 JSON 파일을 만들어 두면 앱 재설치나 PC 초기화 후 "가져오기"로 복원할 수 있습니다.

## 자동 업데이트

`src-tauri/tauri.conf.json`의 `plugins.updater`가 GitHub Releases의 `latest.json`을 확인하도록 설정되어 있습니다. 새 버전을 배포하려면:

1. `src-tauri/tauri.conf.json`의 `version`을 올린다.
2. GitHub 저장소 시크릿에 `TAURI_SIGNING_PRIVATE_KEY`(서명 키 파일 내용)와 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`(빈 문자열이면 빈 값)를 등록한다. 서명 키는 `npm run tauri signer generate`로 만들며, 개인키(`src-tauri/keys/*.key`)는 저장소에 커밋하지 않는다.
3. `v0.1.1`과 같은 태그를 푸시하면 `.github/workflows/release.yml`이 서명된 설치 파일과 `latest.json`을 GitHub Release로 게시한다.

앱은 설정 화면의 "업데이트 확인" 버튼으로 새 버전 여부를 확인하고 설치할 수 있습니다.
