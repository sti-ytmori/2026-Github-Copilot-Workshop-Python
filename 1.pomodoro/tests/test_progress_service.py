from services.progress_service import ProgressService


def test_get_today_progress_initializes_empty_progress():
	service = ProgressService()

	result = service.get_today_progress(date_key="2026-06-09")

	assert result["date"] == "2026-06-09"
	assert result["completed_sessions"] == 0
	assert result["focus_minutes"] == 0
	assert result["xp"] == 0
	assert result["level"] == 1
	assert result["streak_days"] == 0


def test_add_work_completion_accumulates_sessions_and_minutes(monkeypatch):
	service = ProgressService()
	monkeypatch.setattr(service, "_today_key", lambda: "2026-06-09")

	first = service.add_work_completion(focus_minutes=25)
	second = service.add_work_completion(focus_minutes=25)

	assert first["date"] == "2026-06-09"
	assert first["completed_sessions"] == 1
	assert first["focus_minutes"] == 25
	assert first["xp"] == 10
	assert first["level"] == 1
	assert first["streak_days"] == 1

	assert second["date"] == "2026-06-09"
	assert second["completed_sessions"] == 2
	assert second["focus_minutes"] == 50
	assert second["xp"] == 20
	assert second["level"] == 1
	assert second["streak_days"] == 1


def test_add_work_completion_ignores_negative_focus_minutes(monkeypatch):
	service = ProgressService()
	monkeypatch.setattr(service, "_today_key", lambda: "2026-06-09")

	result = service.add_work_completion(focus_minutes=-10)

	assert result["date"] == "2026-06-09"
	assert result["completed_sessions"] == 1
	assert result["focus_minutes"] == 0


def test_gamification_badges_and_streak(monkeypatch):
	service = ProgressService()
	monkeypatch.setattr(service, "_today_key", lambda: "2026-06-09")

	for date_key in ("2026-06-07", "2026-06-08", "2026-06-09"):
		service.get_today_progress(date_key=date_key)
		service._daily[date_key].completed_sessions = 4
		service._daily[date_key].focus_minutes = 100

	result = service.get_today_progress(date_key="2026-06-09")
	badges = {badge["id"]: badge["achieved"] for badge in result["badges"]}

	assert result["streak_days"] == 3
	assert badges["streak_3days"] is True
	assert badges["weekly_10_sessions"] is True
	assert result["stats"]["weekly"]["completion_rate"] > 0
