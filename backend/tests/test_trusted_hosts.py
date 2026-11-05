from fastapi import FastAPI
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.testclient import TestClient

from app.core.config import Settings


def client_for(host: str, allowed_hosts: list[str] | None = None):
    config = Settings(_env_file=None, **({'allowed_hosts': allowed_hosts} if allowed_hosts else {}))
    app = FastAPI()
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=config.allowed_hosts)

    @app.get('/health')
    def health():
        return {'status': 'healthy'}

    return TestClient(app, base_url=f'http://{host}:8000')


def test_android_emulator_and_localhost_are_allowed():
    for host in ['10.0.2.2', '127.0.0.1', 'localhost']:
        with client_for(host) as client:
            assert client.get('/health').status_code == 200


def test_configured_lan_host_is_allowed():
    with client_for('192.168.1.3', ['localhost', '192.168.1.3']) as client:
        assert client.get('/health').json() == {'status': 'healthy'}


def test_unconfigured_host_is_still_rejected():
    with client_for('untrusted.example') as client:
        assert client.get('/health').status_code == 400
