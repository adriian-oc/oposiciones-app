def test_chat_requires_assignment(client, admin_user, profesor_user, student_user, other_student_user):
    # asigna student_user a profesor_user
    r = client.patch(
        f"/api/admin/students/{student_user['id']}",
        headers=admin_user["headers"],
        json={"assigned_profesor_id": profesor_user["id"]},
    )
    assert r.status_code == 200

    # el alumno manda un mensaje en su propio hilo
    r = client.post(f"/api/messages/{student_user['id']}", headers=student_user["headers"], json={"text": "Hola"})
    assert r.status_code == 201

    # su profesor asignado puede leer y responder
    r = client.get(f"/api/messages/{student_user['id']}", headers=profesor_user["headers"])
    assert r.status_code == 200
    assert len(r.json()) == 1

    r = client.post(f"/api/messages/{student_user['id']}", headers=profesor_user["headers"], json={"text": "Dime"})
    assert r.status_code == 201

    # otro alumno no puede leer el hilo ajeno
    r = client.get(f"/api/messages/{student_user['id']}", headers=other_student_user["headers"])
    assert r.status_code == 403

    # otro alumno tampoco puede escribir en el hilo ajeno
    r = client.post(f"/api/messages/{student_user['id']}", headers=other_student_user["headers"], json={"text": "hola"})
    assert r.status_code == 403

    # el admin puede leer cualquier hilo
    r = client.get(f"/api/messages/{student_user['id']}", headers=admin_user["headers"])
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_profesor_not_assigned_cannot_read_thread(client, admin_user, student_user):
    # un profesor recién creado, sin alumnos asignados, no debería poder leer el hilo de nadie
    create = client.post(
        "/api/admin/students",
        headers=admin_user["headers"],
        json={"email": f"unassigned-prof-{student_user['id'][:6]}@test.example.com", "display_name": "Sin Asignar", "role": "profesor"},
    )
    assert create.status_code == 201

    from tests.conftest import set_known_password, TEST_PASSWORD
    user_id = create.json()["id"]
    set_known_password(client, admin_user["headers"], user_id)
    login = client.post("/api/auth/login", json={"email": create.json()["email"], "password": TEST_PASSWORD})
    token = login.json()["access_token"]

    r = client.get(f"/api/messages/{student_user['id']}", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_message_text_length_validated(client, student_user):
    r = client.post(f"/api/messages/{student_user['id']}", headers=student_user["headers"], json={"text": ""})
    assert r.status_code == 422

    r = client.post(f"/api/messages/{student_user['id']}", headers=student_user["headers"], json={"text": "x" * 3001})
    assert r.status_code == 422
