# Мой дом — backend

Django API для мини-приложения MAX. В Docker используется SQLite; данные сохраняются в папке `data/` рядом с `docker-compose.yml`.

## Запуск

Нужен Docker с Compose. Создайте файл окружения и задайте безопасный `SECRET_KEY`:

```bash
cp .env.example .env
docker compose up --build -d
```

API доступен по `http://localhost:8000`, Django admin — по `http://localhost:8000/admin/`. При первом запуске миграции и статика применяются автоматически.

Для демонстрационного сценария создайте тестовые сущности:

```bash
docker compose exec web python manage.py load_demo
```

Остановить: `docker compose down`. Повторный запуск: `docker compose up -d`. Файл `.env` содержит секреты и не должен попадать в архив или репозиторий. Токен MAX и ключи внешних сервисов в `.env.example` оставлены как примеры: для базового локального сценария они не нужны.

## Материалы проверки

- `DOCS/api.yaml` — спецификация OpenAPI;
- `DOCS/DATA-api.yaml` — обязательные проверки API;
- `DOCS/seed.json` — тестовые данные;
- `apihandler/tests/` — автотесты Django.

Запуск тестов внутри запущенного контейнера:

```bash
docker compose exec web python manage.py test
```
