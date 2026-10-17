#!/usr/bin/env python3
"""Generate a VAPID P-256 key pair and print environment variable assignments."""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def main() -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_scalar = private_key.private_numbers().private_value.to_bytes(32, "big")
    public_bytes = private_key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    print(f"VAPID_PUBLIC_KEY={b64url(public_bytes)}")
    print(f"VAPID_PRIVATE_KEY={b64url(private_scalar)}")
    print("VAPID_SUBJECT=mailto:admin@senpaiai.local")


if __name__ == "__main__":
    main()
