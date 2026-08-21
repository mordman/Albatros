АЛЬБАТРОС — запуск локально, без интернета
==========================================

1) Единственная внешняя зависимость — three.js. Положите файл один раз:
   vendor/three.module.js
   Откуда (при первом скачивании нужен интернет, дальше — офлайн):
   - https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js
     (открыть в браузере и «Сохранить как» в папку vendor/)
   - или: curl -L -o vendor/three.module.js https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js
   - или из node_modules после `npm i three` (файл build/three.module.js).

2) Запуск: ES-модули не работают по file://, нужен любой статик-сервер.
   Windows: двойной клик по start.bat (нужен Python)
   Linux/macOS: sh start.sh
   Альтернативы: `npx serve .`, VS Code + расширение Live Server.
   Открыть http://localhost:8000

3) Управление: W/S — высота/газ/погружение/тормоз, A/D — поворот,
   SHIFT — форсаж, V — пересадка (гидроплан → катер → батискаф → мотоцикл),
   B — показать коллизион-боксы, ESC — пауза.