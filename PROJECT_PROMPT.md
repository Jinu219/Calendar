# Calendar Window App 유지보수 맥락

## 제품

CWA는 Windows 전용 데스크톱 캘린더 위젯이다. 메인 창은 닫을 때 종료하지 않고 트레이로 숨기지만, 동적으로 생성한 메모창은 닫을 때 반드시 파괴되어 창 라벨을 반환해야 한다.

## 기술 구성

- Tauri v2 + Rust: 트레이, 단일 인스턴스, 시작 프로그램, 창 레벨과 작업표시줄 동작
- React 19 + TypeScript + Vite: 전체 UI와 로컬 상태
- FullCalendar 6: 월간·주간 보기와 일정 드래그/크기 변경
- localStorage: 일정, 설정, 메모, 창 위치

## 코드 책임

- `CWA/src/pages/CalendarPage.tsx`: 메인 기능 조합만 담당한다.
- `CWA/src/components`: 표현과 사용자 입력을 담당한다.
- `CWA/src/hooks`: 저장 상태 및 Tauri 창과 연결되는 부수 효과를 담당한다.
- `CWA/src/utils`: React와 무관한 날짜·일정·공휴일 로직을 담당한다.
- `CWA/src-tauri/src/lib.rs`: Windows 네이티브 창 정책과 트레이를 담당한다.

## 유지해야 할 불변 조건

1. 일정의 `date`와 `startDate`를 이동할 때 다일 일정의 기간을 보존한다.
2. FullCalendar의 종일 종료일은 exclusive이므로 저장 시 마지막 포함 날짜로 변환한다.
3. 메모창 간 데이터는 `storage` 이벤트로 동기화한다.
4. 메인 창에만 `CloseRequested` 숨김 정책을 적용한다.
5. Tauri capability에는 실제 프런트엔드에서 사용하는 창 권한만 둔다.
6. 저장 데이터를 읽을 때 이전 버전이나 손상된 JSON을 기본값으로 정규화한다.

## 검증 기준

변경 후 `CWA`에서 `npm run check`를 실행한다. 창 동작 변경은 가능하면 `npm run tauri dev`에서 다음을 수동 확인한다.

- 메인 창 닫기 → 트레이로 숨김
- 메모창 닫기 → 실제 파괴 후 같은 슬롯 재사용
- 일정 이동·크기 변경 → 날짜와 기간 보존
- 메모 입력 → 다른 메모창에 동기화
- 트레이와 설정 화면의 시작 프로그램 상태 일치
