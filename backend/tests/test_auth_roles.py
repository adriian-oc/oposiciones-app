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
    from tests.conftest import set_known_password, TEST_PASSWORD

    email = f"revoke-test-{run_id}@test.example.com"
    create = client.post(
        "/api/admin/students",
        headers=admin_user["headers"],
        json={"email": email, "display_name": "Revocable", "role": "student"},
    )
    assert create.status_code == 201
    user_id = create.json()["id"]
    set_known_password(client, admin_user["headers"], user_id)
    login = client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # antes de revocar, el propio usuario puede usar la API con normalidad
    assert client.get("/api/auth/me", headers=headers).status_code == 200

    revoke = client.post(f"/api/admin/students/{user_id}/revoke", headers=admin_user["headers"])
    assert revoke.status_code == 200
    assert revoke.json()["revoked"] is True

    # tras revocar, el propio token (todavía sin caducar) queda bloqueado por la app
    blocked = client.get("/api/auth/me", headers=headers)
    assert blocked.status_code == 403

    reactivate = client.post(f"/api/admin/students/{user_id}/reactivate", headers=admin_user["headers"])
    assert reactivate.status_code == 200
    assert reactivate.json()["revoked"] is False
    assert client.get("/api/auth/me", headers=headers).status_code == 200
