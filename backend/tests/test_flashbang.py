import pytest
from fastapi.testclient import TestClient


def test_flashbang_assets_served(client: TestClient):
    # 1. Test audio.mp3
    res_audio = client.get("/static/flashbang/audio.mp3")
    assert res_audio.status_code == 200
    assert len(res_audio.content) > 100000

    # 2. Test image.jpeg and image.jpg
    res_jpeg = client.get("/static/flashbang/image.jpeg")
    assert res_jpeg.status_code == 200
    assert len(res_jpeg.content) > 30000

    res_jpg = client.get("/static/flashbang/image.jpg")
    assert res_jpg.status_code == 200

    # 3. Test flashbang.js script
    res_js = client.get("/static/flashbang.js")
    assert res_js.status_code == 200
    assert "triggerFlashbang" in res_js.text
    assert "2.7" in res_js.text or "268" in res_js.text or "2700" in res_js.text
    assert "#FFFFFF" in res_js.text

    # 4. Test download page contains script & preloads
    res_download = client.get("/download")
    assert res_download.status_code == 200
    assert "/static/flashbang/audio.mp3" in res_download.text
    assert "/static/flashbang/image.jpeg" in res_download.text
    assert "/static/flashbang.js" in res_download.text
    assert 'data-download="ios"' in res_download.text
