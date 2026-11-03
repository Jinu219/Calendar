# Calendar Window App

Windows 바탕화면에서 사용하는 캘린더·할 일·메모 위젯입니다. Tauri v2, React, TypeScript, Rust로 구성되어 있으며 월간/주간 캘린더, 반복 일정, 메모 분리창, 테마, 시작 프로그램, 트레이 동작을 지원합니다.

## 주요 기능

- 월간·주간·타임라인 보기, 제목(예: 2026년 11월)을 눌러 원하는 달로 바로 이동
- 날짜별 할 일, 시간 일정, 반복 일정, 다일 일정
- 빠른 추가: 할 일 패널 입력창에 `14:30 회의`, `오후 3시 반 미팅`, `회의 14:00~15:30`처럼 적고 Enter
- 반복 일정의 특정 발생만 수정·삭제·이동하는 예외 처리, 회차별 완료 표시
- 드래그 이동·크기 변경(시간·기간 보존), 키보드 복사/붙여넣기, 실행 취소·다시 실행(Ctrl+Z / Ctrl+Y, 토스트의 "실행 취소" 버튼)
- 키보드 단축키(`?`로 도움말): ←/→ 이동, T 오늘, 1/2/3 보기 전환, N 새 항목, `/` 빠른 추가, Enter 완료, Delete 삭제
- 한국 공휴일·대체공휴일(2023년 개정 규칙 포함)을 오프라인에서도 계산
- 여러 메모와 최대 5개의 분리 메모창
- 6가지 색상 테마, 글꼴, 글꼴 크기(화면 전체에 적용), 투명도, 패널 크기 설정
- 접근성: 모든 버튼의 스크린리더 라벨, 키보드 포커스 표시, Esc로 닫히는 대화상자, Windows "애니메이션 끄기" 설정 존중
- 시간이 지정된 일정에 대한 Windows 데스크톱 알림(리마인더)
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

화면만 고칠 때는 Rust 빌드 없이 `npm run dev`로 띄운 http://localhost:1420 을 일반 브라우저에서 열어도 됩니다. Tauri API는 개발용 mock(`src/dev/browserPreview.ts`)으로 대체되어 트레이·알림·파일 대화상자 같은 네이티브 기능만 동작하지 않습니다.

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
│   ├── utils/        # 날짜, 반복 회차 계산, 공휴일, 음력, 식별자
│   ├── dev/          # 브라우저 미리보기용 Tauri mock (개발 전용)
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
| `cwa:holidays-api:<연도>` | 공휴일 API 응답 캐시(7일) |

데이터는 현재 기기의 WebView 로컬 저장소에만 보관됩니다. 설정 화면의 "데이터 백업 → 내보내기"로 JSON 파일을 만들어 두면 앱 재설치나 PC 초기화 후 "가져오기"로 복원할 수 있습니다.

## 자동 업데이트

`src-tauri/tauri.conf.json`의 `plugins.updater`가 GitHub Releases의 `latest.json`을 확인하도록 설정되어 있습니다. 새 버전을 배포하려면:

1. `src-tauri/tauri.conf.json`의 `version`을 올린다.
2. GitHub 저장소 시크릿에 `TAURI_SIGNING_PRIVATE_KEY`(서명 키 파일 내용)와 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`(빈 문자열이면 빈 값)를 등록한다. 서명 키는 `npm run tauri signer generate`로 만들며, 개인키(`src-tauri/keys/*.key`)는 저장소에 커밋하지 않는다.
3. `v0.1.1`과 같은 태그를 푸시하면 `.github/workflows/release.yml`이 서명된 설치 파일과 `latest.json`을 GitHub Release로 게시한다.
4. 워크플로는 Release를 **초안(draft)** 으로 만든다. 초안은 `releases/latest`에 잡히지 않으므로, GitHub에서 Publish해야 앱이 새 버전을 찾는다.

앱은 설정 화면의 "업데이트 확인" 버튼으로 새 버전 여부를 확인하고 설치할 수 있습니다.
