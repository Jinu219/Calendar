# CWA Calendar

**CWA Calendar**는 바탕화면에 자연스럽게 띄워두고 사용할 수 있는
**Tauri + React 기반 데스크톱 캘린더 / Todo 위젯 앱**입니다.

일반적인 대형 캘린더 서비스보다는, 컴퓨터를 켜두고 공부·연구·작업을 하면서
오늘 할 일과 주간 일정을 빠르게 확인하는 **로컬 데스크톱 위젯**을 목표로 합니다.

---

## 프로젝트 방향성

CWA Calendar의 핵심 방향은 다음과 같습니다.

> 바탕화면에 고정해두고 오늘 할 일과 주간 일정을 감성적으로 확인하는
> 로컬 데스크톱 캘린더 위젯

이 앱은 Google Calendar, Outlook Calendar 같은 클라우드 캘린더를 대체하기보다,
개인 사용자가 데스크톱 위에서 가볍게 일정과 Todo를 확인하고 관리하는 데 초점을 둡니다.

---

## 주요 기능

### 캘린더

* 월간 캘린더 보기
* 주간 캘린더 보기
* 날짜 클릭으로 일정 추가
* 주간 시간 클릭으로 시간 일정 추가
* 주간 시간 드래그 선택으로 일정 추가
* 일정 클릭으로 완료 상태 토글
* 일정 드래그 이동
* 시간 일정 리사이즈
* 오늘 날짜 강조
* 선택 날짜 강조
* 주말 색상 구분
* 공휴일 표시

---

### Todo / 일정 관리

* 선택 날짜별 Todo 표시
* Todo 빠른 추가
* Todo 완료 체크
* Todo 삭제
* Todo 수정 모달
* 색상 태그 지정
* TodoPanel 내 드래그 정렬
* 반복 일정 표시

현재 반복 일정은 다음 유형을 지원합니다.

* 매일 반복
* 매주 반복
* 매월 반복
* 반복 종료일

반복 일정은 캘린더와 TodoPanel 모두에서 표시됩니다.
다만 특정 반복 회차만 따로 수정하거나 삭제하는 기능은 아직 구현되지 않았습니다.

---

### 데스크톱 위젯 기능

Tauri 기반으로 데스크톱 위젯처럼 동작하도록 구성되어 있습니다.

* 프레임 없는 투명 창
* 트레이 아이콘
* 창 숨기기 / 다시 열기
* 창 닫기 시 종료가 아니라 숨김 처리
* 시작 프로그램 등록
* 작업표시줄 표시 여부 설정
* 창 위치 저장 및 복원
* TodoPanel 너비 조절
* 항상 아래 / 일반 / 항상 위 모드

창 레벨은 다음 3가지 모드를 지원합니다.

| 모드    | 설명                    |
| ----- | --------------------- |
| 항상 아래 | 바탕화면 위젯처럼 다른 창 뒤쪽에 배치 |
| 일반    | 일반 데스크톱 창처럼 사용        |
| 항상 위  | 다른 창 위에 띄워두는 오버레이 모드  |

항상 위 모드를 선택하면 화면을 덜 가리도록 투명도가 자동으로 낮아지도록 구성했습니다.

---

### 설정 기능

* 색상 테마 변경
* 배경 투명도 조절
* 오늘 날짜 표시 스타일 변경
* 날짜 숫자 위치 변경
* 월간 캘린더 6주 고정 / 자동 표시
* TodoPanel 너비 조절
* 시스템 폰트 검색 및 선택
* 글자 크기 조절
* 시작 프로그램 ON/OFF
* 작업표시줄 표시 / 트레이 중심 모드
* 음력 표시 ON/OFF
* 달 위상 표시 ON/OFF
* 12시간 / 24시간 표시 설정
* 설정 초기화

---

## 기술 스택

### Frontend

* React
* TypeScript
* Vite
* FullCalendar

### Desktop

* Tauri
* Rust

### Storage

현재 데이터는 서버나 외부 DB 없이 브라우저/Tauri의 `localStorage`에 저장됩니다.

저장되는 주요 데이터는 다음과 같습니다.

* Todo / 일정 목록
* 사용자 설정
* 창 위치

---

## 프로젝트 구조

```txt
Calendar/
└── CWA/
    ├── src/
    │   ├── components/
    │   │   ├── AddEventModal.tsx
    │   │   ├── CalendarView.tsx
    │   │   ├── EditTodoModal.tsx
    │   │   ├── SettingsDrawer.tsx
    │   │   ├── TitleBar.tsx
    │   │   └── TodoPanel.tsx
    │   ├── hooks/
    │   │   ├── useTodos.ts
    │   │   ├── useSettings.ts
    │   │   ├── useHolidays.ts
    │   │   ├── useSystemFonts.ts
    │   │   ├── useCalendarModal.ts
    │   │   ├── useMoonAndLunar.ts
    │   │   ├── useWindowBehavior.ts
    │   │   ├── useWindowPosition.ts
    │   │   ├── useTodoPanelResize.ts
    │   │   └── useCalendarKeyboardShortcuts.ts
    │   ├── pages/
    │   │   └── CalendarPage.tsx
    │   ├── types/
    │   ├── utils/
    │   ├── constants/
    │   ├── App.css
    │   └── main.tsx
    ├── src-tauri/
    │   ├── src/
    │   │   ├── lib.rs
    │   │   └── main.rs
    │   ├── capabilities/
    │   ├── Cargo.toml
    │   └── tauri.conf.json
    ├── package.json
    └── vite.config.ts
```

---

## 설치 및 실행

프로젝트의 실제 앱은 `CWA` 폴더 안에 있습니다.

```bash
cd CWA
npm install
```

개발 서버 실행:

```bash
npm run dev
```

Tauri 개발 모드 실행:

```bash
npm.cmd run tauri dev
```

또는 환경에 따라 다음 명령을 사용할 수 있습니다.

```bash
npm run tauri dev
```

---

## 빌드

```bash
cd CWA
npm run tauri build
```

빌드 결과물은 Tauri 설정에 따라 `src-tauri/target/release` 또는 `src-tauri/target/release/bundle` 하위에 생성됩니다.

---

## 최근 개발 내용

현재까지 다음 안정화 작업을 진행했습니다.

### 1. Todo 수정 모달 안정화

기존에는 input 변경 시 바로 저장이 실행되어 모달이 닫힐 수 있었습니다.
이를 수정하여 모달 내부 form state에서 먼저 수정한 뒤, 저장 버튼을 눌렀을 때만 반영되도록 변경했습니다.

### 2. 일정 추가 모달 초기값 동기화

날짜 클릭, 시간 클릭, 드래그 선택으로 모달을 열 때 이전 값이 남을 수 있는 문제를 정리했습니다.
이제 모달이 열릴 때마다 선택 날짜와 시간이 정확히 반영됩니다.

### 3. 일정 추가 흐름 정리

`CalendarPage`에서 AddEventModal submit 흐름을 정리했습니다.

* 월간 날짜 클릭으로 일정 추가 가능
* 주간 시간 클릭으로 시간 일정 추가 가능
* 드래그 선택 시간 반영
* `startDate`, `endDate` 저장 흐름 보강

### 4. 반복 일정 표시 정리

반복 일정이 캘린더에는 보이지만 TodoPanel에는 보이지 않는 문제를 정리했습니다.
이제 선택한 날짜에 발생하는 반복 일정도 TodoPanel에 표시됩니다.

### 5. TodoPanel 리사이즈 기능 연결

기존에 코드로만 존재하던 TodoPanel 너비 조절 기능을 실제 UI에 연결했습니다.
상단의 크기 조절 모드를 켜고 TodoPanel 경계선을 드래그하면 너비를 조절할 수 있습니다.

### 6. CalendarPage 구조 리팩토링

`CalendarPage.tsx`에 몰려 있던 기능을 hook으로 분리했습니다.

* `useCalendarModal`
* `useMoonAndLunar`
* `useWindowBehavior`
* `useWindowPosition`
* `useTodoPanelResize`
* `useCalendarKeyboardShortcuts`

이를 통해 `CalendarPage`는 화면 조립과 핵심 이벤트 연결에 집중하도록 정리했습니다.

### 7. SettingsDrawer 정리

설정 화면을 섹션별로 정리했습니다.

* 화면 테마
* TodoPanel 너비
* 글꼴
* 데스크톱 동작
* 음력 / 달 위상
* 초기화

### 8. Tauri 위젯 UX 개선

창 레벨 설정을 추가했습니다.

* 항상 아래
* 일반
* 항상 위

또한 항상 위 모드 선택 시, 오버레이 위젯처럼 사용할 수 있도록 투명도가 자동으로 조정되도록 했습니다.

---

## 현재 한계

아직 다음 기능은 구현되지 않았거나, 추후 개선 예정입니다.

* Google Calendar 연동
* 클라우드 동기화
* 알림 기능
* 일정 백업 / 내보내기
* 반복 일정의 특정 회차만 수정 / 삭제
* 반복 일정의 특정 회차만 완료 처리
* 정확한 음력 계산
* 달 위상 정확도 고도화
* 모바일 대응

---

## 향후 개발 계획

### 단기 계획

* 기본 CRUD 안정성 추가 점검
* TodoPanel UX 개선
* 설정 UI 세부 정리
* localStorage 데이터 백업 / 복원 기능
* JSON 내보내기 / 가져오기

### 중기 계획

* 알림 기능
* 반복 일정 예외 처리
* 일정 검색
* 날짜 범위 일정 표시 개선
* 빌드 및 배포 자동화

### 장기 계획

* Google Calendar 연동
* 계정 기반 동기화
* 클라우드 백업
* 플러그인형 위젯 확장

---

## 개발 메모

이 프로젝트는 현재 로컬 데스크톱 위젯 앱을 목표로 개발 중입니다.
따라서 초기 개발 단계에서는 외부 연동보다 다음 기준을 우선합니다.

* 매일 실제로 쓸 수 있는가
* 빠르게 추가하고 빠르게 확인할 수 있는가
* 위젯처럼 가볍고 자연스러운가
* 로컬 앱으로서 안정적인가
* 새 기능보다 기존 기능의 신뢰도를 높였는가

---

## 라이선스

현재 라이선스는 명시되어 있지 않습니다.
배포 전 라이선스 정책을 추가할 예정입니다.
