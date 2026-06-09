import app as app_module
from services.progress_service import ProgressService


def test_get_settings_returns_expected_payload():
	client = app_module.app.test_client()

	response = client.get("/api/settings")

	assert response.status_code == 200
	assert response.get_json() == app_module.SETTINGS


def test_get_today_progress_accepts_date_query_parameter(monkeypatch):
	service = ProgressService()
	monkeypatch.setattr(app_module, "progress_service", service)
	client = app_module.app.test_client()

	response = client.get("/api/progress/today?date=2026-06-09")

	assert response.status_code == 200
	assert response.get_json() == {
		"date": "2026-06-09",
		"completed_sessions": 0,
		"focus_minutes": 0,
	}


def test_complete_session_rejects_non_work_mode(monkeypatch):
	service = ProgressService()
	monkeypatch.setattr(app_module, "progress_service", service)
	client = app_module.app.test_client()

	response = client.post("/api/sessions/complete", json={"mode": "break"})

	assert response.status_code == 400
	assert response.get_json() == {"error": "mode must be 'work'"}


def test_complete_session_records_work_session(monkeypatch):
	service = ProgressService()
	monkeypatch.setattr(service, "_today_key", lambda: "2026-06-09")
	monkeypatch.setattr(app_module, "progress_service", service)
	client = app_module.app.test_client()

	response = client.post("/api/sessions/complete", json={"mode": "work"})

	assert response.status_code == 201
	assert response.get_json() == {
		"date": "2026-06-09",
		"completed_sessions": 1,
		"focus_minutes": app_module.SETTINGS["work_minutes"],
	}
