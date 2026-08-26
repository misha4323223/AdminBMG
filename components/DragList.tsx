import React, { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { hapticLight } from "@/lib/haptics";

const DEFAULT_ITEM_HEIGHT = 76;
const DEFAULT_GAP = 10;

interface DragListProps<T> {
  items: T[];
  /** Стабильный уникальный ключ элемента (например, URL фото). Не index! */
  keyExtractor: (item: T) => string;
  onReorder: (next: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  gap?: number;
  style?: ViewStyle;
  /** Сколько миллисекунд удерживать палец, чтобы «захватить» элемент. */
  longPressMs?: number;
}

/**
 * Вертикальный список с перетаскиванием (drag-and-drop) на gesture-handler +
 * reanimated. Элемент захватывается длинным нажатием и тянется вверх/вниз,
 * соседи расступаются. Порядок фиксируется в момент отпускания.
 */
export function DragList<T>({
  items,
  keyExtractor,
  onReorder,
  renderItem,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  gap = DEFAULT_GAP,
  style,
  longPressMs = 220,
}: DragListProps<T>) {
  const positions = useSharedValue<Record<string, number>>({});
  const activeKey = useSharedValue<string | null>(null);
  const startSlot = useSharedValue(0);
  const dragY = useSharedValue(0);

  const unit = itemHeight + gap;
  const count = items.length;

  useEffect(() => {
    const next: Record<string, number> = {};
    items.forEach((item, i) => {
      next[keyExtractor(item)] = i;
    });
    positions.value = next;
  }, [items, keyExtractor, positions]);

  const commitOrder = (order: string[]) => {
    const indexByKey = new Map(order.map((key, i) => [key, i]));
    const next = [...items].sort((a, b) => {
      const ia = indexByKey.get(keyExtractor(a)) ?? 0;
      const ib = indexByKey.get(keyExtractor(b)) ?? 0;
      return ia - ib;
    });
    onReorder(next);
  };

  return (
    <View style={[styles.container, { height: Math.max(0, count * unit - gap) }, style]}>
      {items.map((item, i) => {
        const id = keyExtractor(item);
        return (
          <SortableRow
            key={id}
            id={id}
            itemHeight={itemHeight}
            unit={unit}
            count={count}
            longPressMs={longPressMs}
            positions={positions}
            activeKey={activeKey}
            startSlot={startSlot}
            dragY={dragY}
            onCommit={commitOrder}
          >
            {renderItem(item, i)}
          </SortableRow>
        );
      })}
    </View>
  );
}

interface SortableRowProps {
  id: string;
  itemHeight: number;
  unit: number;
  count: number;
  longPressMs: number;
  positions: SharedValue<Record<string, number>>;
  activeKey: SharedValue<string | null>;
  startSlot: SharedValue<number>;
  dragY: SharedValue<number>;
  onCommit: (order: string[]) => void;
  children: React.ReactNode;
}

function SortableRow({
  id,
  itemHeight,
  unit,
  count,
  longPressMs,
  positions,
  activeKey,
  startSlot,
  dragY,
  onCommit,
  children,
}: SortableRowProps) {
  const gesture = Gesture.Pan()
    .activateAfterLongPress(longPressMs)
    .shouldCancelWhenOutside(false)
    .onStart(() => {
      startSlot.value = positions.value[id];
      activeKey.value = id;
      dragY.value = 0;
      runOnJS(hapticLight)();
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
      const from = positions.value[id];
      const target = Math.max(
        0,
        Math.min(count - 1, Math.round(startSlot.value + e.translationY / unit)),
      );
      if (target === from) return;
      const next = { ...positions.value };
      for (const key in next) {
        if (key === id) continue;
        const slot = next[key];
        if (from < target) {
          if (slot > from && slot <= target) next[key] = slot - 1;
        } else {
          if (slot < from && slot >= target) next[key] = slot + 1;
        }
      }
      next[id] = target;
      positions.value = next;
    })
    .onFinalize(() => {
      const order = Object.keys(positions.value).sort(
        (a, b) => positions.value[a] - positions.value[b],
      );
      const reset: Record<string, number> = {};
      order.forEach((key, i) => {
        reset[key] = i;
      });
      positions.value = reset;
      activeKey.value = null;
      dragY.value = 0;
      runOnJS(onCommit)(order);
    });

  const animatedStyle = useAnimatedStyle(() => {
    const isActive = activeKey.value === id;
    if (isActive) {
      return {
        transform: [
          { translateY: startSlot.value * unit + dragY.value },
          { scale: withTiming(1.04, { duration: 150 }) },
        ],
        zIndex: 20,
        shadowColor: "#000",
        shadowOpacity: 0.6,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
      };
    }
    return {
      transform: [{ translateY: withTiming(positions.value[id] * unit, { duration: 180 }) }],
      zIndex: 1,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.row, { height: itemHeight }, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: "100%",
  },
  row: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
});
