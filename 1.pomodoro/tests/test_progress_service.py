from services.progress_service import ProgressService


def test_get_today_progress_initializes_empty_progress():
	service = ProgressService()

	result = service.get_today_progress(date_key="2026-06-09")

	assert result == {
		"date": "2026-06-09",
		"completed_sessions": 0,
		"focus_minutes": 0,
	}


def test_add_work_completion_accumulates_sessions_and_minutes(monkeypatch):
	service = ProgressService()
	monkeypatch.setattr(service, "_today_key", lambda: "2026-06-09")

	first = service.add_work_completion(focus_minutes=25)
	second = service.add_work_completion(focus_minutes=25)

	assert first == {
		"date": "2026-06-09",
		"completed_sessions": 1,
		"focus_minutes": 25,
	}
	assert second == {
		"date": "2026-06-09",
		"completed_sessions": 2,
		"focus_minutes": 50,
	}


def test_add_work_completion_ignores_negative_focus_minutes(monkeypatch):
	service = ProgressService()
	monkeypatch.setattr(service, "_today_key", lambda: "2026-06-09")

	result = service.add_work_completion(focus_minutes=-10)

	assert result == {
		"date": "2026-06-09",
		"completed_sessions": 1,
		"focus_minutes": 0,
	}
