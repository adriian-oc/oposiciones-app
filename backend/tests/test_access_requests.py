def test_access_requests_public_whitelist_and_rate_limit(client, admin_user, student_user):
    # público, sin auth, y con un intento de inyectar 'status' (debe ignorarse)
    r = client.post(
        "/api/access-requests/",
        json={"email": "solicitante@test.example.com", "nombre": "Solicitante", "status": "converted"},
    )
    assert r.status_code == 201
    assert r.json()["status"] == "pending"
    request_id = r.json()["id"]

    # sin auth no se puede listar ni gestionar
    assert client.get("/api/access-requests/").status_code == 403
    assert client.get("/api/access-requests/", headers=student_user["headers"]).status_code == 403

    # el admin sí puede listar y gestionar
    listed = client.get("/api/access-requests/", headers=admin_user["headers"])
    assert listed.status_code == 200
    assert any(item["id"] == request_id for item in listed.json())

    updated = client.patch(
        f"/api/access-requests/{request_id}",
        headers=admin_user["headers"],
        json={"status": "dismissed"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "dismissed"

    # 4 solicitudes más agotan la cuota de 5/hora por IP; la 5ª ya debe dar 429
    for i in range(4):
        r = client.post("/api/access-requests/", json={"email": f"mas{i}@test.example.com", "nombre": "Otro"})
        assert r.status_code == 201

    r = client.post("/api/access-requests/", json={"email": "sextofuera@test.example.com", "nombre": "Sexto"})
    assert r.status_code == 429
