FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt
COPY backend/ backend/
COPY --from=frontend /app/frontend/dist frontend/dist
WORKDIR /app/backend
RUN DJANGO_SECRET_KEY=build-only MANDATE_SIGNING_KEY=build-only python manage.py collectstatic --noinput
EXPOSE 10000
CMD ["sh", "-c", "python manage.py migrate --noinput && (python manage.py maintain_orders || echo 'maintain_orders skipped') && (python manage.py purge_demo_users || echo 'purge_demo_users skipped') && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-10000} --worker-class gthread --workers 1 --threads 8 --timeout 120"]
