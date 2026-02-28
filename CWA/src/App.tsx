import {
  useState, useEffect, useRef, useCallback, useMemo,
  DragEvent,
} from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { EventInput, DateSelectArg } from "@fullcalendar/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════
type RepeatType = "none" | "daily" | "weekly" | "monthly";
type ColorTheme = "pink" | "lavender" | "sky" | "mint" | "warm";
type DayNumPos  = "left" | "center" | "right";
type TodayStyle = "highlight" | "glow" | "elevated" | "border";

interface Todo {
  id: string;
  date: string;
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

interface Settings {
  colorTheme:     ColorTheme;
  dayNumberPos:   DayNumPos;
  fontFamily:     string;
  showOverflow:   boolean;
  todayStyle:     TodayStyle;
  opacity:        number;
  eventColor:     string;
  todoPanelWidth: number;
  autostart:      boolean;
}

interface ModalState {
  open: boolean;
  date: string;
  startTime: string;
  endTime:   string;
  allDay:    boolean;
}

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════
const TODO_COLORS = [
  "#f9a8d4","#a5f3fc","#bbf7d0","#fde68a",
  "#c4b5fd","#fb923c","#6ee7b7","#fca5a5",
];

const THEMES: Record<ColorTheme,{accent:string;mid:string;border:string;text:string}> = {
  pink:     { accent:"#ec4899", mid:"#f9a8d4", border:"rgba(255,200,220,.38)", text:"#2d1520" },
  lavender: { accent:"#8b5cf6", mid:"#c4b5fd", border:"rgba(196,181,253,.38)", text:"#1e1030" },
  sky:      { accent:"#0ea5e9", mid:"#7dd3fc", border:"rgba(125,211,252,.38)", text:"#0c2d3e" },
  mint:     { accent:"#10b981", mid:"#6ee7b7", border:"rgba(110,231,183,.38)", text:"#0d2a1e" },
  warm:     { accent:"#f59e0b", mid:"#fcd34d", border:"rgba(252,211,77,.38)",  text:"#2a1a05" },
};
const THEME_OPTIONS = [
  { key:"pink"     as ColorTheme, label:"벚꽃", emoji:"🌸" },
  { key:"lavender" as ColorTheme, label:"라벤더", emoji:"💜" },
  { key:"sky"      as ColorTheme, label:"하늘", emoji:"🩵" },
  { key:"mint"     as ColorTheme, label:"민트", emoji:"🌿" },
  { key:"warm"     as ColorTheme, label:"황금", emoji:"✨" },
];
const TODAY_STYLES: {key:TodayStyle;label:string}[] = [
  { key:"highlight", label:"배경 강조" },
  { key:"glow",      label:"글로우"   },
  { key:"elevated",  label:"입체 카드" },
  { key:"border",    label:"테두리"   },
];

const FALLBACK_FONTS = [
  "Noto Sans KR","맑은 고딕","나눔고딕","굴림","돋움",
  "Arial","Georgia","Courier New","Times New Roman",
];

const TODOS_KEY    = "cwa-todos-v4";
const SETTINGS_KEY = "cwa-settings-v4";
const WIN_POS_KEY  = "cwa-win-pos";

const DEFAULT_SETTINGS: Settings = {
  colorTheme:"pink", dayNumberPos:"left", fontFamily:"Noto Sans KR",
  showOverflow:true, todayStyle:"highlight", opacity:0.22,
  eventColor:TODO_COLORS[0], todoPanelWidth:270, autostart:false,
};

// ── Korean public holidays 2024-2026 ──
const KR_HOLIDAYS: Record<string,string> = {
  // 2024
  "2024-01-01":"신정","2024-02-09":"설날전날","2024-02-10":"설날","2024-02-11":"설날다음날",
  "2024-03-01":"삼일절","2024-04-10":"국회의원선거","2024-05-05":"어린이날","2024-05-06":"대체공휴일",
  "2024-05-15":"부처님오신날","2024-06-06":"현충일","2024-08-15":"광복절",
  "2024-09-16":"추석전날","2024-09-17":"추석","2024-09-18":"추석다음날",
  "2024-10-03":"개천절","2024-10-09":"한글날","2024-12-25":"크리스마스",
  // 2025
  "2025-01-01":"신정","2025-01-28":"설날전날","2025-01-29":"설날","2025-01-30":"설날다음날",
  "2025-03-01":"삼일절","2025-05-05":"어린이날","2025-05-06":"대체공휴일",
  "2025-05-15":"부처님오신날","2025-06-06":"현충일","2025-08-15":"광복절",
  "2025-10-05":"추석전날","2025-10-06":"추석","2025-10-07":"추석다음날",
  "2025-10-03":"개천절","2025-10-09":"한글날","2025-12-25":"크리스마스",
  // 2026
  "2026-01-01":"신정","2026-02-16":"설날전날","2026-02-17":"설날","2026-02-18":"설날다음날",
  "2026-03-01":"삼일절","2026-05-05":"어린이날","2026-05-24":"부처님오신날",
  "2026-06-06":"현충일","2026-08-15":"광복절",
  "2026-09-24":"추석전날","2026-09-25":"추석","2026-09-26":"추석다음날",
  "2026-10-03":"개천절","2026-10-09":"한글날","2026-12-25":"크리스마스",
};

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

/** Timezone-safe today string */
const localToday = (): string => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth()+1).padStart(2,"0"),
    String(d.getDate()).padStart(2,"0"),
  ].join("-");
};

const loadJson = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
};

const addDays   = (d:Date,n:number) => { const r=new Date(d); r.setDate(r.getDate()+n);   return r; };
const addMonths = (d:Date,n:number) => { const r=new Date(d); r.setMonth(r.getMonth()+n); return r; };
const fmtDate   = (d:Date) => [
  d.getFullYear(),
  String(d.getMonth()+1).padStart(2,"0"),
  String(d.getDate()).padStart(2,"0"),
].join("-");

const MODAL_CLOSED: ModalState = {
  open:false, date:localToday(), startTime:"09:00", endTime:"10:00", allDay:false,
};

// ─── Expand recurring todos ───────────────────────────────
function expandTodos(todos: Todo[]): EventInput[] {
  const events: EventInput[] = [];
  const now   = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth()-3, 1);
  const rangeEnd   = new Date(now.getFullYear(), now.getMonth()+6, 0);

  for (const t of todos) {
    const base = new Date(t.date + "T00:00:00");
    const cap  = t.repeatEndDate
      ? new Date(Math.min(new Date(t.repeatEndDate+"T00:00:00").getTime(), rangeEnd.getTime()))
      : rangeEnd;

    const push = (d: Date) => events.push({
      id:              `${t.id}__${fmtDate(d)}`,
      title:           t.done ? `✅ ${t.title}` : `🟦 ${t.title}`,
      ...(t.allDay
        ? { date: fmtDate(d), allDay: true }
        : { start:`${fmtDate(d)}T${t.startTime}`, end:t.endTime?`${fmtDate(d)}T${t.endTime}`:undefined, allDay:false }),
      backgroundColor: t.color,
      borderColor:     "transparent",
      textColor:       "#1a1a2e",
      extendedProps:   { todoId: t.id },
    });

    if (t.repeat === "none") { push(base); continue; }
    let cur = new Date(base);
    let safety = 0;
    while (cur <= cap && safety++ < 5000) {
      if (cur >= rangeStart) push(cur);
      if      (t.repeat==="daily")   cur = addDays(cur,1);
      else if (t.repeat==="weekly")  cur = addDays(cur,7);
      else if (t.repeat==="monthly") cur = addMonths(cur,1);
    }
  }

  // Add holidays as background events
  const [y1,y2] = [now.getFullYear()-1, now.getFullYear()+2];
  for (const [date, name] of Object.entries(KR_HOLIDAYS)) {
    const yr = parseInt(date.slice(0,4));
    if (yr >= y1 && yr <= y2) {
      events.push({
        id: `holiday-${date}`, title: `🎌 ${name}`,
        date, allDay: true,
        backgroundColor:"rgba(239,68,68,0.18)",
        borderColor:"transparent", textColor:"#dc2626",
        classNames:["holiday-event"],
        display: "block",
      });
    }
  }
  return events;
}

// ═══════════════════════════════════════════════════════════
// App
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [view, setView]   = useState<"dayGridMonth"|"timeGridWeek">("dayGridMonth");
  const [todos, setTodos] = useState<Todo[]>(() => loadJson(TODOS_KEY, []));
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    ...loadJson<Partial<Settings>>(SETTINGS_KEY, {}),
  }));
  const [selectedDate, setSelectedDate] = useState(localToday);
  const [inputVal, setInputVal]   = useState("");
  const [inputTime, setInputTime] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editMode, setEditMode]   = useState(false);
  const [modal, setModal]         = useState<ModalState>(MODAL_CLOSED);
  const [modalTitle, setModalTitle] = useState("");
  const [modalColor, setModalColor] = useState(TODO_COLORS[0]);
  const [modalRepeat, setModalRepeat] = useState<RepeatType>("none");
  const [modalRepeatEnd, setModalRepeatEnd] = useState("");
  const [systemFonts, setSystemFonts] = useState<string[]>(FALLBACK_FONTS);
  const [fontSearch, setFontSearch] = useState("");
  const [dragId, setDragId] = useState<string|null>(null);
  const [dragOver, setDragOver] = useState<string|null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);
  const appWin      = useRef(getCurrentWindow());

  // ── Load system fonts ──
  useEffect(() => {
    (async () => {
      try {
        if ("queryLocalFonts" in window) {
          const fonts = await (window as any).queryLocalFonts();
          const names: string[] = [...new Set<string>(
            fonts.map((f: any) => f.family as string)
          )].sort();
          setSystemFonts(names);
        }
      } catch { /* fallback already set */ }
    })();
  }, []);

  // ── Restore window position ──
  useEffect(() => {
    const saved = loadJson<{x:number;y:number}|null>(WIN_POS_KEY, null);
    if (saved) {
      appWin.current.setPosition(new PhysicalPosition(saved.x, saved.y));
    }
  }, []);

  // ── Save window position on move ──
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const unlisten = appWin.current.onMoved(({ payload }) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.setItem(WIN_POS_KEY, JSON.stringify({ x: payload.x, y: payload.y }));
      }, 500);
    });
    return () => { unlisten.then(fn => fn()); clearTimeout(timer); };
  }, []);

  // ── Persist todos & settings ──
  useEffect(() => { localStorage.setItem(TODOS_KEY,    JSON.stringify(todos));    }, [todos]);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);

  // ── Apply theme ──
  useEffect(() => {
    const t = THEMES[settings.colorTheme];
    const s = document.documentElement.style;
    s.setProperty("--accent",       t.accent);
    s.setProperty("--mid",          t.mid);
    s.setProperty("--glass-border", t.border);
    s.setProperty("--text-primary", t.text);
    s.setProperty("--glass-bg",     `rgba(255,245,248,${settings.opacity})`);
  }, [settings.colorTheme, settings.opacity]);

  // ── Apply font ──
  useEffect(() => {
    document.documentElement.style.setProperty("--font", `'${settings.fontFamily}', sans-serif`);
    // Try to load from Google Fonts if it's a known web font
    const webFonts = ["Noto Sans KR","Gothic A1","Nanum Gothic","IBM Plex Sans KR","Hahmlet","Gowun Dodum"];
    if (webFonts.includes(settings.fontFamily)) {
      const id = `gf-${settings.fontFamily.replace(/\s/g,"")}`;
      if (!document.getElementById(id)) {
        const l = document.createElement("link");
        l.id=id; l.rel="stylesheet";
        l.href=`https://fonts.googleapis.com/css2?family=${encodeURIComponent(settings.fontFamily)}:wght@300;400;500;700&display=swap`;
        document.head.appendChild(l);
      }
    }
  }, [settings.fontFamily]);

  // ── Apply day-num position ──
  useEffect(() => {
    const m: Record<DayNumPos,string> = { left:"flex-start", center:"center", right:"flex-end" };
    document.documentElement.style.setProperty("--day-num-justify", m[settings.dayNumberPos]);
  }, [settings.dayNumberPos]);

  // ── Sync view ──
  useEffect(() => { calendarRef.current?.getApi().changeView(view); }, [view]);

  // ── Today label ──
  const todayLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("ko-KR", { year:"numeric", month:"long", day:"numeric", weekday:"long" });
  }, []);

  const setSetting = <K extends keyof Settings>(k:K, v:Settings[K]) =>
    setSettings(p => ({ ...p, [k]:v }));

  // ── Autostart toggle (synced with Tauri backend) ──
  const toggleAutostart = async () => {
    try {
      const next = !settings.autostart;
      const result: boolean = await invoke(next ? "plugin:autostart|enable" : "plugin:autostart|disable");
      setSetting("autostart", result ?? next);
    } catch {
      // Fallback: just toggle locally
      setSetting("autostart", !settings.autostart);
    }
  };

  // ── Calendar events ──
  const calendarEvents = useMemo(() => expandTodos(todos), [todos]);

  // ── Add quick todo ──
  const addQuickTodo = useCallback(() => {
    const t = inputVal.trim();
    if (!t) return;
    const maxOrder = todos.filter(x => x.date===selectedDate).reduce((m,x) => Math.max(m,x.sortOrder), -1);
    setTodos(p => [...p, {
      id: crypto.randomUUID(), date: selectedDate, title: t, done: false,
      color: settings.eventColor, allDay: true,
      todoTime: inputTime || undefined,
      repeat:"none", sortOrder: maxOrder+1,
    }]);
    setInputVal(""); setInputTime("");
  }, [inputVal, inputTime, selectedDate, settings.eventColor, todos]);

  // ── Add modal todo ──
  const commitModal = () => {
    const t = modalTitle.trim();
    if (!t) { closeModal(); return; }
    const maxOrder = todos.filter(x => x.date===modal.date).reduce((m,x) => Math.max(m,x.sortOrder), -1);
    setTodos(p => [...p, {
      id: crypto.randomUUID(), date: modal.date, title: t, done:false,
      color: modalColor, allDay: modal.allDay,
      startTime: modal.allDay ? undefined : modal.startTime,
      endTime:   modal.allDay ? undefined : modal.endTime,
      repeat: modalRepeat, repeatEndDate: modalRepeatEnd || undefined,
      sortOrder: maxOrder+1,
    }]);
    closeModal();
  };

  const closeModal = () => {
    setModal(MODAL_CLOSED);
    setModalTitle(""); setModalRepeat("none"); setModalRepeatEnd("");
  };

  const toggleDone = (id:string) => setTodos(p => p.map(t => t.id===id ? { ...t, done:!t.done } : t));
  const deleteTodo = (id:string) => setTodos(p => p.filter(t => t.id!==id));

  // ── Date click ──
  const handleDateClick = (info: DateClickArg) => {
    const d = info.dateStr.slice(0,10);
    setSelectedDate(d);
    if (info.view.type==="timeGridWeek" && !info.allDay) {
      const h  = String(info.date.getHours()).padStart(2,"0");
      const m  = String(info.date.getMinutes()).padStart(2,"0");
      const h2 = String((info.date.getHours()+1)%24).padStart(2,"0");
      setModal({ open:true, date:d, allDay:false, startTime:`${h}:${m}`, endTime:`${h2}:${m}` });
      setModalTitle(""); setModalColor(settings.eventColor); setModalRepeat("none");
    }
  };

  // ── Range select ──
  const handleSelect = (info: DateSelectArg) => {
    if (info.view.type !== "timeGridWeek") return;
    const d = info.startStr.slice(0,10);
    setSelectedDate(d);
    setModal({ open:true, date:d, allDay:false,
      startTime: info.startStr.slice(11,16), endTime: info.endStr.slice(11,16) });
    setModalTitle(""); setModalColor(settings.eventColor); setModalRepeat("none");
    calendarRef.current?.getApi().unselect();
  };

  // ── Panel resize ──
  const startResize = (e: React.MouseEvent) => {
    if (!editMode) return;
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startW = settings.todoPanelWidth;
    const onMove = (ev: MouseEvent) => setSetting("todoPanelWidth", Math.max(200, Math.min(480, startW+(startX-ev.clientX))));
    const onUp   = () => { setIsResizing(false); window.removeEventListener("mousemove",onMove); window.removeEventListener("mouseup",onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  };

  // ── ToDo drag & drop ──
  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    setDragOver(id);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOver(null); return; }
    setTodos(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(t => t.id === dragId);
      const toIdx   = arr.findIndex(t => t.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [item] = arr.splice(fromIdx, 1);
      // Move to target date if different
      item.date = arr[toIdx >= arr.length ? arr.length-1 : toIdx]?.date ?? item.date;
      arr.splice(toIdx, 0, item);
      // Re-assign sortOrder
      return arr.map((t,i) => ({ ...t, sortOrder:i }));
    });
    setDragId(null); setDragOver(null);
  };

  // ── Filtered & sorted todos ──
  const selectedTodos = useMemo(() =>
    todos.filter(t => t.date===selectedDate).sort((a,b) => a.sortOrder-b.sortOrder),
  [todos, selectedDate]);

  const fmtSelectedDate = new Date(selectedDate+"T00:00:00")
    .toLocaleDateString("ko-KR", { month:"long", day:"numeric", weekday:"short" });

  const filteredFonts = useMemo(() =>
    systemFonts.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase())),
  [systemFonts, fontSearch]);

  // ═══════════════════════════════════════════════════════════
  return (
    <div
      className={`app-root today-${settings.todayStyle}`}
      style={{ cursor: isResizing ? "ew-resize" : undefined }}
    >

      {/* ══════════════════════════════════
          Title Bar  (drag region, no X/–)
          ══════════════════════════════════ */}
      <div className="title-bar" data-tauri-drag-region>
        <div className="tb-left" data-tauri-drag-region>
          <span className="app-logo">🌸</span>
          <span className="app-title" data-tauri-drag-region>Calendar</span>
        </div>

        <div className="tb-today" data-tauri-drag-region>
          <span className="tb-today-text">{todayLabel}</span>
        </div>

        <div className="tb-right">
          <div className="view-switcher">
            <button className={`view-btn ${view==="dayGridMonth"?"active":""}`} onClick={()=>setView("dayGridMonth")}>월간</button>
            <button className={`view-btn ${view==="timeGridWeek"?"active":""}`} onClick={()=>setView("timeGridWeek")}>주간</button>
          </div>
          <div className="tb-sep" />
          <button className={`wc-btn gear-btn ${settingsOpen?"gear-on":""}`} title="설정" onClick={()=>setSettingsOpen(o=>!o)}>⚙</button>
        </div>
      </div>

      {/* ══════════════════════════════════
          Main Panel
          ══════════════════════════════════ */}
      <div className="glass-panel main-panel">
        <div className="app-body" style={{ userSelect: isResizing ? "none" : undefined }}>

          {/* Calendar */}
          <div className="calendar-wrap" style={{ position:"relative" }}>
            {editMode && <div className="edit-mode-badge">✏ 편집 모드 — 경계 드래그로 패널 너비 조절</div>}
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={view}
              locale="ko"
              height="100%"
              headerToolbar={{ left:"prev,next today", center:"title", right:"" }}
              slotMinTime="09:00:00"
              slotMaxTime="23:00:00"
              slotLabelFormat={{ hour:"2-digit", minute:"2-digit", hour12:false }}
              slotDuration="00:30:00"
              allDaySlot={true}
              nowIndicator={true}
              selectable={view==="timeGridWeek"}
              selectMirror={true}
              events={calendarEvents}
              showNonCurrentDates={true}
              fixedWeekCount={true}
              dateClick={handleDateClick}
              select={handleSelect}
              eventClick={info => {
                const tid = info.event.extendedProps?.todoId;
                if (tid) {
                  const d = info.event.startStr.slice(0,10);
                  setSelectedDate(d);
                  toggleDone(tid);
                }
              }}
              dayCellClassNames={arg => {
                const cls: string[] = [];
                if (arg.dateStr === selectedDate) cls.push("selected-day");
                const dow = arg.date.getDay();
                if (dow === 0) cls.push("sunday-cell");
                if (dow === 6) cls.push("saturday-cell");
                if (KR_HOLIDAYS[arg.dateStr]) cls.push("holiday-cell");
                return cls;
              }}
            />
          </div>

          {/* Resize Handle */}
          <div
            className={`resize-handle ${editMode?"active":""}`}
            onMouseDown={startResize}
          />

          {/* ToDo Panel */}
          <div className="todo-panel glass-panel" style={{ width: settings.todoPanelWidth }}>
            <div className="todo-header">
              <span className="todo-icon">🗓</span>
              <div>
                <div className="todo-date-label">{fmtSelectedDate}</div>
                <div className="todo-subtext">ToDoList</div>
              </div>
            </div>

            <div className="todo-quick-add">
              <div className="todo-input-row">
                <input className="todo-input" placeholder="할 일 입력…" value={inputVal}
                  onChange={e=>setInputVal(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addQuickTodo()} />
                <button className="add-btn" onClick={addQuickTodo}>+</button>
              </div>
              <input type="time" className="todo-input time-memo" value={inputTime}
                onChange={e=>setInputTime(e.target.value)} />
            </div>

            <div className="todo-list">
              {selectedTodos.length===0 && <div className="todo-empty">할 일이 없어요 🌸</div>}
              {selectedTodos.map(t => (
                <div
                  key={t.id}
                  className={`todo-item ${t.done?"done":""} ${dragOver===t.id?"drag-over":""}`}
                  style={{ borderLeft:`3px solid ${t.color}` }}
                  draggable
                  onDragStart={e=>handleDragStart(e,t.id)}
                  onDragOver={e=>handleDragOver(e,t.id)}
                  onDrop={e=>handleDrop(e,t.id)}
                  onDragEnd={()=>{ setDragId(null); setDragOver(null); }}
                >
                  <span className="drag-handle" title="드래그해서 순서 변경">⠿</span>
                  <button className="todo-check" onClick={()=>toggleDone(t.id)}>
                    {t.done?"✅":"🟦"}
                  </button>
                  <div className="todo-content">
                    <span className="todo-title">{t.title}</span>
                    {(t.todoTime || (!t.allDay && t.startTime)) && (
                      <span className="todo-time">
                        🕐 {t.todoTime || `${t.startTime}${t.endTime?` – ${t.endTime}`:""}`}
                      </span>
                    )}
                    {t.repeat!=="none" && (
                      <span className="todo-repeat">
                        🔁 {t.repeat==="daily"?"매일":t.repeat==="weekly"?"매주":"매월"}
                      </span>
                    )}
                  </div>
                  <button className="todo-delete" onClick={()=>deleteTodo(t.id)}>×</button>
                </div>
              ))}
            </div>

            {selectedTodos.length>0 && (
              <div className="todo-stats">
                완료 {selectedTodos.filter(t=>t.done).length} / {selectedTodos.length}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
          Settings Drawer
          ══════════════════════════════════ */}
      <div className={`settings-drawer glass-panel ${settingsOpen?"open":""}`}>
        <div className="settings-hdr">
          <span className="settings-title">⚙ 설정</span>
          <button className="settings-close" onClick={()=>setSettingsOpen(false)}>✕</button>
        </div>
        <div className="settings-body">

          {/* 색상 테마 */}
          <div className="sg">
            <div className="sg-label">🎨 색상 테마</div>
            <div className="theme-grid">
              {THEME_OPTIONS.map(o=>(
                <button key={o.key}
                  className={`theme-btn ${settings.colorTheme===o.key?"active":""}`}
                  style={{"--ba":THEMES[o.key].accent} as React.CSSProperties}
                  onClick={()=>setSetting("colorTheme",o.key)}>
                  <span className="theme-emoji">{o.emoji}</span>
                  <span className="theme-label">{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 기본 이벤트 색상 */}
          <div className="sg">
            <div className="sg-label">🎨 기본 이벤트 색상</div>
            <div className="color-row-setting">
              {TODO_COLORS.map(c=>(
                <button key={c}
                  className={`color-dot-setting ${settings.eventColor===c?"selected":""}`}
                  style={{ background:c }}
                  onClick={()=>setSetting("eventColor",c)}
                />
              ))}
            </div>
          </div>

          {/* 투명도 */}
          <div className="sg">
            <div className="sg-label">🔮 배경 투명도</div>
            <div className="slider-row">
              <span className="slider-hint">투명</span>
              <input type="range" min="0.05" max="0.85" step="0.01"
                value={settings.opacity} className="opacity-slider"
                onChange={e=>setSetting("opacity",parseFloat(e.target.value))} />
              <span className="slider-hint">불투명</span>
            </div>
            <div className="slider-val">{Math.round(settings.opacity*100)}%</div>
          </div>

          {/* 오늘 표시 */}
          <div className="sg">
            <div className="sg-label">📍 오늘 표시 스타일</div>
            <div className="seg-ctrl seg-2x2">
              {TODAY_STYLES.map(o=>(
                <button key={o.key}
                  className={`seg-btn ${settings.todayStyle===o.key?"active":""}`}
                  onClick={()=>setSetting("todayStyle",o.key)}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* 날짜 숫자 위치 */}
          <div className="sg">
            <div className="sg-label">📅 날짜 숫자 위치</div>
            <div className="seg-ctrl">
              {(["left","center","right"] as DayNumPos[]).map(p=>(
                <button key={p} className={`seg-btn ${settings.dayNumberPos===p?"active":""}`}
                  onClick={()=>setSetting("dayNumberPos",p)}>
                  {p==="left"?"왼쪽":p==="center"?"가운데":"오른쪽"}
                </button>
              ))}
            </div>
          </div>

          {/* 인접 월 날짜 표시 (fixedWeekCount 기반 – 항상 4주 이상) */}
          <div className="sg">
            <div className="sg-label">🗓 달력 주 표시</div>
            <div className="seg-ctrl">
              <button className={`seg-btn ${settings.showOverflow?"active":""}`}
                onClick={()=>setSetting("showOverflow",true)}>6주 고정</button>
              <button className={`seg-btn ${!settings.showOverflow?"active":""}`}
                onClick={()=>setSetting("showOverflow",false)}>자동</button>
            </div>
          </div>

          {/* 글꼴 선택 */}
          <div className="sg">
            <div className="sg-label">✏ 글꼴 (시스템 폰트 포함)</div>
            <input className="font-search" placeholder="폰트 검색…"
              value={fontSearch} onChange={e=>setFontSearch(e.target.value)} />
            <div className="font-list">
              {filteredFonts.slice(0,50).map(f=>(
                <button key={f} className={`font-btn ${settings.fontFamily===f?"active":""}`}
                  style={{ fontFamily:`'${f}', sans-serif` }}
                  onClick={()=>setSetting("fontFamily",f)}>{f}</button>
              ))}
              {filteredFonts.length>50 && (
                <div className="font-more">…외 {filteredFonts.length-50}개 (검색으로 좁히기)</div>
              )}
            </div>
          </div>

          {/* 시작 프로그램 */}
          <div className="sg">
            <div className="sg-label">🚀 시작 프로그램</div>
            <div className="seg-ctrl">
              <button className={`seg-btn ${settings.autostart?"active":""}`}
                onClick={toggleAutostart}>
                {settings.autostart ? "ON — 자동 실행 중" : "OFF — 클릭해서 켜기"}
              </button>
            </div>
          </div>

          {/* 캘린더 위치 / 크기 */}
          <div className="sg">
            <div className="sg-label">↔ 위치 / 크기 조절</div>
            <button className={`edit-mode-btn ${editMode?"on":""}`}
              onClick={()=>setEditMode(v=>!v)}>
              {editMode ? "🔒 편집 완료 (잠금)" : "✏ 편집 모드 켜기"}
            </button>
            {editMode && (
              <div className="edit-hint">
                • 상단 바를 드래그해 창 위치 이동<br/>
                • 경계선을 드래그해 ToDo 패널 너비 조절<br/>
                위치는 자동 저장됩니다
              </div>
            )}
            <button className="edit-mode-btn" style={{marginTop:4}} onClick={async()=>{
              localStorage.removeItem(WIN_POS_KEY);
              await appWin.current.setPosition(new PhysicalPosition(100,100));
            }}>🔄 위치 초기화</button>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════
          Event Add Modal
          ══════════════════════════════════ */}
      {modal.open && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box glass-panel" onClick={e=>e.stopPropagation()}>
            <div className="modal-hdr">
              <span>📌 시간 일정 추가</span>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-chips">
                <span className="modal-chip">{modal.date}</span>
                {!modal.allDay && <span className="modal-chip time">{modal.startTime} ~ {modal.endTime}</span>}
              </div>

              <input className="todo-input modal-input" placeholder="일정 제목…"
                value={modalTitle} autoFocus
                onChange={e=>setModalTitle(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&commitModal()} />

              <div className="modal-times">
                <label className="time-lbl">시작
                  <input type="time" className="time-input" value={modal.startTime}
                    onChange={e=>setModal(m=>({...m,startTime:e.target.value}))} />
                </label>
                <label className="time-lbl">종료
                  <input type="time" className="time-input" value={modal.endTime}
                    onChange={e=>setModal(m=>({...m,endTime:e.target.value}))} />
                </label>
                <label className="allday-lbl">
                  <input type="checkbox" checked={modal.allDay}
                    onChange={e=>setModal(m=>({...m,allDay:e.target.checked}))} />
                  종일
                </label>
              </div>

              <div className="color-row-setting" style={{padding:"2px 0"}}>
                {TODO_COLORS.map(c=>(
                  <button key={c}
                    className={`color-dot-setting ${modalColor===c?"selected":""}`}
                    style={{background:c}} onClick={()=>setModalColor(c)} />
                ))}
              </div>

              <div className="modal-repeat-row">
                <span className="sg-label">🔁 반복</span>
                <div className="seg-ctrl">
                  {(["none","daily","weekly","monthly"] as RepeatType[]).map(r=>(
                    <button key={r} className={`seg-btn ${modalRepeat===r?"active":""}`}
                      onClick={()=>setModalRepeat(r)}>
                      {r==="none"?"없음":r==="daily"?"매일":r==="weekly"?"매주":"매월"}
                    </button>
                  ))}
                </div>
                {modalRepeat!=="none" && (
                  <label className="time-lbl" style={{marginTop:6}}>반복 종료일
                    <input type="date" className="time-input" value={modalRepeatEnd}
                      onChange={e=>setModalRepeatEnd(e.target.value)} />
                  </label>
                )}
              </div>

              <div className="modal-actions">
                <button className="modal-cancel" onClick={closeModal}>취소</button>
                <button className="modal-confirm" onClick={commitModal}>추가</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
