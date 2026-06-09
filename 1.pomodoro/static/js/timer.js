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
const timerRingEl = document.querySelector(".timer-ring");
const rippleRings = document.querySelectorAll(".ripple-ring");

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

function lerpColor(colorA, colorB, t) {
	const ar = parseInt(colorA.slice(1, 3), 16);
	const ag = parseInt(colorA.slice(3, 5), 16);
	const ab = parseInt(colorA.slice(5, 7), 16);
	const br = parseInt(colorB.slice(1, 3), 16);
	const bg = parseInt(colorB.slice(3, 5), 16);
	const bb = parseInt(colorB.slice(5, 7), 16);
	return `rgb(${Math.round(ar + (br - ar) * t)}, ${Math.round(ag + (bg - ag) * t)}, ${Math.round(ab + (bb - ab) * t)})`;
}

function progressColor() {
	const p = progressPercent();
	if (p < 0.5) {
		return lerpColor("#3b82f6", "#f59e0b", p * 2);
	}
	return lerpColor("#f59e0b", "#ef4444", (p - 0.5) * 2);
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

	const color = progressColor();
	ring.style.stroke = color;
	for (const el of rippleRings) {
		el.style.stroke = color;
	}

	const isWorkRunning = state.timerState === TIMER_STATES.running && state.mode === "work";
	timerRingEl.classList.toggle("is-running", isWorkRunning);
	if (isWorkRunning) {
		startParticles();
	} else {
		stopParticles();
	}

	completedSessionsLabel.textContent = String(state.progress.completed_sessions);
	focusMinutesLabel.textContent = `${state.progress.focus_minutes} 分`;
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

// ─── Particle system ─────────────────────────────────────────────────────────
const particleCanvas = document.getElementById("particleCanvas");
let particleCtx = null;
let particles = [];
let particleAnimId = null;

function initParticleCanvas() {
	if (!particleCanvas) return;
	particleCtx = particleCanvas.getContext("2d");
	resizeParticleCanvas();
	window.addEventListener("resize", resizeParticleCanvas);
}

function resizeParticleCanvas() {
	if (!particleCanvas) return;
	particleCanvas.width = window.innerWidth;
	particleCanvas.height = window.innerHeight;
}

function createParticle() {
	return {
		x: Math.random() * particleCanvas.width,
		y: particleCanvas.height + 10,
		radius: 2 + Math.random() * 3,
		speedY: -(0.5 + Math.random() * 0.8),
		speedX: (Math.random() - 0.5) * 0.5,
		opacity: 0,
		maxOpacity: 0.12 + Math.random() * 0.2,
		fadingIn: true,
	};
}

function animateParticles() {
	if (!particleCtx) return;
	particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

	if (particles.length < 45 && Math.random() < 0.2) {
		particles.push(createParticle());
	}

	const color = progressColor();
	particles = particles.filter((p) => p.opacity > 0 || p.fadingIn);

	for (const p of particles) {
		p.x += p.speedX;
		p.y += p.speedY;

		if (p.fadingIn) {
			p.opacity = Math.min(p.maxOpacity, p.opacity + 0.008);
			if (p.opacity >= p.maxOpacity) p.fadingIn = false;
		} else {
			p.opacity -= 0.004;
		}

		if (p.y < -10) {
			p.opacity = 0;
			continue;
		}

		particleCtx.globalAlpha = p.opacity;
		particleCtx.beginPath();
		particleCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
		particleCtx.fillStyle = color;
		particleCtx.fill();
	}

	particleCtx.globalAlpha = 1;
	particleAnimId = requestAnimationFrame(animateParticles);
}

function startParticles() {
	if (!particleCtx || particleAnimId !== null) return;
	particleAnimId = requestAnimationFrame(animateParticles);
}

function stopParticles() {
	if (particleAnimId !== null) {
		cancelAnimationFrame(particleAnimId);
		particleAnimId = null;
	}
	particles = [];
	if (particleCtx) {
		particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
	}
}
// ─────────────────────────────────────────────────────────────────────────────

async function initialize() {
	await loadSettings();
	state.progress = loadProgress();
	setMode("work");
	await syncProgressFromApi();
	initParticleCanvas();
	primaryButton.addEventListener("click", handlePrimaryButton);
	resetButton.addEventListener("click", resetTimer);
	render();
}

initialize();
