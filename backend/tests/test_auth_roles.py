def test_me_requires_auth(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 403  # HTTPBearer sin credenciales


def test_me_returns_correct_role(client, admin_user, student_user):
    r = client.get("/api/auth/me", headers=admin_user["headers"])
    assert r.status_code == 200
    assert r.json()["role"] == "admin"

    r = client.get("/api/auth/me", headers=student_user["headers"])
    assert r.status_code == 200
    assert r.json()["role"] == "student"


def test_student_cannot_list_roster(client, student_user):
    r = client.get("/api/admin/students", headers=student_user["headers"])
    assert r.status_code == 403


def test_admin_can_list_roster(client, admin_user):
    r = client.get("/api/admin/students", headers=admin_user["headers"])
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_revoked_user_is_blocked_from_using_the_api(client, admin_user, run_id):
    from tests.conftest import _sign_in, TEST_PASSWORD
    from firebase_admin import auth as firebase_auth

    email = f"revoke-test-{run_id}@test.example.com"
    create = client.post(
        "/api/admin/students",
        headers=admin_user["headers"],
        json={"email": email, "display_name": "Revocable", "role": "student"},
    )
    assert create.status_code == 201
    user_id = create.json()["id"]
    firebase_uid = create.json()["firebase_uid"]
    firebase_auth.update_user(firebase_uid, password=TEST_PASSWORD)
    token = _sign_in(email)
    headers = {"Authorization": f"Bearer {token}"}

    # antes de revocar, el propio usuario puede usar la API con normalidad
    assert client.get("/api/auth/me", headers=headers).status_code == 200

    revoke = client.post(f"/api/admin/students/{user_id}/revoke", headers=admin_user["headers"])
    assert revoke.status_code == 200
    assert revoke.json()["revoked"] is True

    # tras revocar, el propio token (todavía válido para Firebase) queda bloqueado por la app
    blocked = client.get("/api/auth/me", headers=headers)
    assert blocked.status_code == 403

    reactivate = client.post(f"/api/admin/students/{user_id}/reactivate", headers=admin_user["headers"])
    assert reactivate.status_code == 200
    assert reactivate.json()["revoked"] is False
    assert client.get("/api/auth/me", headers=headers).status_code == 200
