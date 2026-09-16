# Calendar Window App 유지보수 맥락

## 제품

Calendar는 Windows 전용 데스크톱 캘린더 위젯이다. 메인 창은 닫을 때 종료하지 않고 트레이로 숨기지만, 동적으로 생성한 메모창은 닫을 때 반드시 파괴되어 창 라벨을 반환해야 한다.

## 기술 구성

- Tauri v2 + Rust: 트레이, 단일 인스턴스, 시작 프로그램, 창 레벨과 작업표시줄 동작
- React 19 + TypeScript + Vite: 전체 UI와 로컬 상태
- FullCalendar 6: 월간·주간 보기와 일정 드래그/크기 변경
- localStorage: 일정, 설정, 메모, 창 위치

## 코드 책임

- `Calendar/src/pages/CalendarPage.tsx`: 메인 기능 조합만 담당한다.
- `Calendar/src/components`: 표현과 사용자 입력을 담당한다.
- `Calendar/src/hooks`: 저장 상태 및 Tauri 창과 연결되는 부수 효과를 담당한다.
- `Calendar/src/utils`: React와 무관한 날짜·일정·공휴일 로직을 담당한다.
- `Calendar/src-tauri/src/lib.rs`: Windows 네이티브 창 정책과 트레이를 담당한다.

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

## 검증 기준

변경 후 `Calendar`에서 `npm run check`를 실행한다. 창 동작 변경은 가능하면 `npm run tauri dev`에서 다음을 수동 확인한다.

- 메인 창 닫기 → 트레이로 숨김
- 메모창 닫기 → 실제 파괴 후 같은 슬롯 재사용
- 일정 이동·크기 변경 → 날짜와 기간 보존
- 메모 입력 → 다른 메모창에 동기화
- 트레이와 설정 화면의 시작 프로그램 상태 일치
- 반복 일정에서 "이 일정만" 수정/삭제 → 다른 발생은 그대로 유지
- 일정 삭제/이동 후 Ctrl+Z → 원상 복구, 다시 Ctrl+Y → 재적용
- 설정 → 데이터 백업 내보내기/가져오기 → 일정·메모·설정 복원
