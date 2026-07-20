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


# 1x1 PNG rojo, para probar la subida de adjuntos sin depender de un archivo en disco.
_TEST_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108020000009077"
    "5310000000c49444154789c626001000000ffff03000006000557bfabd4000"
    "00000049454e44ae426082"
)


def test_send_and_read_attachment(client, other_student_user):
    r = client.post(
        f"/api/messages/{other_student_user['id']}/attachment",
        headers=other_student_user["headers"],
        files={"file": ("foto.png", _TEST_PNG, "image/png")},
        data={"caption": "Mira esto"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["attachment_type"] == "image"
    assert body["attachment_name"] == "foto.png"
    assert body["attachment_path"].startswith("chat/")
    assert body["text"] == "Mira esto"

    # el archivo queda accesible vía el mismo mount estático /uploads que avatares y documentos
    served = client.get(f"/uploads/{body['attachment_path']}")
    assert served.status_code == 200


def test_send_attachment_rejects_bad_type(client, other_student_user):
    r = client.post(
        f"/api/messages/{other_student_user['id']}/attachment",
        headers=other_student_user["headers"],
        files={"file": ("script.exe", b"MZ", "application/x-msdownload")},
    )
    assert r.status_code == 400


def test_delete_thread(client, admin_user, other_student_user):
    r = client.post(
        f"/api/messages/{other_student_user['id']}",
        headers=other_student_user["headers"],
        json={"text": "mensaje que se va a borrar"},
    )
    assert r.status_code == 201
    assert len(client.get(f"/api/messages/{other_student_user['id']}", headers=admin_user["headers"]).json()) > 0

    r = client.delete(f"/api/messages/{other_student_user['id']}", headers=admin_user["headers"])
    assert r.status_code == 200

    assert client.get(f"/api/messages/{other_student_user['id']}", headers=admin_user["headers"]).json() == []


def test_delete_thread_requires_authorization(client, profesor_user, other_student_user):
    # other_student_user no está asignado a profesor_user en este punto de la suite
    r = client.delete(f"/api/messages/{other_student_user['id']}", headers=profesor_user["headers"])
    assert r.status_code == 403
