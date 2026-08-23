# ТЗ для агента репозитория BMGBRAND (сайт booomerangs.ru)

> **СТАТУС: ВЫПОЛНЕНО ✅ (2026-08-23).** Агент сайта внедрил все три задачи + дополнительно
> 6 инструментов (`get_product_detail`, `get_order_detail`, `search_clients_by_orders`,
> `get_abandoned_carts`, `get_revenue_by_period`, `export_orders_csv`) и провёл рефакторинг:
> вся логика вынесена в новый модуль `server/admin-tools.ts` (~650 строк),
> `server/admin-agent.ts` остался тонкой прослойкой с SYSTEM_PROMPT. Проверено:
> коммит `8365fa4` в main, все инструменты на месте и описаны в SYSTEM_PROMPT.
> Приложение подключило новые возможности через быстрые действия на главной.
> Этот документ оставлен как образец формата передачи задач между агентами.

> Документ подготовлен агентом приложения **AdminBMG** для агента, работающего с репозиторием
> сайта `https://github.com/misha4323223/BMGBRAND`. Всё ниже — изменения ТОЛЬКО на сервере сайта.

## Контекст: зачем это всё

Существует мобильное/десктопное приложение **AdminBMG** (отдельный репозиторий) — клиент управления
магазином, повторяющий веб-админку 1-в-1 через те же API (`x-api-key`). В приложении на главной
экране живёт чат с AI-агентом «BOOOM AI», который вызывает серверные инструменты из
`server/admin-agent.ts` (`/api/admin/agent/chat`).

**Проблема:** агент сейчас умеет только одиночные операции (`get_orders`, `search_products`,
`update_product`…) и не понимает аналитические и массовые запросы администратора:

- «на какую сумму заказали мерч людмил огурченко?» → «не удалось распознать команду»;
- «скрой все товары без SEO» → нечем выполнить массово;
- «кто наши лучшие клиенты?» → инструмента нет.

**Цель:** научить агента понимать естественную речь в трёх новых сценариях — анализ продаж,
клиенты, массовые операции с товарами. Приложение уже готово к этому: write-инструменты показывают
администратору кнопку «Выполнить» (подтверждение), поэтому массовые операции безопасны.

---

## Задача 1 (приоритет, ранее уже передавалось): инструмент `analyze_orders`

**Файл:** `server/admin-agent.ts`

### 1.1. В `SYSTEM_PROMPT`, секция «ИНСТРУМЕНТЫ ЧТЕНИЯ», после строки про `get_orders` добавить:

```
- analyze_orders — анализ продаж по названию товара: возвращает сумму и количество проданного, разбивку по позициям. params: { search?: string, dateFrom?: string (ISO), dateTo?: string (ISO) }. search — название товара или его часть (например "людмил огурченко"). Используй для любых вопросов вида «на какую сумму заказали/купили X», «сколько продалось X», «выручка по товару Y».
```

### 1.2. В `executeReadTool(...)`, перед `case "get_promo_codes":` добавить:

```ts
    case "analyze_orders": {
      const qRaw = String(params.search || "").toLowerCase().trim();
      const tokens = qRaw ? qRaw.split(/\s+/).filter(Boolean) : [];
      let orders = (await storage.getOrders()) as any[];
      orders = orders.filter(
        (o: any) => !o.isDraft && o.status !== "cancelled" && Array.isArray(o.items)
      );
      if (params.dateFrom || params.dateTo) {
        orders = orders.filter((o: any) => {
          if (!o.createdAt) return false;
          const d = new Date(o.createdAt);
          if (params.dateFrom && d < new Date(params.dateFrom)) return false;
          if (params.dateTo && d > new Date(params.dateTo)) return false;
          return true;
        });
      }
      const agg = new Map<string, { name: string; qty: number; amount: number }>();
      let totalAmount = 0;
      let totalQty = 0;
      const orderIds = new Set<number>();
      for (const o of orders) {
        for (const it of o.items as any[]) {
          const name = String(it.name ?? it.productName ?? "").trim();
          if (!name) continue;
          const lname = name.toLowerCase();
          if (tokens.length && !tokens.every((t) => lname.includes(t))) continue;
          const qtyN = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
          const amount = (Number(it.price) || 0) * qtyN;
          totalAmount += amount;
          totalQty += qtyN;
          orderIds.add(o.id);
          const cur = agg.get(lname) || { name, qty: 0, amount: 0 };
          cur.qty += qtyN;
          cur.amount += amount;
          agg.set(lname, cur);
        }
      }
      const rubFmt = (k: number) => Math.round(k / 100).toLocaleString("ru-RU") + " ₽";
      if (qRaw && !agg.size)
        return `Продаж по запросу «${qRaw}» не найдено (${orders.length} заказов проанализировано).`;
      const lines: string[] = [
        qRaw
          ? `📊 «${qRaw}»: продано на ${rubFmt(totalAmount)} — ${totalQty} шт., в ${orderIds.size} заказ(ах).`
          : `📊 Продано всего на ${rubFmt(totalAmount)} — ${totalQty} позиций, ${orderIds.size} заказ(ов).`,
      ];
      const top = [...agg.values()].sort((a, b) => b.amount - a.amount).slice(0, 10);
      for (const t of top) lines.push(`• ${t.name} — ${t.qty} шт. на ${rubFmt(t.amount)}`);
      if (agg.size > top.length) lines.push(`…и ещё ${agg.size - top.length} поз.`);
      return lines.join("\n");
    }
```

Проверить, внедрён ли уже: `grep -n "analyze_orders" server/admin-agent.ts`.

---

## Задача 2: инструмент чтения `get_clients`

**Файл:** `server/admin-agent.ts`. Даёт агенту доступ к базе клиентов (топ по LTV, сегменты).
Источник данных уже существует: `storage.getUsersWithLoyalty()` → `{ id, name, email, totalSpent, loyaltyDiscount }`.

### 2.1. В `SYSTEM_PROMPT`, секция «ИНСТРУМЕНТЫ ЧТЕНИЯ», добавить строку:

```
- get_clients — список клиентов магазина. params: { top?: number, search?: string }. top — сколько клиентов вернуть, отсортированных по сумме покупок (по умолчанию 10). search — фильтр по имени/email. Используй для вопросов «кто лучшие клиенты», «найди клиента Имя», «топ покупателей».
```

### 2.2. В `executeReadTool(...)` добавить кейс:

```ts
    case "get_clients": {
      const users = (await storage.getUsersWithLoyalty()) as any[];
      const q = String(params.search || "").toLowerCase().trim();
      let list = users;
      if (q)
        list = list.filter(
          (u: any) =>
            u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
        );
      list = [...list].sort((a: any, b: any) => (b.totalSpent || 0) - (a.totalSpent || 0));
      const top = list.slice(0, Math.min(Number(params.top) || 10, 50));
      if (!top.length) return "Клиенты по запросу не найдены.";
      const rubFmt = (k: number) => Math.round((k || 0) / 100).toLocaleString("ru-RU") + " ₽";
      return (
        `Клиенты (${list.length}, показано ${top.length}, по сумме покупок):\n` +
        top
          .map(
            (u: any, i: number) =>
              `${i + 1}. ${u.name || "—"} (${u.email}) — купил(а) на ${rubFmt(u.totalSpent)}${
                u.loyaltyDiscount ? `, скидка лояльности ${u.loyaltyDiscount}%` : ""
              }`
          )
          .join("\n")
      );
    }
```

---

## Задача 3: инструмент изменений `bulk_update_products` (массовые операции)

**Файл:** `server/admin-agent.ts`. Позволяет агенту выполнять массовые правки товаров.
Это WRITE-инструмент — подтверждение администратора уже встроено в протокол (`type:"write"`),
ничего дополнительно делать не нужно.

### 3.1. В `SYSTEM_PROMPT`, секция «ИНСТРУМЕНТЫ ИЗМЕНЕНИЙ», после `update_product` добавить:

```
- bulk_update_products — массовое обновление товаров по фильтру или списку ID. ЦЕНЫ В КОПЕЙКАХ (как в update_product).
  params: { ids?: number[], filter?: { category?, subcategory?, isHidden?, missingSeo?: boolean }, fields: {...те же поля, что в update_product...}, limit?: number }
  Правила: указывай ЛИБО ids, ЛИБО filter (можно оба). filter.missingSeo=true — только товары без seoTitle/seoDescription.
  limit ограничивает число товаров (по умолчанию 50, максимум 200). Обязательно подробно описывай в description, какие товары и поля изменятся.
  Примеры: «подними цены на мерч Дикая мята на 10%» → filter:{category:"Мерч",subcategory:"ДИКАЯ МЯТА"}, fields:{price: ...};
  «заполни SEO всем товарам без SEO» → filter:{missingSeo:true}, fields:{seoTitle, seoDescription}.
```

### 3.2. В `executeWriteTool(...)` добавить кейс:

```ts
    case "bulk_update_products": {
      let all = (await storage.getAllProductsForAdmin()) as any[];
      const f = params.filter || {};
      if (Array.isArray(params.ids)) {
        const idSet = new Set(params.ids.map(Number));
        all = all.filter((p: any) => idSet.has(p.id));
      }
      if (f.category)
        all = all.filter(
          (p: any) => String(p.category || "").toLowerCase() === String(f.category).toLowerCase()
        );
      if (f.subcategory)
        all = all.filter(
          (p: any) =>
            String(p.subcategory || "").toLowerCase() === String(f.subcategory).toLowerCase()
        );
      if (f.isHidden === true) all = all.filter((p: any) => p.isHidden);
      if (f.isHidden === false) all = all.filter((p: any) => !p.isHidden);
      if (f.missingSeo) all = all.filter((p: any) => !p.seoTitle || !p.seoDescription);
      if (!all.length) return "Товары по заданному фильтру не найдены.";
      const capped = all.slice(0, Math.max(1, Math.min(Number(params.limit) || 50, 200)));
      for (const p of capped) await storage.updateProduct(p.id, params.fields);
      const preview = capped
        .slice(0, 5)
        .map((p: any) => `[ID: ${p.id}] ${p.name}`)
        .join("; ");
      return `✅ Массово обновлено ${capped.length} товар(ов). Изменённые поля: ${Object.keys(
        params.fields || {}
      ).join(", ")}. Примеры: ${preview}${capped.length > 5 ? "; …" : ""}`;
    }
```

---

## Шаги проверки (после деплоя сайта)

В админке (`/admin/agent/chat`) спросить по очереди:

1. «на сколько продалось мерч людмил огурченко» → ответ вида `📊 «людмил огурченко»: продано на N ₽ — M шт., в K заказ(ах)` + топ позиций.
2. «кто наши лучшие клиенты?» → топ-10 по сумме покупок.
3. «сколько товаров без SEO? заполни им SEO» → сначала write-действие с описанием, после подтверждения — массовое обновление.
4. Регресс: «создай промокод TEST20 на 20%» — старые сценарии должны работать как раньше.

## Что НЕ входит в это ТЗ

Утреннее резюме, поиск проблем («товары без SEO», «заказы висят больше 3 дней») и локальная
аналитика продаж уже реализованы НА СТОРОНЕ ПРИЛОЖЕНИЯ AdminBMG без участия сервера — их делать
на сайте не нужно.
