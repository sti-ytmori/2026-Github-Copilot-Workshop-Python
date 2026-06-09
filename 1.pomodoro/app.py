import os

from flask import Flask, jsonify, render_template, request

from services.progress_service import ProgressService


app = Flask(__name__)
progress_service = ProgressService()

SETTINGS = {
	"work_minutes": 25,
	"short_break_minutes": 5,
	"long_break_minutes": 15,
	"long_break_interval": 4,
}


@app.route("/")
def index():
	return render_template("index.html")


@app.route("/api/settings", methods=["GET"])
def get_settings():
	return jsonify(SETTINGS)


@app.route("/api/progress/today", methods=["GET"])
def get_today_progress():
	date_key = request.args.get("date")
	if date_key is not None:
		parts = date_key.split("-")
		if (
			len(parts) != 3
			or len(parts[0]) != 4
			or len(parts[1]) != 2
			or len(parts[2]) != 2
			or not all(part.isdigit() for part in parts)
		):
			return jsonify({"error": "date must be in YYYY-MM-DD format"}), 400
	progress = progress_service.get_today_progress(date_key=date_key)
	return jsonify(progress)


@app.route("/api/sessions/complete", methods=["POST"])
def complete_session():
	data = request.get_json(silent=True) or {}
	mode = data.get("mode")
	if mode != "work":
		return jsonify({"error": "mode must be 'work'"}), 400

	focus_minutes = int(SETTINGS["work_minutes"])
	updated = progress_service.add_work_completion(focus_minutes=focus_minutes)
	return jsonify(updated), 201


if __name__ == "__main__":
	debug_mode = os.getenv("FLASK_DEBUG", "false").strip().lower() in ("1", "true", "yes", "on")
	app.run(host="0.0.0.0", port=8000, debug=debug_mode)
