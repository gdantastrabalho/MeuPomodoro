const LS_KEY = "pomo_clone_state_v1";

const DEFAULTS = {
  settings: {
    pomodoroMin: 25,
    shortMin: 5,
    longMin: 15,
    longEvery: 4,
    autoStartNext: false
  },
  timer: {
    mode: "pomodoro",
    remainingSec: 25 * 60,
    running: false,
    startedAt: null,
    pomodorosDone: 0,
    round: 1
  },
  tasks: [],
  currentTaskId: null,
  today: new Date().toISOString().slice(0,10),
  doneToday: 0
};

let state = loadState();
let intervalId = null;

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return structuredClone(DEFAULTS);
  try {
    const parsed = JSON.parse(raw);
    const today = new Date().toISOString().slice(0,10);
    if (parsed.today !== today) {
      parsed.today = today;
      parsed.doneToday = 0;
      parsed.timer.pomodorosDone = 0;
      parsed.timer.round = 1;
    }
    return parsed;
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function minutesForMode(mode) {
  const s = state.settings;
  if (mode === "pomodoro") return s.pomodoroMin;
  if (mode === "shortBreak") return s.shortMin;
  return s.longMin;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function currentTask() {
  return state.tasks.find(t => t.id === state.currentTaskId) || null;
}

function updateDocumentTitle() {
  const modeLabel =
    state.timer.mode === "pomodoro" ? "Foco" :
    state.timer.mode === "shortBreak" ? "Pausa" : "Pausa longa";
  document.title = `${formatTime(state.timer.remainingSec)} • ${modeLabel}`;
}

function setBgForMode(mode) {
  const root = document.documentElement;
  if (mode === "pomodoro") root.style.setProperty("--bg", "#b23b3b");
  else if (mode === "shortBreak") root.style.setProperty("--bg", "#2f7d6b");
  else root.style.setProperty("--bg", "#2f5f7d");
}

const elTime = document.getElementById("time");
const elStart = document.getElementById("btnStart");
const elPause = document.getElementById("btnPause");
const elSkip = document.getElementById("btnSkip");
const elRound = document.getElementById("roundLabel");
const elCurrentTaskLabel = document.getElementById("currentTaskLabel");
const elDoneCount = document.getElementById("doneCount");
const elBarFill = document.getElementById("barFill");

const tabs = Array.from(document.querySelectorAll(".tab"));

const elAddTask = document.getElementById("btnAddTask");
const elTaskForm = document.getElementById("taskForm");
const elTaskName = document.getElementById("taskName");
const elTaskEst = document.getElementById("taskEst");
const elCancelTask = document.getElementById("btnCancelTask");
const elTaskList = document.getElementById("taskList");

const elSettingsDialog = document.getElementById("settingsDialog");
const elSettingsForm = document.getElementById("settingsForm");
const elBtnSettings = document.getElementById("btnSettings");
const elBtnResetAll = document.getElementById("btnResetAll");

const elSetPomodoro = document.getElementById("setPomodoro");
const elSetShort = document.getElementById("setShort");
const elSetLong = document.getElementById("setLong");
const elSetLongEvery = document.getElementById("setLongEvery");
const elSetAuto = document.getElementById("setAutoStartNext");

function render() {
  elTime.textContent = formatTime(state.timer.remainingSec);
  elRound.textContent = String(state.timer.round);

  const ct = currentTask();
  elCurrentTaskLabel.textContent = ct ? ct.name : "Nenhuma";

  elStart.disabled = state.timer.running;
  elPause.disabled = !state.timer.running;

  tabs.forEach(t => t.classList.toggle("active", t.dataset.mode === state.timer.mode));

  elDoneCount.textContent = String(state.doneToday);
  const pct = Math.min(100, (state.doneToday / 12) * 100);
  elBarFill.style.width = `${pct}%`;

  elTaskList.innerHTML = "";
  state.tasks.forEach(task => {
    const li = document.createElement("li");
    li.className = "task";

    const left = document.createElement("div");
    left.className = "left";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = task.name + (task.id === state.currentTaskId ? " (atual)" : "");

    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = `Feito: ${task.done}/${task.est} pomodoros`;

    left.appendChild(name);
    left.appendChild(sub);

    const right = document.createElement("div");
    right.className = "right";

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `${task.est} est.`;

    const btnSelect = document.createElement("button");
    btnSelect.className = "icon-btn";
    btnSelect.type = "button";
    btnSelect.textContent = "Selecionar";
    btnSelect.onclick = () => {
      state.currentTaskId = task.id;
      saveState();
      render();
    };

    const btnDel = document.createElement("button");
    btnDel.className = "icon-btn";
    btnDel.type = "button";
    btnDel.textContent = "Excluir";
    btnDel.onclick = () => {
      state.tasks = state.tasks.filter(t => t.id !== task.id);
      if (state.currentTaskId === task.id) state.currentTaskId = null;
      saveState();
      render();
    };

    right.appendChild(badge);
    right.appendChild(btnSelect);
    right.appendChild(btnDel);

    li.appendChild(left);
    li.appendChild(right);
    elTaskList.appendChild(li);
  });

  setBgForMode(state.timer.mode);
  updateDocumentTitle();
}

function start() {
  if (state.timer.running) return;
  state.timer.running = true;
  state.timer.startedAt = Date.now();
  saveState();
  tickLoop();
  render();
}

function pause() {
  if (!state.timer.running) return;
  state.timer.running = false;
  state.timer.startedAt = null;
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  saveState();
  render();
}

function resetToMode(mode) {
  pause();
  state.timer.mode = mode;
  state.timer.remainingSec = minutesForMode(mode) * 60;
  saveState();
  render();
}

function tickLoop() {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => {
    if (!state.timer.running) return;

    state.timer.remainingSec -= 1;
    if (state.timer.remainingSec <= 0) {
      state.timer.remainingSec = 0;
      onFinishCycle();
      return;
    }
    saveState();
    render();
  }, 1000);
}

function onFinishCycle() {
  pause();

  if (state.timer.mode === "pomodoro") {
    state.doneToday += 1;
    state.timer.pomodorosDone += 1;
    state.timer.round += 1;

    const task = currentTask();
    if (task) {
      task.done = Math.min(task.est, task.done + 1);
      if (task.done >= task.est) state.currentTaskId = null;
    }
  }

  let nextMode;
  if (state.timer.mode === "pomodoro") {
    const isLong = (state.timer.pomodorosDone % state.settings.longEvery === 0);
    nextMode = isLong ? "longBreak" : "shortBreak";
  } else {
    nextMode = "pomodoro";
  }

  state.timer.mode = nextMode;
  state.timer.remainingSec = minutesForMode(nextMode) * 60;

  saveState();
  render();

  if (state.settings.autoStartNext) start();
}

elStart.addEventListener("click", start);
elPause.addEventListener("click", pause);
elSkip.addEventListener("click", () => onFinishCycle());

tabs.forEach(t => t.addEventListener("click", () => resetToMode(t.dataset.mode)));

elAddTask.addEventListener("click", () => {
  elTaskForm.classList.toggle("hidden");
  if (!elTaskForm.classList.contains("hidden")) elTaskName.focus();
});

elCancelTask.addEventListener("click", () => {
  elTaskForm.classList.add("hidden");
  elTaskName.value = "";
  elTaskEst.value = "1";
});

elTaskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = elTaskName.value.trim();
  const est = Number(elTaskEst.value);
  if (!name || !Number.isFinite(est) || est < 1) return;

  const task = {
    id: crypto.randomUUID(),
    name,
    est,
    done: 0,
    createdAt: Date.now()
  };

  state.tasks.unshift(task);
  if (!state.currentTaskId) state.currentTaskId = task.id;

  elTaskName.value = "";
  elTaskEst.value = "1";
  elTaskForm.classList.add("hidden");

  saveState();
  render();
});

elBtnSettings.addEventListener("click", () => {
  elSetPomodoro.value = String(state.settings.pomodoroMin);
  elSetShort.value = String(state.settings.shortMin);
  elSetLong.value = String(state.settings.longMin);
  elSetLongEvery.value = String(state.settings.longEvery);
  elSetAuto.checked = !!state.settings.autoStartNext;
  elSettingsDialog.showModal();
});

elSettingsForm.addEventListener("submit", () => {
  state.settings.pomodoroMin = Math.max(1, Number(elSetPomodoro.value) || 25);
  state.settings.shortMin = Math.max(1, Number(elSetShort.value) || 5);
  state.settings.longMin = Math.max(1, Number(elSetLong.value) || 15);
  state.settings.longEvery = Math.max(2, Number(elSetLongEvery.value) || 4);
  state.settings.autoStartNext = !!elSetAuto.checked;

  state.timer.remainingSec = minutesForMode(state.timer.mode) * 60;

  saveState();
  render();
});

elBtnResetAll.addEventListener("click", () => {
  if (!confirm("Resetar tudo (tarefas, configurações e contadores)?")) return;
  state = structuredClone(DEFAULTS);
  saveState();
  render();
});

render();
