# Calendar Window App (CWA) - 프로젝트 프롬프트

## 📋 프로젝트 개요

**Calendar Window App (CWA)**는 Windows 환경에서 동작하는 네이티브 데스크톱 캘린더 위젯 앱입니다. Tauri v2 + React + TypeScript로 구축되었으며, 작업표시줄과 Alt-Tab 목록에 나타나지 않고 데스크탑 위젯처럼 항상 맨 뒤에 위치하여 일정과 할 일을 관리할 수 있습니다.

---

## 🛠 기술 스택

### 프론트엔드
- **React 19.1.0** - UI 프레임워크
- **TypeScript 5.8.3** - 타입 안전성
- **Vite 7.0.4** - 빌드 도구
- **FullCalendar 6.1.20** - 캘린더 라이브러리
  - @fullcalendar/core
  - @fullcalendar/daygrid
  - @fullcalendar/timegrid
  - @fullcalendar/interaction
  - @fullcalendar/react

### 백엔드/데스크톱
- **Tauri v2** - 데스크톱 앱 프레임워크
- **Rust (MSVC)** - 네이티브 코드
- **tauri-plugin-autostart** - 시작 프로그램 등록
- **tauri-plugin-single-instance** - 단일 인스턴스 실행

---

## 📁 프로젝트 구조

```
CalendarWindowApp/
├── CWA/                          # 메인 프론트엔드 프로젝트
│   ├── src/
│   │   ├── App.tsx               # 메인 앱 컴포넌트 (CalendarPage 재export)
│   │   ├── main.tsx              # 엔트리 포인트
│   │   ├── index.css             # 글로벌 스타일
│   │   ├── App.css               # 앱 스타일 (28KB+)
│   │   ├── components/           # React 컴포넌트
│   │   │   ├── TitleBar.tsx      # 커스텀 타이틀바
│   │   │   ├── CalendarView.tsx  # 캘린더 뷰 (FullCalendar)
│   │   │   ├── TodoPanel.tsx     # 할 일 패널
│   │   │   ├── SettingsDrawer.tsx # 설정 드로어
│   │   │   ├── AddEventModal.tsx # 일정 추가 모달
│   │   │   ├── EditTodoModal.tsx # 할 일 수정 모달
│   │   │   └── index.ts          # 컴포넌트 export
│   │   ├── pages/
│   │   │   └── CalendarPage.tsx  # 메인 페이지 (13KB+)
│   │   ├── hooks/                # 커스텀 훅
│   │   │   ├── useTodos.ts      # 할 일 관리
│   │   │   ├── useSettings.ts   # 설정 관리
│   │   │   ├── useHolidays.ts   # 공휴일 데이터
│   │   │   ├── useSystemFonts.ts # 시스템 폰트
│   │   │   └── index.ts
│   │   ├── utils/                # 유틸리티 함수
│   │   │   ├── dateUtils.ts     # 날짜 관련 유틸
│   │   │   ├── apiUtils.ts      # API 호출 유틸
│   │   │   ├── todoUtils.ts     # 할 일 관련 유틸
│   │   │   └── index.ts
│   │   ├── types/                # TypeScript 타입 정의
│   │   │   └── index.ts
│   │   ├── constants/            # 상수 정의
│   │   │   └── index.ts
│   │   └── assets/               # 정적 에셋
│   ├── public/                   # 공개 에셋
│   │   ├── calendar-icon.svg
│   │   ├── tauri.svg
│   │   └── vite.svg
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── CWA/src-tauri/                # Tauri/Rust 백엔드
│   ├── src/
│   │   ├── main.rs              # Rust 엔트리 포인트
│   │   └── lib.rs               # Rust 라이브러리 (6.6KB+)
│   ├── Cargo.toml               # Rust 의존성
│   ├── Cargo.lock
│   ├── tauri.conf.json          # Tauri 설정
│   ├── capabilities/
│   │   └── default.json         # Tauri capabilities
│   └── icons/                   # 앱 아이콘
└── README.md
```

---

## ✨ 주요 기능

### 1. 데스크톱 위젯 모드
- **Always-on-bottom**: 항상 맨 뒤에 위치
- **작업표시줄 숨김**: 작업표시줄에 나타나지 않음
- **Alt-Tab 숨김**: Alt-Tab 목록에서 제외
- **커스텀 타이틀바**: 기본 타이틀바 제거, 드래그 가능한 커스텀 바
- **트레이 숨김**: X 버튼 클릭 시 시스템 트레이로 숨김
- **단일 인스턴스**: 중복 실행 방지

### 2. 캘린더 기능
- **월간 보기**: 항상 6주 고정 옵션
- **주간 보기**: 09:00 ~ 23:00 시간대 표시
- **오늘 날짜 표시**: 중앙 배지
- **Today 하이라이트 4가지 모드**:
  - 강조 배경 (highlight)
  - 글로우 효과 (glow)
  - 입체 카드 (elevated)
  - 컬러 테두리 (border)
- **토요일/일요일 색상 구분**
- **대한민국 공휴일 자동 표시** (2024~2026)

### 3. ToDo & 일정 관리
- **날짜별 ToDo 관리**
- **시간 입력 지원** (🕐 표시)
- **드래그로 순서 변경**
- **반복 일정 지원**: 매일 / 매주 / 매월
- **반복 종료일 설정**
- **주간 뷰에서 시간 드래그 → 일정 생성**

### 4. 설정 패널
- **우측 슬라이드 드로어 UI**
- **색상 테마 5종**: 핑크 / 라벤더 / 하늘 / 민트 / 황금빛
- **투명도 조절**: 5% ~ 85%
- **글꼴 변경**: 시스템 폰트 자동 로드
- **날짜 숫자 위치 변경**: 좌/우
- **인접 월 날짜 표시 ON/OFF**
- **시작 프로그램 토글**

### 5. 데이터 영속성
- **localStorage 기반 저장**
  - `cwa-todos-v4`: 할 일 데이터
  - `cwa-settings-v4`: 설정 데이터
  - `cwa-win-pos`: 창 위치
- **앱 재실행 시 모든 데이터 자동 복원**

---

## 📊 데이터 구조 (TypeScript 타입)

### 핵심 타입

```typescript
// 반복 타입
type RepeatType = "none" | "daily" | "weekly" | "monthly";

// 색상 테마
type ColorTheme = "pink" | "lavender" | "sky" | "mint" | "warm";

// 날짜 숫자 위치
type DayNumPos = "left" | "right";

// Today 스타일
type TodayStyle = "highlight" | "glow" | "elevated" | "border";

// 할 일 인터페이스
interface Todo {
  id: string;
  date: string;
  startDate?: string;
  endDate?: string;
  title: string;
  done: boolean;
  color: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  todoTime?: string;
  repeat: RepeatType;
  repeatEndDate?: string;
  sortOrder: number;
}

// 설정 인터페이스
interface Settings {
  colorTheme: ColorTheme;
  dayNumberPos: DayNumPos;
  fontFamily: string;
  fontSize: number;
  showOverflow: boolean;
  todayStyle: TodayStyle;
  opacity: number;
  todoPanelWidth: number;
  autostart: boolean;
  useLunar: boolean;
  use24Hour: boolean;
  showMoonPhase: boolean;
  alwaysOnTop: boolean;
  showOnTaskbar: boolean;
  editMode: boolean;
}

// 모달 상태
interface ModalState {
  open: boolean;
  date: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
}

// 테마
interface Theme {
  accent: string;
  mid: string;
  border: string;
  text: string;
}
```

---

## 🎨 상수 정의

### 색상 테마
```typescript
const THEMES: Record<ColorTheme, Theme> = {
  pink:     { accent:"#ec4899", mid:"#f9a8d4", border:"rgba(255,200,220,.38)", text:"#2d1520" },
  lavender: { accent:"#8b5cf6", mid:"#c4b5fd", border:"rgba(196,181,253,.38)", text:"#1e1030" },
  sky:      { accent:"#0ea5e9", mid:"#7dd3fc", border:"rgba(125,211,252,.38)", text:"#0c2d3e" },
  mint:     { accent:"#10b981", mid:"#6ee7b7", border:"rgba(110,231,183,.38)", text:"#0d2a1e" },
  warm:     { accent:"#f59e0b", mid:"#fcd34d", border:"rgba(252,211,77,.38)",  text:"#2a1a05" },
};
```

### 할 일 색상
```typescript
const TODO_COLORS = [
  "#f9a8d4","#a5f3fc","#bbf7d0","#fde68a",
  "#c4b5fd","#fb923c","#6ee7b7","#fca5a5",
];
```

### 로컬 스토리지 키
```typescript
const TODOS_KEY = "cwa-todos-v4";
const SETTINGS_KEY = "cwa-settings-v4";
const WIN_POS_KEY = "cwa-win-pos";
```

### 기본 설정
```typescript
const DEFAULT_SETTINGS: Settings = {
  colorTheme:"pink", 
  dayNumberPos:"left", 
  fontFamily:"Noto Sans KR",
  fontSize:14,
  showOverflow:true, 
  todayStyle:"highlight", 
  opacity:0.22, 
  todoPanelWidth:270, 
  autostart:false, 
  useLunar:false, 
  use24Hour:true,
  showMoonPhase:true,
  alwaysOnTop:false,
  showOnTaskbar:false,
  editMode:false,
};
```

---

## 🔧 커스텀 훅

### useTodos
- 할 일 CRUD 작업
- 로컬 스토리지 연동
- 반복 일정 처리

### useSettings
- 설정 관리
- 테마 변경
- 폰트 설정

### useHolidays
- 대한민국 공휴일 데이터 로드
- API 호출 및 캐싱

### useSystemFonts
- 시스템 폰트 자동 감지
- 폰트 목록 제공

---

## 🧩 주요 컴포넌트

### TitleBar
- 커스텀 타이틀바
- 드래그 이동 기능
- 창 제어 버튼 (최소화, 최대화, 닫기)

### CalendarView
- FullCalendar 라이브러리 래핑
- 월간/주간 뷰 전환
- 이벤트 표시 및 상호작용

### TodoPanel
- 할 일 목록 표시
- 드래그 앤 드롭 정렬
- 할 일 완료 토글

### SettingsDrawer
- 우측 슬라이드 드로어
- 테마 선택
- 투명도 조절
- 폰트 설정
- 기타 옵션

### AddEventModal
- 새 일정 추가 모달
- 시간 선택
- 반복 설정

### EditTodoModal
- 할 일 수정 모달
- 시간 변경
- 반복 종료일 설정

---

## 🚀 빌드 및 실행

### 개발 모드
```bash
cd CWA
npm install
npm run tauri dev
```

### 프로덕션 빌드
```bash
cd CWA
npm run tauri build
```

### 빌드 출력
- Windows: `CWA/src-tauri/target/release/bundle/msi/`
- 실행 파일: `CWA/src-tauri/target/release/cwa.exe`

---

## ⚠️ 주의사항

### 1. Tauri v2 사용
- 이 프로젝트는 **Tauri v2**를 사용합니다 (v1 아님)
- Tauri v2의 API와 플러그인 시스템을 따라야 합니다
- `@tauri-apps/api` 버전 2 사용

### 2. Windows 전용
- 현재 Windows 환경에 최적화되어 있음
- Always-on-bottom, 트레이 숨김 등 Windows 특정 기능 포함
- 크로스 플랫폼 지원 시 추가 작업 필요

### 3. 로컬 스토리지 의존성
- 모든 데이터가 localStorage에 저장됨
- 브라우저 캐시 삭제 시 데이터 손실 가능
- 백업/복원 기능 필요 시 구현 필요

### 4. 공휴일 API
- 대한민국 공휴일 데이터는 외부 API에서 로드
- API 호출 실패 시 폴백 처리 필요
- 연도별 공휴일 데이터 업데이트 필요

### 5. 폰트 처리
- 시스템 폰트를 자동으로 로드
- 웹 폰트 (Noto Sans KR 등) 포함
- 폰트 로딩 실패 시 폴백 폰트 사용

---

## 💻 코드 스타일 및 컨벤션

### 파일 구조
- 각 파일 상단에 `// ═══════════════════════════════════════════════════════════` 구분선 사용
- 기능별로 파일 분리 (hooks, utils, components)
- index.ts 파일로 export 관리

### 네이밍 컨벤션
- 컴포넌트: PascalCase (예: `CalendarView`, `TodoPanel`)
- 훅: camelCase + `use` 접두사 (예: `useTodos`, `useSettings`)
- 유틸리티: camelCase (예: `getLocalToday`, `formatDate`)
- 상수: UPPER_SNAKE_CASE (예: `TODO_COLORS`, `DEFAULT_SETTINGS`)
- 타입: PascalCase (예: `Todo`, `Settings`, `ColorTheme`)

### 스타일
- CSS-in-JS 대신 별도 CSS 파일 사용
- App.css에 글로벌 스타일集中
- 테마 색상은 상수로 관리

### 상태 관리
- React hooks 기반
- localStorage와 동기화
- 커스텀 훅으로 로직 캡슐화

---

## 🔍 디버깅 팁

### 1. Tauri 개발자 도구
- `npm run tauri dev` 실행 시 개발자 도구 자동 열림
- 콘솔에서 디버깅 가능

### 2. 로컬 스토리지 확인
- 브라우저 개발자 도구 → Application → Local Storage
- `cwa-todos-v4`, `cwa-settings-v4` 키 확인

### 3. Rust 로그
- `src-tauri/src/lib.rs`에서 `println!` 또는 `log` 매크로 사용
- 터미널에서 로그 확인 가능

---

## 📝 자주 사용되는 작업

### 1. 새 기능 추가
1. `src/types/index.ts`에 타입 추가
2. `src/constants/index.ts`에 상수 추가 (필요 시)
3. `src/hooks/`에 커스텀 훅 생성 (필요 시)
4. `src/components/`에 컴포넌트 생성
5. `src/pages/CalendarPage.tsx`에 통합

### 2. 설정 추가
1. `src/types/index.ts`의 `Settings` 인터페이스에 필드 추가
2. `src/constants/index.ts`의 `DEFAULT_SETTINGS`에 기본값 추가
3. `src/hooks/useSettings.ts`에 로직 추가
4. `src/components/SettingsDrawer.tsx`에 UI 추가

### 3. 테마 변경
1. `src/constants/index.ts`의 `THEMES` 객체 수정
2. `src/App.css`에서 테마 관련 스타일 수정

### 4. Tauri 명령어 추가
1. `src-tauri/src/lib.rs`에 Rust 함수 작성
2. `#[tauri::command]` 어노테이션 추가
3. 프론트엔드에서 `invoke()`로 호출

---

## 🎯 프로젝트 특징 요약

| 항목 | 설명 |
|------|------|
| **플랫폼** | Windows 데스크톱 |
| **프레임워크** | Tauri v2 + React 19 |
| **언어** | TypeScript + Rust |
| **빌드 도구** | Vite 7 |
| **캘린더** | FullCalendar 6 |
| **상태 관리** | React Hooks + localStorage |
| **스타일** | CSS (App.css) |
| **데이터 저장** | localStorage |
| **주요 기능** | 캘린더, 할 일 관리, 위젯 모드, 커스텀 테마 |

---

## 📚 참고 자료

- [Tauri v2 공식 문서](https://v2.tauri.app/)
- [React 공식 문서](https://react.dev/)
- [FullCalendar 문서](https://fullcalendar.io/)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)

---

**이 프롬프트는 Calendar Window App 프로젝트의 전체적인 구조와 맥락을 제공하여, 다른 생성형 AI가 프로젝트를 이해하고 효과적으로 작업할 수 있도록 설계되었습니다.**
