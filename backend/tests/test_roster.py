from datetime import datetime, timezone


def test_update_student_allowed_content(client, admin_user, student_user):
    r = client.patch(
        f"/api/admin/students/{student_user['id']}",
        headers=admin_user["headers"],
        json={"allowed_content": ["cuad_1", "cuad_2"], "payment_type": "Mensual"},
    )
    assert r.status_code == 200
    assert r.json()["allowed_content"] == ["cuad_1", "cuad_2"]
    assert r.json()["payment_type"] == "Mensual"

    # None explícito = acceso completo, distinto de una lista vacía
    r = client.patch(
        f"/api/admin/students/{student_user['id']}",
        headers=admin_user["headers"],
        json={"allowed_content": None},
    )
    assert r.status_code == 200
    assert r.json()["allowed_content"] is None


def test_novedades_badge_clears_per_staff_member(client, raw_db, admin_user, profesor_user, student_user):
    raw_db.progress.update_one(
        {"user_id": student_user["id"]},
        {"$set": {"user_id": student_user["id"], "updated_at": datetime.now(timezone.utc), "content_scores": {}, "streak": {"count": 1}}},
        upsert=True,
    )
    # nadie lo ha revisado todavía para ninguno de los dos miembros del staff
    raw_db.users.update_one({"id": student_user["id"]}, {"$set": {"last_reviewed_by": {}}})

    roster = client.get("/api/admin/students", headers=admin_user["headers"]).json()
    target = next(u for u in roster if u["id"] == student_user["id"])
    assert target["has_novedades"] is True

    mark = client.post(f"/api/admin/students/{student_user['id']}/mark-reviewed", headers=admin_user["headers"])
    assert mark.status_code == 200

    roster = client.get("/api/admin/students", headers=admin_user["headers"]).json()
    target = next(u for u in roster if u["id"] == student_user["id"])
    assert target["has_novedades"] is False

    # el profesor asignado, que todavía no lo ha revisado ÉL, sigue viendo el badge
    client.patch(
        f"/api/admin/students/{student_user['id']}",
        headers=admin_user["headers"],
        json={"assigned_profesor_id": profesor_user["id"]},
    )
    my_students = client.get("/api/profesor/students", headers=profesor_user["headers"]).json()
    target = next(u for u in my_students if u["id"] == student_user["id"])
    assert target["has_novedades"] is True


def test_profesor_cannot_mark_reviewed_unassigned_student(client, profesor_user, other_student_user):
    r = client.post(f"/api/admin/students/{other_student_user['id']}/mark-reviewed", headers=profesor_user["headers"])
    assert r.status_code == 403


def test_profesor_can_manage_own_propio_student(client, admin_user, profesor_user, other_student_user):
    """El admin marca a other_student_user como alumno PROPIO de profesor_user -- a partir de
    ahí el profesor puede editar acceso/pagos/expiración y revocar/reactivar, igual que un admin."""
    r = client.patch(
        f"/api/admin/students/{other_student_user['id']}",
        headers=admin_user["headers"],
        json={"assigned_profesor_id": profesor_user["id"], "student_type": "propio"},
    )
    assert r.status_code == 200
    assert r.json()["student_type"] == "propio"

    r = client.patch(
        f"/api/admin/students/{other_student_user['id']}",
        headers=profesor_user["headers"],
        json={"payment_type": "Mensual", "allowed_content": ["cuad_1"]},
    )
    assert r.status_code == 200
    assert r.json()["payment_type"] == "Mensual"

    r = client.post(f"/api/admin/students/{other_student_user['id']}/revoke", headers=profesor_user["headers"])
    assert r.status_code == 200
    assert r.json()["revoked"] is True

    r = client.post(f"/api/admin/students/{other_student_user['id']}/reactivate", headers=profesor_user["headers"])
    assert r.status_code == 200
    assert r.json()["revoked"] is False


def test_profesor_cannot_manage_centro_student_of_own(client, admin_user, profesor_user, student_user):
    """student_user ya está asignado a profesor_user desde otro test, pero SIN student_type
    'propio' (queda 'centro' por defecto) -- el profesor no puede gestionarlo, solo verlo."""
    r = client.patch(
        f"/api/admin/students/{student_user['id']}",
        headers=admin_user["headers"],
        json={"assigned_profesor_id": profesor_user["id"], "student_type": None},
    )
    assert r.status_code == 200

    r = client.patch(
        f"/api/admin/students/{student_user['id']}",
        headers=profesor_user["headers"],
        json={"payment_type": "Mensual"},
    )
    assert r.status_code == 403


def test_profesor_cannot_change_role_or_reassign_even_for_propio(client, admin_user, profesor_user, other_student_user):
    r = client.patch(
        f"/api/admin/students/{other_student_user['id']}",
        headers=admin_user["headers"],
        json={"assigned_profesor_id": profesor_user["id"], "student_type": "propio"},
    )
    assert r.status_code == 200

    r = client.patch(
        f"/api/admin/students/{other_student_user['id']}",
        headers=profesor_user["headers"],
        json={"role": "admin"},
    )
    assert r.status_code == 403

    r = client.patch(
        f"/api/admin/students/{other_student_user['id']}",
        headers=profesor_user["headers"],
        json={"assigned_profesor_id": None},
    )
    assert r.status_code == 403


def test_admin_cannot_change_own_role(client, admin_user):
    r = client.patch(
        f"/api/admin/students/{admin_user['id']}",
        headers=admin_user["headers"],
        json={"role": "profesor"},
    )
    assert r.status_code == 400
