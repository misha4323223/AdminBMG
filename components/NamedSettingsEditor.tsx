import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Accordion } from "@/components/Accordion";
import { SchemaEditor, humanizeLabel } from "@/components/SchemaEditor";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { Badge, Button, Field } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";

type SettingsKind = "navbar" | "footer" | "site_config";
type SettingsRecord = Record<string, unknown>;

const TOP_LEVEL_LABELS: Record<SettingsKind, Record<string, string>> = {
  navbar: {
    navbar_data: "Настройки шапки",
    logo: "Логотип и бренд",
    logoText: "Логотип и бренд",
    links: "Навигационные ссылки",
    actions: "Кнопки и действия",
    showSearch: "Поиск",
    showCart: "Корзина",
    showUser: "Аккаунт",
    showBackButton: "Кнопка назад",
    settings: "Настройки навигации",
  },
  footer: {
    footer_data: "Настройки подвала",
    logo: "Логотип и описание",
    logoText: "Логотип и описание",
    columns: "Навигационные колонки",
    links: "Ссылки футера",
    socialLinks: "Социальные сети",
    contacts: "Контакты",
    legal: "Юридическая информация",
    copyright: "Нижняя строка",
    settings: "Настройки футера",
  },
  site_config: {
    brand: "Бренд",
    contacts: "Контакты",
    socials: "Социальные сети",
    seo: "SEO сайта",
    analytics: "Аналитика и счётчики",
    integrations: "Интеграции",
    theme: "Тема и цвета",
    features: "Функции сайта",
    settings: "Общие настройки",
  },
};

const KIND_LABELS: Record<SettingsKind, string> = {
  navbar: "навигации",
  footer: "футера",
  site_config: "сайта",
};

const NAVBAR_STYLE_OPTIONS: SelectOption[] = [
  { value: "pill", label: "Капсула — плавающая скруглённая панель" },
  { value: "classic", label: "Классика — полная ширина с тенью" },
  { value: "transparent", label: "Прозрачная — фон с размытием" },
  { value: "minimal", label: "Минимал — тонкая линия снизу" },
];

const NAVBAR_WIDTH_OPTIONS: SelectOption[] = [
  { value: "max-w-3xl", label: "Узкий (768px)" },
  { value: "max-w-4xl", label: "Средний (896px)" },
  { value: "max-w-5xl", label: "Широкий (1024px)" },
  { value: "max-w-6xl", label: "Очень широкий (1152px)" },
  { value: "max-w-full", label: "Полная ширина" },
];

const NAVBAR_POSITION_OPTIONS: SelectOption[] = [
  { value: "floating", label: "Плавающая с отступом" },
  { value: "fixed-top", label: "Фиксированная сверху" },
];

const FOOTER_STYLE_OPTIONS: SelectOption[] = [
  { value: "classic", label: "Классический — логотип слева, колонки справа" },
  { value: "minimal", label: "Минимальный — компактная строка" },
  { value: "centered", label: "Центрированный — всё по центру" },
];

const FOOTER_COLOR_OPTIONS: SelectOption[] = [
  { value: "dark", label: "Тёмный фон" },
  { value: "light", label: "Светлый фон" },
  { value: "brand", label: "Фирменный акцентный фон" },
];

const SOCIAL_OPTIONS: SelectOption[] = [
  { value: "vk", label: "ВКонтакте" },
  { value: "telegram", label: "Telegram" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "whatsapp", label: "WhatsApp" },
];

function recordOf(value: unknown): SettingsRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SettingsRecord)
    : {};
}

function recordsOf(value: unknown): SettingsRecord[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => recordOf(item));
}

function textOf(record: SettingsRecord, key: string, fallback = ""): string {
  const value = record[key];
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function boolOf(record: SettingsRecord, key: string, fallback = false): boolean {
  return typeof record[key] === "boolean" ? (record[key] as boolean) : fallback;
}

function updateRecord(
  record: SettingsRecord,
  onChange: (next: SettingsRecord) => void,
  key: string,
  value: unknown,
) {
  onChange({ ...record, [key]: value });
}

export function NamedSettingsEditor({
  kind,
  sectionKey,
  value,
  onChange,
}: {
  kind: SettingsKind;
  sectionKey?: string;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return <SchemaEditor value={value} onChange={onChange} rootLabel={`Настройки ${KIND_LABELS[kind]}`} />;
  }

  const record = recordOf(value);
  if (kind === "navbar" && isNavbarSettings(record)) {
    return <NavbarSettingsForm value={record} onChange={onChange} />;
  }
  if (kind === "footer" && isFooterSettings(record)) {
    return <FooterSettingsForm value={record} onChange={onChange} />;
  }
  if (kind === "site_config" && (sectionKey === "categories_data" || isCategoryMap(record))) {
    return <CategoryTreeEditor value={record} onChange={onChange} />;
  }

  return <NamedGroupsEditor kind={kind} value={record} onChange={onChange} />;
}

function isNavbarSettings(record: SettingsRecord): boolean {
  return [
    "logoText",
    "logoAccentText",
    "links",
    "style",
    "showSearch",
    "showCart",
    "showUser",
    "showBackButton",
    "maxWidth",
    "position",
  ].some((key) => key in record);
}

function isFooterSettings(record: SettingsRecord): boolean {
  return [
    "style",
    "colorScheme",
    "logoText",
    "description",
    "socialLinks",
    "columns",
    "copyrightText",
    "creditText",
    "showPrivacyLink",
    "showTermsLink",
  ].some((key) => key in record);
}

function isCategoryMap(record: SettingsRecord): boolean {
  const entries = Object.entries(record);
  return entries.length > 0 && entries.every(([, item]) => {
    const category = recordOf(item);
    return typeof category.name === "string" && Array.isArray(category.subcategories);
  });
}

function categorySlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 80);
}

function CategoryTreeEditor({
  value,
  onChange,
}: {
  value: SettingsRecord;
  onChange: (next: SettingsRecord) => void;
}) {
  const [newSlug, setNewSlug] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [error, setError] = React.useState("");
  const entries = Object.entries(value);

  const addCategory = () => {
    const slug = categorySlug(newSlug.trim());
    const name = newName.trim();
    if (!slug || !name) {
      setError("Для новой категории заполните slug и название");
      return;
    }
    if (value[slug]) {
      setError("Категория с таким slug уже существует");
      return;
    }
    onChange({ ...value, [slug]: { name, slug, subcategories: [] } });
    setNewSlug("");
    setNewName("");
    setError("");
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        Дерево каталога из site_config.categories_data. Названия показываются на сайте, а slug используется в URL и сохраняется отдельно.
      </Text>
      <Accordion title="Добавить категорию" icon="add-circle-outline">
        <Field
          label="Slug категории"
          value={newSlug}
          onChangeText={(text) => setNewSlug(categorySlug(text))}
          autoCapitalize="none"
          placeholder="new-category"
        />
        <Field label="Название категории" value={newName} onChangeText={setNewName} placeholder="Новая категория" />
        <Button title="Добавить категорию" onPress={addCategory} icon="add" />
        {error ? <Text style={styles.categoryError}>{error}</Text> : null}
      </Accordion>
      {entries.length === 0 ? <Text style={styles.empty}>Категорий пока нет</Text> : null}
      {entries.map(([slug, rawCategory]) => (
        <CategoryNode
          key={slug}
          slug={slug}
          value={recordOf(rawCategory)}
          onChange={(next) => onChange({ ...value, [slug]: next })}
          onDelete={() => {
            const next = { ...value };
            delete next[slug];
            onChange(next);
          }}
        />
      ))}
    </View>
  );
}

function CategoryNode({
  slug,
  value,
  onChange,
  onDelete,
}: {
  slug: string;
  value: SettingsRecord;
  onChange: (next: SettingsRecord) => void;
  onDelete: () => void;
}) {
  const subcategories = recordsOf(value.subcategories);
  const updateSubcategories = (next: SettingsRecord[]) => onChange({ ...value, subcategories: next });

  return (
    <Accordion
      title={textOf(value, "name", slug)}
      icon="folder-open-outline"
      badge={<Badge tone="neutral">{slug}</Badge>}
    >
      <Field label="Название категории" value={textOf(value, "name", slug)} onChangeText={(text) => onChange({ ...value, name: text })} />
      <Field label="Slug (идентификатор)" value={slug} editable={false} autoCapitalize="none" />
      <Text style={styles.treeLabel}>Подкатегории</Text>
      {subcategories.map((subcategory, index) => (
        <SubcategoryNode
          key={index}
          value={subcategory}
          onChange={(next) => updateSubcategories(subcategories.map((item, i) => (i === index ? next : item)))}
          onDelete={() => updateSubcategories(subcategories.filter((_, i) => i !== index))}
        />
      ))}
      <View style={styles.treeActions}>
        <Button
          title="Добавить подкатегорию"
          variant="secondary"
          icon="add"
          onPress={() => updateSubcategories([...subcategories, { name: "Новая подкатегория", slug: "" }])}
        />
        <Button title="Удалить категорию" variant="danger" icon="trash-outline" onPress={onDelete} />
      </View>
    </Accordion>
  );
}

function SubcategoryNode({
  value,
  onChange,
  onDelete,
}: {
  value: SettingsRecord;
  onChange: (next: SettingsRecord) => void;
  onDelete: () => void;
}) {
  const subSubcategories = recordsOf(value.subSubcategories);

  return (
    <Accordion
      title={textOf(value, "name", "Новая подкатегория")}
      icon="list-outline"
      badge={<Badge tone="neutral">{subSubcategories.length} подподкатегорий</Badge>}
    >
      <Field label="Название подкатегории" value={textOf(value, "name")} onChangeText={(text) => onChange({ ...value, name: text })} />
      <Field label="Slug подкатегории" value={textOf(value, "slug")} onChangeText={(text) => onChange({ ...value, slug: categorySlug(text) })} autoCapitalize="none" placeholder="slug" />
      <Text style={styles.treeLabel}>Под-подкатегории (3-й уровень)</Text>
      {subSubcategories.map((subSubcategory, index) => (
        <View key={index} style={styles.subSubRow}>
          <View style={styles.flex1}>
            <Field label="Название" value={textOf(subSubcategory, "name")} onChangeText={(text) => {
              const next = subSubcategories.map((item, i) => (i === index ? { ...item, name: text } : item));
              onChange({ ...value, subSubcategories: next });
            }} />
          </View>
          <View style={styles.flex1}>
            <Field label="Slug" value={textOf(subSubcategory, "slug")} onChangeText={(text) => {
              const next = subSubcategories.map((item, i) => (i === index ? { ...item, slug: categorySlug(text) } : item));
              onChange({ ...value, subSubcategories: next });
            }} autoCapitalize="none" />
          </View>
          <Button title="Удалить" variant="danger" icon="trash-outline" onPress={() => onChange({ ...value, subSubcategories: subSubcategories.filter((_, i) => i !== index) })} />
        </View>
      ))}
      <View style={styles.treeActions}>
        <Button
          title="Добавить под-подкатегорию"
          variant="secondary"
          icon="add"
          onPress={() => onChange({ ...value, subSubcategories: [...subSubcategories, { name: "Новая под-подкатегория", slug: "" }] })}
        />
        <Button title="Удалить подкатегорию" variant="danger" icon="trash-outline" onPress={onDelete} />
      </View>
    </Accordion>
  );
}

function NavbarSettingsForm({
  value,
  onChange,
}: {
  value: SettingsRecord;
  onChange: (next: SettingsRecord) => void;
}) {
  const links = recordsOf(value.links);
  const update = (key: string, next: unknown) => updateRecord(value, onChange, key, next);

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        Настройки шапки сайта как на веб-админке: поля разделены по смыслу, ссылки можно добавлять, удалять, менять местами и скрывать.
      </Text>

      <Accordion title="Логотип" icon="image-outline" defaultOpen>
        <View style={styles.fieldRow}>
          <View style={styles.flex1}>
            <Field
              label="Основной текст"
              value={textOf(value, "logoText", "BMG")}
              onChangeText={(text) => update("logoText", text)}
              placeholder="BMG"
            />
          </View>
          <View style={styles.flex1}>
            <Field
              label="Акцентный текст"
              value={textOf(value, "logoAccentText", "BRAND")}
              onChangeText={(text) => update("logoAccentText", text)}
              placeholder="BRAND"
            />
          </View>
        </View>
      </Accordion>

      <Accordion title="Стиль и расположение" icon="color-palette-outline">
        <SelectField
          label="Стиль шапки"
          value={textOf(value, "style", "pill")}
          options={withCurrent(NAVBAR_STYLE_OPTIONS, textOf(value, "style", "pill"))}
          allowEmpty={false}
          onChange={(next) => update("style", next)}
        />
        <SelectField
          label="Максимальная ширина"
          value={textOf(value, "maxWidth", "max-w-4xl")}
          options={withCurrent(NAVBAR_WIDTH_OPTIONS, textOf(value, "maxWidth", "max-w-4xl"))}
          allowEmpty={false}
          onChange={(next) => update("maxWidth", next)}
        />
        <SelectField
          label="Позиция"
          value={textOf(value, "position", "floating")}
          options={withCurrent(NAVBAR_POSITION_OPTIONS, textOf(value, "position", "floating"))}
          allowEmpty={false}
          onChange={(next) => update("position", next)}
        />
      </Accordion>

      <LinkList
        title="Навигационные ссылки"
        icon="link-outline"
        value={links}
        onChange={(next) => update("links", next)}
        addLabel="Добавить ссылку"
      />

      <Accordion title="Элементы шапки" icon="options-outline">
        <SwitchRow label="Показывать поиск" value={boolOf(value, "showSearch", true)} onChange={(next) => update("showSearch", next)} />
        <SwitchRow label="Показывать корзину" value={boolOf(value, "showCart", true)} onChange={(next) => update("showCart", next)} />
        <SwitchRow label="Показывать аккаунт" value={boolOf(value, "showUser", true)} onChange={(next) => update("showUser", next)} />
        <SwitchRow label="Показывать кнопку назад" value={boolOf(value, "showBackButton", true)} onChange={(next) => update("showBackButton", next)} />
      </Accordion>
    </View>
  );
}

function FooterSettingsForm({
  value,
  onChange,
}: {
  value: SettingsRecord;
  onChange: (next: SettingsRecord) => void;
}) {
  const socialLinks = recordsOf(value.socialLinks);
  const columns = recordsOf(value.columns);
  const update = (key: string, next: unknown) => updateRecord(value, onChange, key, next);

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        Настройки подвала сайта как на веб-админке: стиль, соцсети, колонки ссылок, юридические ссылки и кредит разработчика редактируются отдельно.
      </Text>

      <Accordion title="Стиль и цветовая схема" icon="color-palette-outline" defaultOpen>
        <SelectField
          label="Стиль футера"
          value={textOf(value, "style", "classic")}
          options={withCurrent(FOOTER_STYLE_OPTIONS, textOf(value, "style", "classic"))}
          allowEmpty={false}
          onChange={(next) => update("style", next)}
        />
        <SelectField
          label="Цветовая схема"
          value={textOf(value, "colorScheme", "dark")}
          options={withCurrent(FOOTER_COLOR_OPTIONS, textOf(value, "colorScheme", "dark"))}
          allowEmpty={false}
          onChange={(next) => update("colorScheme", next)}
        />
      </Accordion>

      <Accordion title="Логотип и описание" icon="image-outline">
        <View style={styles.fieldRow}>
          <View style={styles.flex1}>
            <Field
              label="Основной текст"
              value={textOf(value, "logoText", "BMG")}
              onChangeText={(text) => update("logoText", text)}
              placeholder="BMG"
            />
          </View>
          <View style={styles.flex1}>
            <Field
              label="Акцентный текст"
              value={textOf(value, "logoAccentText", "BRAND")}
              onChangeText={(text) => update("logoAccentText", text)}
              placeholder="BRAND"
            />
          </View>
        </View>
        <Field
          label="Описание"
          value={textOf(value, "description")}
          onChangeText={(text) => update("description", text)}
          placeholder="Описание бренда…"
          multiline
        />
      </Accordion>

      <SocialLinksEditor value={socialLinks} onChange={(next) => update("socialLinks", next)} />
      <FooterColumnsEditor value={columns} onChange={(next) => update("columns", next)} />

      <Accordion title="Нижняя строка" icon="reorder-three-outline">
        <Field
          label="Текст копирайта"
          value={textOf(value, "copyrightText")}
          onChangeText={(text) => update("copyrightText", text)}
          placeholder="Booomerangs"
        />
        <SwitchRow label="Показывать политику конфиденциальности" value={boolOf(value, "showPrivacyLink", true)} onChange={(next) => update("showPrivacyLink", next)} />
        {boolOf(value, "showPrivacyLink", true) ? (
          <Field
            label="Текст ссылки на политику"
            value={textOf(value, "privacyLinkText", "Политика конфиденциальности")}
            onChangeText={(text) => update("privacyLinkText", text)}
          />
        ) : null}
        <SwitchRow label="Показывать публичную оферту" value={boolOf(value, "showTermsLink", true)} onChange={(next) => update("showTermsLink", next)} />
        {boolOf(value, "showTermsLink", true) ? (
          <Field
            label="Текст ссылки на оферту"
            value={textOf(value, "termsLinkText", "Публичная оферта")}
            onChangeText={(text) => update("termsLinkText", text)}
          />
        ) : null}
      </Accordion>

      <Accordion title="Кредит разработчика" icon="link-outline">
        <Text style={styles.hint}>Текст и ссылка, которые отображаются под копирайтом.</Text>
        <View style={styles.fieldRow}>
          <View style={styles.flex1}>
            <Field label="Текст" value={textOf(value, "creditText")} onChangeText={(text) => update("creditText", text)} />
          </View>
          <View style={styles.flex1}>
            <Field label="Ссылка" value={textOf(value, "creditUrl")} onChangeText={(text) => update("creditUrl", text)} autoCapitalize="none" />
          </View>
        </View>
      </Accordion>
    </View>
  );
}

function SocialLinksEditor({
  value,
  onChange,
}: {
  value: SettingsRecord[];
  onChange: (next: SettingsRecord[]) => void;
}) {
  const updateItem = (index: number, key: string, next: unknown) => {
    const items = [...value];
    items[index] = { ...items[index], [key]: next };
    onChange(items);
  };

  return (
    <Accordion title="Социальные сети" icon="people-outline">
      {value.map((item, index) => (
        <Accordion
          key={index}
          title={textOf(item, "platform", `Соцсеть ${index + 1}`)}
          icon="link-outline"
          badge={<Badge tone={boolOf(item, "visible", true) ? "success" : "neutral"}>{boolOf(item, "visible", true) ? "видна" : "скрыта"}</Badge>}
        >
          <SelectField
            label="Платформа"
            value={textOf(item, "platform", "vk")}
            options={withCurrent(SOCIAL_OPTIONS, textOf(item, "platform", "vk"))}
            allowEmpty={false}
            onChange={(next) => updateItem(index, "platform", next)}
          />
          <Field label="URL" value={textOf(item, "url")} onChangeText={(text) => updateItem(index, "url", text)} autoCapitalize="none" placeholder="https://…" />
          <SwitchRow label="Показывать в футере" value={boolOf(item, "visible", true)} onChange={(next) => updateItem(index, "visible", next)} />
          <Button title="Удалить соцсеть" variant="danger" icon="trash-outline" onPress={() => onChange(value.filter((_, i) => i !== index))} />
        </Accordion>
      ))}
      <Button
        title="Добавить соцсеть"
        variant="secondary"
        icon="add"
        onPress={() => onChange([...value, { platform: "vk", url: "", visible: true }])}
      />
    </Accordion>
  );
}

function FooterColumnsEditor({
  value,
  onChange,
}: {
  value: SettingsRecord[];
  onChange: (next: SettingsRecord[]) => void;
}) {
  const updateColumn = (index: number, key: string, next: unknown) => {
    const columns = [...value];
    columns[index] = { ...columns[index], [key]: next };
    onChange(columns);
  };

  return (
    <Accordion title="Навигационные колонки" icon="albums-outline">
      {value.map((column, index) => (
        <Accordion
          key={index}
          title={textOf(column, "title", `Колонка ${index + 1}`)}
          icon="list-outline"
          badge={<Badge tone={boolOf(column, "visible", true) ? "success" : "neutral"}>{boolOf(column, "visible", true) ? "видна" : "скрыта"}</Badge>}
        >
          <Field label="Заголовок колонки" value={textOf(column, "title")} onChangeText={(text) => updateColumn(index, "title", text)} />
          <SwitchRow label="Показывать колонку" value={boolOf(column, "visible", true)} onChange={(next) => updateColumn(index, "visible", next)} />
          <LinkList
            title="Ссылки колонки"
            icon="link-outline"
            value={recordsOf(column.links)}
            onChange={(next) => updateColumn(index, "links", next)}
            addLabel="Добавить ссылку в колонку"
          />
          <Button title="Удалить колонку" variant="danger" icon="trash-outline" onPress={() => onChange(value.filter((_, i) => i !== index))} />
        </Accordion>
      ))}
      <Button
        title="Добавить колонку"
        variant="secondary"
        icon="add"
        onPress={() => onChange([...value, { title: "Новая колонка", visible: true, links: [] }])}
      />
    </Accordion>
  );
}

function LinkList({
  title,
  icon,
  value,
  onChange,
  addLabel,
}: {
  title: string;
  icon: "link-outline" | "albums-outline";
  value: SettingsRecord[];
  onChange: (next: SettingsRecord[]) => void;
  addLabel: string;
}) {
  const updateItem = (index: number, key: string, next: unknown) => {
    const items = [...value];
    items[index] = { ...items[index], [key]: next };
    onChange(items);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const items = [...value];
    [items[index], items[target]] = [items[target], items[index]];
    onChange(items);
  };

  return (
    <Accordion title={title} icon={icon}>
      {value.map((item, index) => (
        <Accordion
          key={index}
          title={textOf(item, "label", `Ссылка ${index + 1}`)}
          icon="link-outline"
          badge={<Badge tone={boolOf(item, "visible", true) ? "success" : "neutral"}>{boolOf(item, "visible", true) ? "видна" : "скрыта"}</Badge>}
        >
          <Field label="Название" value={textOf(item, "label")} onChangeText={(text) => updateItem(index, "label", text)} placeholder="Название ссылки" />
          <Field label="Адрес ссылки" value={textOf(item, "href")} onChangeText={(text) => updateItem(index, "href", text)} placeholder="/products" autoCapitalize="none" />
          <SwitchRow label="Показывать ссылку" value={boolOf(item, "visible", true)} onChange={(next) => updateItem(index, "visible", next)} />
          <View style={styles.buttonRow}>
            <Button title="Выше" variant="secondary" icon="arrow-up" onPress={() => move(index, -1)} disabled={index === 0} />
            <Button title="Ниже" variant="secondary" icon="arrow-down" onPress={() => move(index, 1)} disabled={index === value.length - 1} />
            <Button title="Удалить" variant="danger" icon="trash-outline" onPress={() => onChange(value.filter((_, i) => i !== index))} />
          </View>
        </Accordion>
      ))}
      <Button title={addLabel} variant="secondary" icon="add" onPress={() => onChange([...value, { label: "Новая ссылка", href: "/", visible: true }])} />
    </Accordion>
  );
}

function NamedGroupsEditor({
  kind,
  value,
  onChange,
}: {
  kind: SettingsKind;
  value: SettingsRecord;
  onChange: (next: SettingsRecord) => void;
}) {
  const labels = TOP_LEVEL_LABELS[kind];
  const entries = Object.entries(value);

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        Понятные группы настроек. Неизвестные поля сохранены и доступны внутри соответствующей секции.
      </Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>Настроек пока нет</Text>
      ) : (
        entries.map(([key, item], index) => (
          <Accordion
            key={key}
            title={labels[key] || humanizeLabel(key)}
            icon={iconFor(key)}
            defaultOpen={index === 0}
          >
            <SchemaEditor
              value={item}
              rootLabel={labels[key] || humanizeLabel(key)}
              onChange={(next) => onChange({ ...value, [key]: next })}
            />
          </Accordion>
        ))
      )}
    </View>
  );
}

function withCurrent(options: SelectOption[], value: string): SelectOption[] {
  return options.some((option) => option.value === value)
    ? options
    : value
      ? [{ value, label: value }, ...options]
      : options;
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <View style={styles.switchControls}>
        <Text style={styles.switchValue}>{value ? "Вкл" : "Выкл"}</Text>
        <Button
          title={value ? "Выключить" : "Включить"}
          variant={value ? "secondary" : "primary"}
          onPress={() => onChange(!value)}
        />
      </View>
    </View>
  );
}

function iconFor(key: string): "menu-outline" | "image-outline" | "link-outline" | "people-outline" | "settings-outline" | "color-palette-outline" | "analytics-outline" {
  if (/logo|brand|image|favicon/i.test(key)) return "image-outline";
  if (/link|menu|nav|column/i.test(key)) return "link-outline";
  if (/social|contact|legal|phone|email/i.test(key)) return "people-outline";
  if (/theme|color/i.test(key)) return "color-palette-outline";
  if (/analytic|counter|metric/i.test(key)) return "analytics-outline";
  return "settings-outline";
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 13, paddingVertical: spacing.lg },
  fieldRow: { flexDirection: "row", gap: spacing.sm },
  flex1: { flex: 1 },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  treeLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: spacing.sm },
  treeActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  subSubRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginBottom: spacing.sm },
  categoryError: { color: colors.danger, fontSize: 12, marginTop: spacing.sm },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  switchLabel: { color: colors.text, fontSize: 14, flex: 1 },
  switchControls: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  switchValue: { color: colors.textMuted, fontSize: 12 },
});
