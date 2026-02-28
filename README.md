# 🌸 Calendar

> Windows Desktop Widget Calendar built with **Tauri v2 + React + TypeScript**

Calendar는 Windows 환경에서 동작하는 **네이티브 데스크톱 캘린더 위젯 앱**입니다.  
작업표시줄과 Alt-Tab 목록에 나타나지 않으며, 데스크탑 위젯처럼 항상 맨 뒤에 위치해 일정과 할 일을 관리할 수 있습니다.

---

## ✨ 주요 특징

### 🪟 데스크톱 위젯 모드
- 항상 맨 뒤(Always-on-bottom) 유지
- 작업표시줄 및 Alt-Tab 목록 숨김
- 타이틀바 제거 (커스텀 드래그 바)
- X 버튼 → 트레이 숨김
- 트레이 메뉴에서만 완전 종료 가능
- 단일 인스턴스 (중복 실행 방지)

---

### 📅 캘린더 기능
- 월간 보기 (항상 6주 고정 옵션)
- 주간 보기 (09:00 ~ 23:00 시간대)
- 오늘 날짜 중앙 배지 표시
- Today 하이라이트 4가지 모드:
  - 강조 배경
  - 글로우 효과
  - 입체 카드
  - 컬러 테두리
- 토요일 / 일요일 색상 구분
- 대한민국 공휴일 (2024~2026) 🎌 자동 표시

---

### 📝 ToDo & 일정 관리
- 날짜별 ToDo 관리
- 시간 입력 지원 (🕐 표시)
- 드래그로 순서 변경
- 반복 일정 지원 (매일 / 매주 / 매월)
- 반복 종료일 설정 가능
- 주간 뷰에서 시간 드래그 → 일정 생성 모달

---

### ⚙ 설정 패널
- 우측 슬라이드 드로어 UI
- 색상 테마 5종
  - 핑크 / 라벤더 / 하늘 / 민트 / 황금빛
- 투명도 조절 (5% ~ 85%)
- 글꼴 변경 (시스템 폰트 자동 로드)
- 날짜 숫자 위치 변경
- 인접 월 날짜 표시 ON/OFF
- 시작 프로그램 토글

---

### 💾 데이터 영속성
- localStorage 기반 저장
  - `cwa-todos-v3`
  - `cwa-settings-v3`
- 앱 재실행 시 모든 데이터 자동 복원
- 창 위치 자동 저장 및 복원

---

## 🛠 기술 스택

- **Tauri v2**
- **Rust (MSVC)**
- **React + TypeScript**
- **FullCalendar**
- **tauri-plugin-autostart**
- **tauri-plugin-single-instance**

---

## 📦 빌드

```bash
npm run tauri build
