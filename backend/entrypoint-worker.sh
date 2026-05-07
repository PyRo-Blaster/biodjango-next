#!/bin/sh
set -e

if [ "$SQL_ENGINE" = "django.db.backends.postgresql" ]
then
    echo "Waiting for postgres at $SQL_HOST:$SQL_PORT..."

    while ! nc -z "$SQL_HOST" "$SQL_PORT"; do
      sleep 0.5
    done

    echo "PostgreSQL ready"
fi

exec "$@"
