from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from threading import Lock


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

	def get_today_progress(self, date_key: str | None = None) -> dict:
		key = date_key or self._today_key()
		with self._lock:
			if key not in self._daily:
				self._daily[key] = DailyProgress(
					date=key,
					completed_sessions=0,
					focus_minutes=0,
				)
			return self._daily[key].to_dict()

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
			return current.to_dict()
