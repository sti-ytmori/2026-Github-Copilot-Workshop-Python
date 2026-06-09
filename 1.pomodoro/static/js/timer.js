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
const levelValueLabel = document.getElementById("levelValue");
const xpValueLabel = document.getElementById("xpValue");
const streakValueLabel = document.getElementById("streakValue");
const badgeList = document.getElementById("badgeList");
const weeklyStatsLabel = document.getElementById("weeklyStats");
const monthlyStatsLabel = document.getElementById("monthlyStats");
const weeklyRateBar = document.getElementById("weeklyRateBar");
const monthlyRateBar = document.getElementById("monthlyRateBar");

const RADIUS = 92;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

ring.style.strokeDasharray = `${CIRCUMFERENCE}`;
ring.style.strokeDashoffset = `${CIRCUMFERENCE}`;

function defaultProgress(dateText = todayKey()) {
	return {
		date: dateText,
		completed_sessions: 0,
		focus_minutes: 0,
		xp: 0,
		level: 1,
		xp_to_next_level: 100,
		streak_days: 0,
		badges: [
			{ id: "streak_3days", title: "3日連続", achieved: false },
			{ id: "weekly_10_sessions", title: "今週10回完了", achieved: false },
		],
		stats: {
			weekly: { completion_rate: 0, average_focus_minutes: 0, total_sessions: 0, daily_series: [] },
			monthly: { completion_rate: 0, average_focus_minutes: 0, total_sessions: 0, daily_series: [] },
		},
	};
}

const state = {
	settings: { ...DEFAULT_SETTINGS },
	mode: "work",
	timerState: TIMER_STATES.idle,
	endTimeMs: null,
	remainingMs: DEFAULT_SETTINGS.work_minutes * 60 * 1000,
	sessionDurationMs: DEFAULT_SETTINGS.work_minutes * 60 * 1000,
	completedWorkCycles: 0,
	progress: defaultProgress(),
};

let timerId = null;

function todayKey() {
	return new Date().toISOString().slice(0, 10);
}

function modeDurationMs(mode) {
	if (mode === "work") {
		return state.settings.work_minutes * 60 * 1000;
	}
	if (mode === "long_break") {
		return state.settings.long_break_minutes * 60 * 1000;
	}
	return state.settings.short_break_minutes * 60 * 1000;
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

function normalizeProgress(progress) {
	const fallback = defaultProgress(todayKey());
	if (!progress || typeof progress !== "object") {
		return fallback;
	}

	const weekly = progress.stats && progress.stats.weekly ? progress.stats.weekly : fallback.stats.weekly;
	const monthly = progress.stats && progress.stats.monthly ? progress.stats.monthly : fallback.stats.monthly;

	return {
		...fallback,
		...progress,
		date: todayKey(),
		completed_sessions: Number(progress.completed_sessions) || 0,
		focus_minutes: Number(progress.focus_minutes) || 0,
		xp: Number(progress.xp) || 0,
		level: Number(progress.level) || 1,
		xp_to_next_level: Number(progress.xp_to_next_level) || 100,
		streak_days: Number(progress.streak_days) || 0,
		badges: Array.isArray(progress.badges) ? progress.badges : fallback.badges,
		stats: {
			weekly: {
				...fallback.stats.weekly,
				...weekly,
				completion_rate: Number(weekly.completion_rate) || 0,
				average_focus_minutes: Number(weekly.average_focus_minutes) || 0,
			},
			monthly: {
				...fallback.stats.monthly,
				...monthly,
				completion_rate: Number(monthly.completion_rate) || 0,
				average_focus_minutes: Number(monthly.average_focus_minutes) || 0,
			},
		},
	};
}

function renderGamification() {
	levelValueLabel.textContent = `Lv.${state.progress.level}`;
	xpValueLabel.textContent = `${state.progress.xp} XP`;
	streakValueLabel.textContent = `${state.progress.streak_days} 日`;

	badgeList.innerHTML = "";
	state.progress.badges.forEach((badge) => {
		const item = document.createElement("li");
		item.className = `badge${badge.achieved ? " badge-achieved" : ""}`;
		item.textContent = badge.title;
		badgeList.appendChild(item);
	});

	const weekly = state.progress.stats.weekly;
	const monthly = state.progress.stats.monthly;
	weeklyStatsLabel.textContent = `完了率 ${weekly.completion_rate.toFixed(1)}% / 平均集中 ${weekly.average_focus_minutes.toFixed(1)} 分`;
	monthlyStatsLabel.textContent = `完了率 ${monthly.completion_rate.toFixed(1)}% / 平均集中 ${monthly.average_focus_minutes.toFixed(1)} 分`;
	weeklyRateBar.style.width = `${Math.max(0, Math.min(100, weekly.completion_rate))}%`;
	monthlyRateBar.style.width = `${Math.max(0, Math.min(100, monthly.completion_rate))}%`;
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
	renderGamification();
}

function setMode(mode) {
	state.mode = mode;
	state.sessionDurationMs = modeDurationMs(mode);
	state.remainingMs = state.sessionDurationMs;
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
			return defaultProgress(todayKey());
		}
		return normalizeProgress(JSON.parse(raw));
	} catch (_err) {
		return defaultProgress(todayKey());
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
		const merged = normalizeProgress({
			...state.progress,
			...data,
			completed_sessions: Math.max(state.progress.completed_sessions, Number(data.completed_sessions) || 0),
			focus_minutes: Math.max(state.progress.focus_minutes, Number(data.focus_minutes) || 0),
		});
		state.progress = merged;
		saveProgress(merged);
	} catch (_err) {
		// API障害時はローカルデータを継続利用
	}
}

async function postCompletedWorkSession() {
	try {
		const response = await fetch("/api/sessions/complete", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ mode: "work" }),
		});
		if (!response.ok) {
			return;
		}
		const data = await response.json();
		state.progress = normalizeProgress(data);
		saveProgress(state.progress);
		render();
	} catch (_err) {
		// 送信失敗でもクライアント動作を優先する
	}
}

function addTodayProgress() {
	state.progress.completed_sessions += 1;
	state.progress.focus_minutes += state.settings.work_minutes;
	state.progress.xp += 10;
	state.progress.level = Math.floor(state.progress.xp / 100) + 1;
	state.progress.xp_to_next_level = 100 - (state.progress.xp % 100);
	state.progress.streak_days = Math.max(1, state.progress.streak_days);
	saveProgress(state.progress);
}

function finishSession() {
	stopTick();
	state.timerState = TIMER_STATES.idle;

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
			short_break_minutes: Number(data.short_break_minutes) || DEFAULT_SETTINGS.short_break_minutes,
			long_break_minutes: Number(data.long_break_minutes) || DEFAULT_SETTINGS.long_break_minutes,
			long_break_interval: Number(data.long_break_interval) || DEFAULT_SETTINGS.long_break_interval,
		};
	} catch (_err) {
		state.settings = { ...DEFAULT_SETTINGS };
	}
}

async function initialize() {
	await loadSettings();
	state.progress = loadProgress();
	setMode("work");
	await syncProgressFromApi();
	primaryButton.addEventListener("click", handlePrimaryButton);
	resetButton.addEventListener("click", resetTimer);
	render();
}

initialize();
