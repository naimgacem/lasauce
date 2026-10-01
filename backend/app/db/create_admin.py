"""Grant administrator access from the command line.

The admin console can promote users, but something has to promote the first
one. This is that something — and deliberately the *only* path to an admin
role that does not go through an existing admin, so it runs with shell access
to the server rather than over HTTP.

Usage:

    # Promote an account that already exists (the usual case: sign up, then run)
    docker compose exec api python -m app.db.create_admin you@example.com

    # Create the account outright. The password is read from ADMIN_PASSWORD, or
    # prompted for when a terminal is attached.
    docker compose exec api python -m app.db.create_admin you@example.com \\
        --create --name "Your Name"

Idempotent: promoting an existing admin changes nothing and writes nothing.
Every change is written to the audit log with the actor recorded as `cli`.
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import os
import sys

from pydantic import EmailStr, TypeAdapter, ValidationError

from app.core.logging import configure_logging, get_logger
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal, dispose_engine
from app.models.admin_action import AdminActionType, AdminTargetType
from app.models.user import UserRole, UserStatus
from app.repositories.admin import AdminActionRepository
from app.repositories.user import UserRepository

logger = get_logger(__name__)

CLI_ACTOR = "cli"
MIN_PASSWORD_LENGTH = 8


def _read_password() -> str:
    password = os.environ.get("ADMIN_PASSWORD")
    if password is None:
        if not sys.stdin.isatty():
            sys.exit("Set ADMIN_PASSWORD, or run with a terminal attached (docker compose exec).")
        password = getpass.getpass("Password: ")
        if getpass.getpass("Repeat password: ") != password:
            sys.exit("Passwords do not match.")
    if len(password) < MIN_PASSWORD_LENGTH:
        sys.exit(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
    return password


async def run(email: str, *, create: bool, name: str | None) -> str:
    async with AsyncSessionLocal() as session:
        users = UserRepository(session)
        audit = AdminActionRepository(session)
        user = await users.get_by_email(email)

        if user is None:
            if not create:
                sys.exit(f"No account for {email}. Sign up first, or pass --create --name.")
            if not name:
                sys.exit("--create needs --name.")
            user = await users.create(
                email=email,
                password_hash=hash_password(_read_password()),
                full_name=name,
                role=UserRole.admin,
                #  Created by someone with shell access to the server; there is
                #  no inbox round-trip that would prove anything further.
                is_verified=True,
            )
            audit.record(
                admin=None,
                actor_email=CLI_ACTOR,
                action=AdminActionType.change_role,
                target_type=AdminTargetType.user,
                target_id=user.id,
                target_label=f"{user.full_name} <{user.email}>",
                reason="Administrator account created from the command line",
                details={"role": {"from": None, "to": UserRole.admin.value}, "created": True},
            )
            await session.commit()
            return f"Created administrator {email}."

        if user.status != UserStatus.active:
            sys.exit(f"{email} is {user.status.value}. Reactivate it before promoting it.")
        if user.role == UserRole.admin:
            return f"{email} is already an administrator. Nothing to do."

        previous = user.role
        user.role = UserRole.admin
        audit.record(
            admin=None,
            actor_email=CLI_ACTOR,
            action=AdminActionType.change_role,
            target_type=AdminTargetType.user,
            target_id=user.id,
            target_label=f"{user.full_name} <{user.email}>",
            reason="Promoted from the command line",
            details={"role": {"from": previous.value, "to": UserRole.admin.value}},
        )
        await session.commit()
        return f"Promoted {email} to administrator."


def main() -> None:
    parser = argparse.ArgumentParser(description="Grant administrator access.")
    parser.add_argument("email")
    parser.add_argument("--create", action="store_true", help="create the account if missing")
    parser.add_argument("--name", help="full name, required with --create")
    args = parser.parse_args()

    try:
        email = TypeAdapter(EmailStr).validate_python(args.email).lower()
    except ValidationError:
        sys.exit(f"Not a valid email address: {args.email}")

    configure_logging()

    async def _main() -> str:
        try:
            return await run(email, create=args.create, name=args.name)
        finally:
            await dispose_engine()

    print(asyncio.run(_main()))


if __name__ == "__main__":
    main()
