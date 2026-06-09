const MODES = {
	work: "作業中",
	short_break: "短い休憩",
	long_break: "長い休憩",
};

const TIMER_STATES = {
	idle: "idle",
	running: "running",
	paused: "paused",
};

const DEFAULT_SETTINGS = {
	work_minutes: 25,
	break_minutes: 5,
	theme: "light",
	sounds: {
		start: true,
		end: true,
		tick: false,
	},
	work_minutes_options: [15, 25, 35, 45],
	break_minutes_options: [5, 10, 15],
	theme_options: ["light", "dark", "focus"],
	short_break_minutes: 5,
	long_break_minutes: 15,
	long_break_interval: 4,
};

const ring = document.getElementById("progressRing");
const modeLabel = document.getElementById("modeLabel");
const timeLabel = document.getElementById("timeLabel");
const primaryButton = document.getElementById("primaryButton");
const resetButton = document.getElementById("resetButton");
const statusLabel = document.getElementById("statusLabel");
const completedSessionsLabel = document.getElementById("completedSessions");
const focusMinutesLabel = document.getElementById("focusMinutes");
const workMinutesSelect = document.getElementById("workMinutesSelect");
const breakMinutesSelect = document.getElementById("breakMinutesSelect");
const themeSelect = document.getElementById("themeSelect");
const startSoundToggle = document.getElementById("startSoundToggle");
const endSoundToggle = document.getElementById("endSoundToggle");
const tickSoundToggle = document.getElementById("tickSoundToggle");

const RADIUS = 92;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

ring.style.strokeDasharray = `${CIRCUMFERENCE}`;
ring.style.strokeDashoffset = `${CIRCUMFERENCE}`;

const state = {
	settings: { ...DEFAULT_SETTINGS },
	mode: "work",
	timerState: TIMER_STATES.idle,
	endTimeMs: null,
	remainingMs: DEFAULT_SETTINGS.work_minutes * 60 * 1000,
	sessionDurationMs: DEFAULT_SETTINGS.work_minutes * 60 * 1000,
	completedWorkCycles: 0,
	progress: {
		date: todayKey(),
		completed_sessions: 0,
		focus_minutes: 0,
	},
};

let timerId = null;

function todayKey() {
	return new Date().toISOString().slice(0, 10);
}

function modeDurationMs(mode) {
	if (mode === "work") {
		return state.settings.work_minutes * 60 * 1000;
	}
	return state.settings.break_minutes * 60 * 1000;
}

function formatMs(ms) {
	const totalSec = Math.max(0, Math.ceil(ms / 1000));
	const minute = Math.floor(totalSec / 60);
	const second = totalSec % 60;
	return `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

function statusText() {
	if (state.timerState === TIMER_STATES.running) {
		return "実行中";
	}
	if (state.timerState === TIMER_STATES.paused) {
		return "一時停止中";
	}
	return "待機中";
}

function primaryButtonText() {
	if (state.timerState === TIMER_STATES.running) {
		return "一時停止";
	}
	if (state.timerState === TIMER_STATES.paused) {
		return "再開";
	}
	return "開始";
}

function progressPercent() {
	const elapsed = Math.max(0, state.sessionDurationMs - state.remainingMs);
	return Math.min(1, elapsed / state.sessionDurationMs);
}

function render() {
	const key = todayKey();
	if (state.progress.date !== key) {
		state.progress = loadProgress();
	}

	modeLabel.textContent = MODES[state.mode];
	timeLabel.textContent = formatMs(state.remainingMs);
	statusLabel.textContent = statusText();
	primaryButton.textContent = primaryButtonText();

	const offset = CIRCUMFERENCE * (1 - progressPercent());
	ring.style.strokeDashoffset = `${offset}`;

	completedSessionsLabel.textContent = String(state.progress.completed_sessions);
	focusMinutesLabel.textContent = `${state.progress.focus_minutes} 分`;
}

function setMode(mode) {
	state.mode = mode;
	state.sessionDurationMs = modeDurationMs(mode);
	state.remainingMs = state.sessionDurationMs;
}

function populateSelect(selectElement, options, formatter, currentValue) {
	selectElement.innerHTML = "";
	options.forEach((optionValue) => {
		const option = document.createElement("option");
		option.value = String(optionValue);
		option.textContent = formatter(optionValue);
		if (String(optionValue) === String(currentValue)) {
			option.selected = true;
		}
		selectElement.appendChild(option);
	});
}

function applyTheme(theme) {
	document.documentElement.setAttribute("data-theme", theme);
}

function playTone(frequency, durationMs) {
	const AudioCtx = window.AudioContext || window.webkitAudioContext;
	if (!AudioCtx) {
		return;
	}
	const ctx = new AudioCtx();
	const oscillator = ctx.createOscillator();
	const gain = ctx.createGain();
	oscillator.type = "sine";
	oscillator.frequency.value = frequency;
	gain.gain.value = 0.04;
	oscillator.connect(gain);
	gain.connect(ctx.destination);
	oscillator.start();
	window.setTimeout(() => {
		oscillator.stop();
		ctx.close();
	}, durationMs);
}

function playStartSound() {
	if (state.settings.sounds.start) {
		playTone(660, 120);
	}
}

function playEndSound() {
	if (state.settings.sounds.end) {
		playTone(440, 220);
	}
}

function playTickSound() {
	if (state.settings.sounds.tick) {
		playTone(900, 35);
	}
}

function savePreferences() {
	const payload = {
		work_minutes: state.settings.work_minutes,
		break_minutes: state.settings.break_minutes,
		theme: state.settings.theme,
		sounds: state.settings.sounds,
	};
	window.localStorage.setItem("pomodoro-preferences", JSON.stringify(payload));
}

function loadPreferences() {
	try {
		const raw = window.localStorage.getItem("pomodoro-preferences");
		if (!raw) {
			return;
		}
		const prefs = JSON.parse(raw);
		state.settings.work_minutes = Number(prefs.work_minutes) || state.settings.work_minutes;
		state.settings.break_minutes = Number(prefs.break_minutes) || state.settings.break_minutes;
		state.settings.theme = prefs.theme || state.settings.theme;
		state.settings.sounds = {
			start: prefs.sounds?.start ?? state.settings.sounds.start,
			end: prefs.sounds?.end ?? state.settings.sounds.end,
			tick: prefs.sounds?.tick ?? state.settings.sounds.tick,
		};
	} catch (_err) {
		// 永続化データが壊れている場合は既定値を使用する
	}
}

function renderSettingsControls() {
	populateSelect(workMinutesSelect, state.settings.work_minutes_options, (m) => `${m}分`, state.settings.work_minutes);
	populateSelect(breakMinutesSelect, state.settings.break_minutes_options, (m) => `${m}分`, state.settings.break_minutes);
	populateSelect(
		themeSelect,
		state.settings.theme_options,
		(theme) => (theme === "light" ? "ライト" : theme === "dark" ? "ダーク" : "フォーカス"),
		state.settings.theme,
	);
	startSoundToggle.checked = !!state.settings.sounds.start;
	endSoundToggle.checked = !!state.settings.sounds.end;
	tickSoundToggle.checked = !!state.settings.sounds.tick;
	applyTheme(state.settings.theme);
}

function stopTick() {
	if (timerId !== null) {
		window.clearInterval(timerId);
		timerId = null;
	}
}

function startTick() {
	stopTick();
	timerId = window.setInterval(tick, 250);
}

function toBreakMode() {
	const interval = state.settings.long_break_interval;
	const useLongBreak = state.completedWorkCycles > 0 && state.completedWorkCycles % interval === 0;
	return useLongBreak ? "long_break" : "short_break";
}

function loadProgress() {
	const key = `pomodoro-progress:${todayKey()}`;
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) {
			return { date: todayKey(), completed_sessions: 0, focus_minutes: 0 };
		}
		const parsed = JSON.parse(raw);
		if (typeof parsed.completed_sessions !== "number" || typeof parsed.focus_minutes !== "number") {
			return { date: todayKey(), completed_sessions: 0, focus_minutes: 0 };
		}
		return {
			date: todayKey(),
			completed_sessions: parsed.completed_sessions,
			focus_minutes: parsed.focus_minutes,
		};
	} catch (_err) {
		return { date: todayKey(), completed_sessions: 0, focus_minutes: 0 };
	}
}

function saveProgress(progress) {
	const key = `pomodoro-progress:${todayKey()}`;
	window.localStorage.setItem(key, JSON.stringify(progress));
}

async function syncProgressFromApi() {
	try {
		const response = await fetch(`/api/progress/today?date=${todayKey()}`);
		if (!response.ok) {
			return;
		}
		const data = await response.json();
		if (typeof data.completed_sessions === "number" && typeof data.focus_minutes === "number") {
			const merged = {
				date: todayKey(),
				completed_sessions: Math.max(state.progress.completed_sessions, data.completed_sessions),
				focus_minutes: Math.max(state.progress.focus_minutes, data.focus_minutes),
			};
			state.progress = merged;
			saveProgress(merged);
		}
	} catch (_err) {
		// API障害時はローカルデータを継続利用
	}
}

async function postCompletedWorkSession() {
	try {
		await fetch("/api/sessions/complete", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ mode: "work" }),
		});
	} catch (_err) {
		// 送信失敗でもクライアント動作を優先する
	}
}

function addTodayProgress() {
	state.progress.completed_sessions += 1;
	state.progress.focus_minutes += state.settings.work_minutes;
	saveProgress(state.progress);
}

function finishSession() {
	stopTick();
	state.timerState = TIMER_STATES.idle;
	playEndSound();

	if (state.mode === "work") {
		state.completedWorkCycles += 1;
		addTodayProgress();
		postCompletedWorkSession();
		setMode(toBreakMode());
	} else {
		setMode("work");
	}

	render();
}

function tick() {
	if (state.timerState !== TIMER_STATES.running || state.endTimeMs === null) {
		return;
	}
	state.remainingMs = Math.max(0, state.endTimeMs - Date.now());
	playTickSound();
	if (state.remainingMs <= 0) {
		finishSession();
		return;
	}
	render();
}

function startTimer() {
	if (state.timerState === TIMER_STATES.idle) {
		state.sessionDurationMs = modeDurationMs(state.mode);
		state.remainingMs = state.sessionDurationMs;
	}

	state.timerState = TIMER_STATES.running;
	state.endTimeMs = Date.now() + state.remainingMs;
	playStartSound();
	startTick();
	render();
}

function pauseTimer() {
	if (state.timerState !== TIMER_STATES.running) {
		return;
	}
	state.remainingMs = Math.max(0, state.endTimeMs - Date.now());
	state.timerState = TIMER_STATES.paused;
	state.endTimeMs = null;
	stopTick();
	render();
}

function resetTimer() {
	stopTick();
	state.timerState = TIMER_STATES.idle;
	state.endTimeMs = null;
	state.completedWorkCycles = 0;
	setMode("work");
	render();
}

function handleWorkMinutesChange() {
	state.settings.work_minutes = Number(workMinutesSelect.value) || DEFAULT_SETTINGS.work_minutes;
	if (state.mode === "work" && state.timerState === TIMER_STATES.idle) {
		setMode("work");
	}
	savePreferences();
	render();
}

function handleBreakMinutesChange() {
	state.settings.break_minutes = Number(breakMinutesSelect.value) || DEFAULT_SETTINGS.break_minutes;
	if (state.mode !== "work" && state.timerState === TIMER_STATES.idle) {
		setMode(state.mode);
	}
	savePreferences();
	render();
}

function handleThemeChange() {
	state.settings.theme = themeSelect.value || DEFAULT_SETTINGS.theme;
	applyTheme(state.settings.theme);
	savePreferences();
}

function handleSoundToggleChange() {
	state.settings.sounds = {
		start: startSoundToggle.checked,
		end: endSoundToggle.checked,
		tick: tickSoundToggle.checked,
	};
	savePreferences();
}

function handlePrimaryButton() {
	if (state.timerState === TIMER_STATES.running) {
		pauseTimer();
		return;
	}
	startTimer();
}

async function loadSettings() {
	try {
		const response = await fetch("/api/settings");
		if (!response.ok) {
			return;
		}
		const data = await response.json();
		state.settings = {
			work_minutes: Number(data.work_minutes) || DEFAULT_SETTINGS.work_minutes,
			break_minutes: Number(data.break_minutes) || DEFAULT_SETTINGS.break_minutes,
			theme: data.theme || DEFAULT_SETTINGS.theme,
			sounds: {
				start: data.sounds?.start ?? DEFAULT_SETTINGS.sounds.start,
				end: data.sounds?.end ?? DEFAULT_SETTINGS.sounds.end,
				tick: data.sounds?.tick ?? DEFAULT_SETTINGS.sounds.tick,
			},
			work_minutes_options: Array.isArray(data.work_minutes_options)
				? data.work_minutes_options
				: DEFAULT_SETTINGS.work_minutes_options,
			break_minutes_options: Array.isArray(data.break_minutes_options)
				? data.break_minutes_options
				: DEFAULT_SETTINGS.break_minutes_options,
			theme_options: Array.isArray(data.theme_options) ? data.theme_options : DEFAULT_SETTINGS.theme_options,
			short_break_minutes: Number(data.short_break_minutes) || Number(data.break_minutes) || DEFAULT_SETTINGS.break_minutes,
			long_break_minutes: Number(data.long_break_minutes) || Number(data.break_minutes) || DEFAULT_SETTINGS.break_minutes,
			long_break_interval: Number(data.long_break_interval) || DEFAULT_SETTINGS.long_break_interval,
		};
		loadPreferences();
	} catch (_err) {
		state.settings = { ...DEFAULT_SETTINGS };
	}
}

async function initialize() {
	await loadSettings();
	renderSettingsControls();
	state.progress = loadProgress();
	setMode("work");
	await syncProgressFromApi();
	primaryButton.addEventListener("click", handlePrimaryButton);
	resetButton.addEventListener("click", resetTimer);
	workMinutesSelect.addEventListener("change", handleWorkMinutesChange);
	breakMinutesSelect.addEventListener("change", handleBreakMinutesChange);
	themeSelect.addEventListener("change", handleThemeChange);
	startSoundToggle.addEventListener("change", handleSoundToggleChange);
	endSoundToggle.addEventListener("change", handleSoundToggleChange);
	tickSoundToggle.addEventListener("change", handleSoundToggleChange);
	render();
}

initialize();
