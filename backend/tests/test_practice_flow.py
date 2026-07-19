def _make_practical_set(client, admin_user, theme_id):
    payload = {
        "title": "Cuadernillo de prueba",
        "description": "Set sintético para tests",
        "theme_ids": [theme_id],
        "questions": [
            {"position": 1, "text": "1+1?", "choices": ["1", "2", "3"], "correct_answer": 1},
            {"position": 2, "text": "2+2?", "choices": ["3", "4", "5"], "correct_answer": 1},
            {"position": 3, "text": "3+3?", "choices": ["5", "6", "7"], "correct_answer": 1},
            {"position": 4, "text": "4+4?", "choices": ["7", "8", "9"], "correct_answer": 1},
        ],
        "cases": [
            {"position": 1, "title": "Caso 1", "description": "Primer caso", "question_positions": [1, 2]},
            {"position": 2, "title": "Caso 2", "description": "Segundo caso", "question_positions": [3, 4]},
        ],
    }
    r = client.post("/api/practical-sets/", headers=admin_user["headers"], json=payload)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_practice_flow_scoring_and_progress(client, admin_user, student_user):
    themes = client.get("/api/themes/?part=SPECIFIC", headers=admin_user["headers"]).json()
    theme_id = themes[0]["id"]
    ps_id = _make_practical_set(client, admin_user, theme_id)

    start = client.post(f"/api/exams/practice/{ps_id}/start", headers=student_user["headers"])
    assert start.status_code == 201, start.text
    attempt = start.json()
    assert attempt["exam"]["mode"] == "practice"
    assert attempt["exam"]["content_unit_key"] == ps_id
    assert len(attempt["exam"]["cases"]) == 2
    questions = attempt["exam"]["questions"]
    assert len(questions) == 4
    # Regresión del leak de seguridad de la ronda 5: el examen que recibe el alumno antes de
    # contestar no debe traer correct_answer.
    assert all("correct_answer" not in q for q in questions)

    for q in questions:
        # Las 4 preguntas del practical_set de prueba tienen correct_answer=1 (ver
        # _make_practical_set) -- no se puede leer del payload del examen porque ya no se
        # expone, así que se usa el valor conocido directamente.
        r = client.post(
            f"/api/exams/attempts/{attempt['id']}/answer",
            headers=student_user["headers"],
            json={"question_id": q["question_id"], "selected_answer": 1},
        )
        assert r.status_code == 200

    finish = client.post(f"/api/exams/attempts/{attempt['id']}/finish", headers=student_user["headers"])
    assert finish.status_code == 200
    details = finish.json()["details"]
    assert details["correct"] == 4
    assert details["total_questions"] == 4
    assert finish.json()["score"] == 15.0  # 4/4 correctas, escala 15 (tipo PRACTICAL -- Supuestos/Cuadernillos)

    progress = client.get("/api/progress/me", headers=student_user["headers"]).json()
    assert progress["content_scores"][ps_id]["correct"] == 4
    assert progress["content_scores"][ps_id]["pct"] == 100.0
    assert progress["streak"]["count"] >= 1

    history = client.get("/api/exams/history", headers=student_user["headers"]).json()
    assert any(h["attempt_id"] == attempt["id"] for h in history["history"])


def test_cannot_answer_after_finishing(client, admin_user, student_user):
    themes = client.get("/api/themes/?part=SPECIFIC", headers=admin_user["headers"]).json()
    ps_id = _make_practical_set(client, admin_user, themes[0]["id"])
    attempt = client.post(f"/api/exams/practice/{ps_id}/start", headers=student_user["headers"]).json()

    client.post(f"/api/exams/attempts/{attempt['id']}/finish", headers=student_user["headers"])

    q = attempt["exam"]["questions"][0]
    r = client.post(
        f"/api/exams/attempts/{attempt['id']}/answer",
        headers=student_user["headers"],
        json={"question_id": q["question_id"], "selected_answer": 0},
    )
    assert r.status_code == 400
