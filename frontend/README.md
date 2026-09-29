# Мой дом — frontend

Интерфейс мини-приложения MAX для жителей и сотрудников УК. Он отправляет запросы на Django API через встроенный proxy Next.js.

## Запуск локально

Нужен Node.js 20+ и запущенный backend на порту `8000`.

```bash
cp .env.example .env.local
# В .env.local укажите BACKEND_URL — адрес backend API, без завершающего /
npm ci
npm run dev
```

Откройте `http://localhost:3000`. Адрес backend обязательно задаётся переменной `BACKEND_URL` в `.env.local`; для локального запуска это `http://localhost:8000`. При запуске frontend в Docker укажите адрес, доступный из контейнера, например `http://host.docker.internal:8000`:

```bash
docker build -t my-dom-frontend .
docker run --rm -p 3000:3000 -e BACKEND_URL=http://host.docker.internal:8000 my-dom-frontend
```

Для подключения к MAX frontend должен быть опубликован по HTTPS и привязан к чат-боту. Не добавляйте `.env.local` в архив или репозиторий.

## Проверки

```bash
npm test
npm run lint
```
