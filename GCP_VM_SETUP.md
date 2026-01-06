# Setup VM GCP (e2-micro) per poller 15s + backend + frontend

Questa guida configura una sola VM con:
- poller Tuya ogni 15s
- backend Express
- frontend Next.js
- reverse proxy Nginx

## 1) VM + bucket

- Crea una VM Compute Engine `e2-micro` (Ubuntu LTS).
- Crea un bucket GCS `tuya-logs-<project>`.
- Crea un Service Account con ruolo `Storage Object Admin` (o `Object Creator`) e assegnalo alla VM.

## 2) Installazioni base

```bash
sudo apt update
sudo apt install -y git nodejs npm nginx google-cloud-cli
```

Se vuoi Node recente, installa `nvm`.

## 3) Clona repo e configura `.env`

```bash
git clone <repo>
cd tuya-switch
cp .env.example .env
```

Aggiungi anche:
```
GCS_BUCKET=tuya-logs-<project>
BACKEND_URL=http://localhost:3000
```

## 4) Build frontend

```bash
npm install
npm run build:web
```

## 5) Systemd services

### Backend (Express)

`/etc/systemd/system/tuya-backend.service`
```ini
[Unit]
Description=Tuya Backend (Express)
After=network.target

[Service]
WorkingDirectory=/home/<user>/tuya-switch
ExecStart=/usr/bin/node server.cjs
Restart=always
RestartSec=5
EnvironmentFile=/home/<user>/tuya-switch/.env

[Install]
WantedBy=multi-user.target
```

### Frontend (Next.js)

`/etc/systemd/system/tuya-frontend.service`
```ini
[Unit]
Description=Tuya Frontend (Next.js)
After=network.target

[Service]
WorkingDirectory=/home/<user>/tuya-switch
ExecStart=/usr/bin/npm run start:web
Restart=always
RestartSec=5
EnvironmentFile=/home/<user>/tuya-switch/.env

[Install]
WantedBy=multi-user.target
```

### Poller 15s

`/etc/systemd/system/tuya-poller.service`
```ini
[Unit]
Description=Tuya Poller 15s
After=network.target

[Service]
WorkingDirectory=/home/<user>/tuya-switch
ExecStart=/usr/bin/node public/tuya-logs.cjs
Restart=always
RestartSec=5
EnvironmentFile=/home/<user>/tuya-switch/.env

[Install]
WantedBy=multi-user.target
```

Avvio servizi:
```bash
sudo systemctl daemon-reload
sudo systemctl enable tuya-backend tuya-frontend tuya-poller
sudo systemctl start tuya-backend tuya-frontend tuya-poller
sudo systemctl status tuya-backend
sudo systemctl status tuya-frontend
sudo systemctl status tuya-poller
```

## 6) Nginx reverse proxy (porta 80)

`/etc/nginx/sites-available/tuya`
```nginx
server {
  listen 80;
  server_name _;

  location /api/ {
    proxy_pass http://localhost:3000;
  }

  location / {
    proxy_pass http://localhost:3001;
  }
}
```

Abilita:
```bash
sudo ln -s /etc/nginx/sites-available/tuya /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 7) URL finali

- Dashboard: `http://<VM-IP>/`
- API: `http://<VM-IP>/api/logs/<YYYY-MM-DD>`

## 8) (Opzionale) Upload su GCS

Se vuoi persistenza su GCS, aggiungi upload periodico nel poller.
