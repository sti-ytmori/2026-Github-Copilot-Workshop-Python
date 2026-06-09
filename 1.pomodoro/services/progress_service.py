from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from threading import Lock

XP_PER_SESSION = 10
XP_PER_LEVEL = 100
DAILY_TARGET_SESSIONS = 4


@dataclass
class DailyProgress:
	date: str
	completed_sessions: int
	focus_minutes: int

	def to_dict(self) -> dict:
		return {
			"date": self.date,
			"completed_sessions": self.completed_sessions,
			"focus_minutes": self.focus_minutes,
		}


class ProgressService:
	def __init__(self) -> None:
		self._lock = Lock()
		self._daily: dict[str, DailyProgress] = {}

	def _today_key(self) -> str:
		return date.today().isoformat()

	def _streak_days(self, reference_date: date) -> int:
		streak = 0
		current = reference_date
		while True:
			daily = self._daily.get(current.isoformat())
			if daily is None or daily.completed_sessions <= 0:
				break
			streak += 1
			current -= timedelta(days=1)
		return streak

	def _period_summary(self, reference_date: date, days: int) -> dict:
		total_sessions = 0
		total_focus_minutes = 0
		active_days = 0
		series = []

		for offset in range(days - 1, -1, -1):
			current = reference_date - timedelta(days=offset)
			current_key = current.isoformat()
			current_daily = self._daily.get(current_key)
			completed = current_daily.completed_sessions if current_daily else 0
			focus = current_daily.focus_minutes if current_daily else 0
			total_sessions += completed
			total_focus_minutes += focus
			if completed > 0:
				active_days += 1
			series.append(
				{
					"date": current_key,
					"completed_sessions": completed,
					"focus_minutes": focus,
				}
			)

		rate = (total_sessions / (days * DAILY_TARGET_SESSIONS)) * 100
		return {
			"completion_rate": round(min(100.0, rate), 1),
			"average_focus_minutes": round(total_focus_minutes / max(1, active_days), 1),
			"total_sessions": total_sessions,
			"daily_series": series,
		}

	def _build_progress_payload(self, key: str) -> dict:
		current = self._daily[key]
		reference_date = date.fromisoformat(key)
		total_completed_sessions = sum(progress.completed_sessions for progress in self._daily.values())
		xp = total_completed_sessions * XP_PER_SESSION
		streak_days = self._streak_days(reference_date)
		level = (xp // XP_PER_LEVEL) + 1
		weekly_stats = self._period_summary(reference_date, days=7)
		monthly_stats = self._period_summary(reference_date, days=30)

		return {
			**current.to_dict(),
			"xp": xp,
			"level": level,
			"xp_to_next_level": XP_PER_LEVEL - (xp % XP_PER_LEVEL),
			"streak_days": streak_days,
			"badges": [
				{"id": "streak_3days", "title": "3日連続", "achieved": streak_days >= 3},
				{
					"id": "weekly_10_sessions",
					"title": "今週10回完了",
					"achieved": weekly_stats["total_sessions"] >= 10,
				},
			],
			"stats": {
				"weekly": weekly_stats,
				"monthly": monthly_stats,
			},
		}

	def get_today_progress(self, date_key: str | None = None) -> dict:
		key = date_key or self._today_key()
		with self._lock:
			if key not in self._daily:
				self._daily[key] = DailyProgress(
					date=key,
					completed_sessions=0,
					focus_minutes=0,
				)
			return self._build_progress_payload(key)

	def add_work_completion(self, focus_minutes: int) -> dict:
		key = self._today_key()
		with self._lock:
			current = self._daily.get(
				key,
				DailyProgress(date=key, completed_sessions=0, focus_minutes=0),
			)
			current.completed_sessions += 1
			current.focus_minutes += max(0, int(focus_minutes))
			self._daily[key] = current
			return self._build_progress_payload(key)
