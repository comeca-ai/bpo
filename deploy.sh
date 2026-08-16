#!/bin/bash
# Ajeita — deploy de 1 comando: puxa GitHub, instala, builda, reinicia
set -e
cd /opt/ajeita
git pull origin master
pnpm install --no-frozen-lockfile
pnpm build
systemctl restart ajeita
sleep 2
curl -s -o /dev/null -w "app: %{http_code}\n" -H 'Accept: text/html' http://127.0.0.1/
