import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Badge, Button, Card, Field, InlineError, LoadingView } from "@/components/ui";
import { apiDelete, apiGet, apiPatch, apiPost, getErrorMessage, uploadRawFile } from "@/lib/api";
import { colors, radius, spacing } from "@/constants/theme";

interface Track {
  id: number;
  title: string;
  subtitle?: string;
  audioUrl?: string;
  coverUrl?: string;
  duration?: number;
  trackOrder?: number;
  isActive?: boolean;
  plays?: number;
}

function formatDuration(sec?: number): string {
  const s = Number(sec) || 0;
  if (s <= 0) return "";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function ArtistTracksScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [order, setOrder] = useState("1");
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await apiGet<{ tracks?: Track[] }>(`/admin/artists/${slug}/tracks`);
      const list = (data.tracks || []).slice().sort(
        (a, b) => (Number(a.trackOrder) || 0) - (Number(b.trackOrder) || 0),
      );
      setTracks(list);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const pickAudio = async () => {
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploadingAudio(true);
      const url = await uploadRawFile(
        `/admin/artists/${slug}/upload-audio`,
        asset.uri,
        asset.name || `track_${Date.now()}.mp3`,
        asset.mimeType || "audio/mpeg",
      );
      setAudioUrl(url);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUploadingAudio(false);
    }
  };

  const pickCover = async () => {
    setError("");
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Нужен доступ к фото");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploadingCover(true);
      const url = await uploadRawFile(
        `/admin/artists/${slug}/upload-track-cover`,
        asset.uri,
        asset.fileName || `cover_${Date.now()}.jpg`,
      );
      setCoverUrl(url);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUploadingCover(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setSubtitle("");
    setAudioUrl("");
    setCoverUrl("");
    setOrder(String(tracks.length + 1));
    setFormOpen(false);
  };

  const addTrack = async () => {
    if (!title.trim() || !audioUrl.trim()) {
      setError("Укажите название и аудиофайл трека");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiPost(`/admin/artists/${slug}/tracks`, {
        title: title.trim(),
        subtitle: subtitle.trim(),
        audioUrl: audioUrl.trim(),
        coverUrl: coverUrl.trim(),
        trackOrder: Number(order.replace(",", ".")) || tracks.length + 1,
      });
      resetForm();
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (track: Track) => {
    setBusyId(track.id);
    setError("");
    try {
      await apiPatch(`/admin/artists/tracks/${track.id}`, { isActive: !track.isActive });
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const moveTrack = async (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= tracks.length) return;
    const a = tracks[idx];
    const b = tracks[to];
    setBusyId(a.id);
    setError("");
    try {
      const orderA = Number(a.trackOrder) || 0;
      const orderB = Number(b.trackOrder) || 0;
      const nextA = orderA === orderB ? to + 1 : orderB;
      const nextB = orderA === orderB ? idx + 1 : orderA;
      await apiPatch(`/admin/artists/tracks/${a.id}`, { trackOrder: nextA });
      await apiPatch(`/admin/artists/tracks/${b.id}`, { trackOrder: nextB });
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const removeTrack = async (track: Track) => {
    setBusyId(track.id);
    setError("");
    try {
      await apiDelete(`/admin/artists/tracks/${track.id}`);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async (track: Track, patch: Partial<Track>) => {
    setBusyId(track.id);
    setError("");
    try {
      await apiPatch(`/admin/artists/tracks/${track.id}`, patch);
      setEditingId(null);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <Screen title="Треки артиста" scroll={false}>
        <LoadingView />
      </Screen>
    );
  }

  return (
    <Screen title="Треки артиста" subtitle={slug} scroll={false}>
      <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
        <InlineError text={error} />

        {!formOpen ? (
          <Button title="Добавить трек" icon="add" onPress={() => setFormOpen(true)} />
        ) : (
          <Card style={styles.card}>
            <SectionTitleRow label="Новый трек" onClose={() => setFormOpen(false)} />
            <Field label="Название *" value={title} onChangeText={setTitle} />
            <Field label="Подзаголовок" value={subtitle} onChangeText={setSubtitle} />
            <Field label="Порядок (номер)" value={order} onChangeText={setOrder} keyboardType="numeric" />

            <Text style={styles.fieldLabel}>Аудиофайл *</Text>
            <View style={styles.fileRow}>
              <Button
                title={uploadingAudio ? "Загрузка…" : audioUrl ? "Заменить аудио" : "Выбрать аудио"}
                variant={audioUrl ? "secondary" : "primary"}
                onPress={pickAudio}
                disabled={uploadingAudio}
                icon="musical-notes-outline"
              />
            </View>
            {audioUrl ? (
              <Text style={styles.fileOk} numberOfLines={1}>
                ✓ Аудио загружено
              </Text>
            ) : (
              <Field
                label="…или вставьте ссылку на аудио"
                value={audioUrl}
                onChangeText={setAudioUrl}
                placeholder="https://…"
              />
            )}

            <Text style={styles.fieldLabel}>Обложка (необязательно)</Text>
            <View style={styles.fileRow}>
              <Button
                title={uploadingCover ? "Загрузка…" : coverUrl ? "Заменить обложку" : "Выбрать обложку"}
                variant="secondary"
                onPress={pickCover}
                disabled={uploadingCover}
                icon="image-outline"
              />
            </View>
            {coverUrl ? (
              <View style={styles.coverRow}>
                <Image source={{ uri: coverUrl }} style={styles.coverThumb} contentFit="cover" />
                <Text style={styles.fileOk} numberOfLines={1}>
                  ✓ Обложка загружена
                </Text>
              </View>
            ) : (
              <Field
                label="…или вставьте ссылку на обложку"
                value={coverUrl}
                onChangeText={setCoverUrl}
                placeholder="https://…"
              />
            )}

            <Button title="Сохранить трек" onPress={addTrack} loading={busy} icon="save-outline" />
          </Card>
        )}

        {tracks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              У артиста пока нет треков. Добавьте первый трек, чтобы он появился на странице артиста.
            </Text>
          </View>
        ) : (
          tracks.map((track, idx) => (
            <Card key={track.id} style={styles.card}>
              <View style={styles.trackHeader}>
                <View style={styles.trackLeft}>
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.trackTitles}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    {track.subtitle ? (
                      <Text style={styles.trackSub} numberOfLines={1}>
                        {track.subtitle}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Badge tone={track.isActive === false ? "neutral" : "success"}>
                  {track.isActive === false ? "Скрыт" : "Активен"}
                </Badge>
              </View>

              <View style={styles.trackMeta}>
                {track.duration ? (
                  <Text style={styles.metaText}>{formatDuration(track.duration)}</Text>
                ) : null}
                {track.plays ? <Text style={styles.metaText}>▶ {track.plays}</Text> : null}
              </View>

              {editingId === track.id ? (
                <View style={styles.editBox}>
                  <EditTrackForm
                    track={track}
                    busy={busyId === track.id}
                    onSave={(patch) => saveEdit(track, patch)}
                    onCancel={() => setEditingId(null)}
                  />
                </View>
              ) : null}

              <View style={styles.trackActions}>
                <Pressable
                  style={[styles.iconBtn, idx === 0 && styles.iconBtnDisabled]}
                  disabled={idx === 0 || busyId != null}
                  onPress={() => moveTrack(idx, -1)}
                  hitSlop={6}
                >
                  <Ionicons name="chevron-up" size={18} color={idx === 0 ? colors.textMuted : colors.text} />
                </Pressable>
                <Pressable
                  style={[styles.iconBtn, idx === tracks.length - 1 && styles.iconBtnDisabled]}
                  disabled={idx === tracks.length - 1 || busyId != null}
                  onPress={() => moveTrack(idx, 1)}
                  hitSlop={6}
                >
                  <Ionicons name="chevron-down" size={18} color={idx === tracks.length - 1 ? colors.textMuted : colors.text} />
                </Pressable>
                <Button
                  title={editingId === track.id ? "Готово" : "Изменить"}
                  variant="secondary"
                  onPress={() => (editingId === track.id ? setEditingId(null) : setEditingId(track.id))}
                />
                <Button
                  title={track.isActive === false ? "Показать" : "Скрыть"}
                  variant="ghost"
                  onPress={() => toggleActive(track)}
                  loading={busyId === track.id && editingId !== track.id}
                />
                <Button
                  title="Удалить"
                  variant="danger"
                  onPress={() => removeTrack(track)}
                  loading={busyId === track.id}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function SectionTitleRow({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <View style={styles.formHeader}>
      <Text style={styles.formTitle}>{label}</Text>
      <Pressable onPress={onClose} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

function EditTrackForm({
  track,
  busy,
  onSave,
  onCancel,
}: {
  track: Track;
  busy: boolean;
  onSave: (patch: Partial<Track>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(track.title);
  const [subtitle, setSubtitle] = useState(track.subtitle || "");
  const [order, setOrder] = useState(String(track.trackOrder ?? 0));

  return (
    <View>
      <Field label="Название" value={title} onChangeText={setTitle} />
      <Field label="Подзаголовок" value={subtitle} onChangeText={setSubtitle} />
      <Field label="Порядок (номер)" value={order} onChangeText={setOrder} keyboardType="numeric" />
      <View style={styles.editActions}>
        <Button
          title="Сохранить"
          onPress={() =>
            onSave({
              title: title.trim(),
              subtitle: subtitle.trim(),
              trackOrder: Number(order.replace(",", ".")) || 0,
            })
          }
          loading={busy}
          icon="save-outline"
        />
        <Button title="Отмена" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {},
  formHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  formTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  fieldLabel: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, marginBottom: spacing.xs },
  fileRow: { flexDirection: "row", gap: spacing.sm },
  fileOk: { color: colors.success, fontSize: 12, marginTop: spacing.xs },
  coverRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  coverThumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  empty: { paddingVertical: spacing.xl, alignItems: "center" },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 18 },
  trackHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  trackLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1, minWidth: 0 },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  orderText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  trackTitles: { flex: 1, minWidth: 0 },
  trackTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
  trackSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  trackMeta: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  metaText: { color: colors.textMuted, fontSize: 12 },
  editBox: { marginTop: spacing.md },
  editActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  trackActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDisabled: { opacity: 0.4 },
});
