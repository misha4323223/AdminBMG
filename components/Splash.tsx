// Полноэкранная заставка с логотипом BOOOMERANGS перед страницей входа.
// Логотип «влетает» с пружиной, по нему бьют РОВНО ТРИ удара молнии
// (вспышка + дрожь + вибрация), затем заставка плавно растворяется.
import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { G, Polyline } from "react-native-svg";
import { hapticMedium } from "@/lib/haptics";
import { colors, font, spacing } from "@/constants/theme";

const LOGO = require("@/assets/logo-light.png");

const AnimatedG = Animated.createAnimatedComponent(G);

const LOGO_W = 220;
const LOGO_H = 91;

/** Случайная ломаная молния от верха экрана до центра логотипа. */
function makeBolt(cx: number, cy: number) {
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const main: string[] = [];
  const steps = 9;
  let x = cx + rand(-26, 26);
  let y = -20;
  main.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  const branchStartIdx = 3 + Math.floor(Math.random() * 3);
  let branch: string[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const tx = i === steps ? cx : cx + (x - cx) * (1 - t) * 0.2 + rand(-22, 22);
    const ty = -20 + (cy + 20) * t + rand(-8, 8);
    x = tx;
    y = ty;
    main.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    if (i === branchStartIdx) {
      let bx = x;
      let by = y;
      const dir = Math.random() > 0.5 ? 1 : -1;
      branch.push(`${bx.toFixed(1)},${by.toFixed(1)}`);
      for (let j = 0; j < 3; j++) {
        bx += dir * rand(14, 34);
        by += rand(10, 26);
        branch.push(`${bx.toFixed(1)},${by.toFixed(1)}`);
      }
    }
  }
  return { main: main.join(" "), branch: branch.join(" ") };
}

export function Splash({ onDone }: { onDone: () => void }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.55)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // Заставка завершилась: больше не перехватываем нажатия (страховка,
  // если компонент ещё смонтирован, пока идёт проверка сессии).
  const [finished, setFinished] = useState(false);

  // Электрический разряд
  const [bolt, setBolt] = useState({ main: "", branch: "" });
  const boltOpacity = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const { width: winW, height: winH } = Dimensions.get("window");
  const logoCx = winW / 2;
  const logoCy = winH / 2 - 40;

  useEffect(() => {
    let alive = true;

    /** Один удар молнии: молния, вспышка, дрожь, вибрация. */
    const strike = (delay: number) =>
      new Promise<void>((resolve) => {
        if (!alive) return resolve();
        setBolt(makeBolt(logoCx, logoCy));
        Animated.parallel([
          // мерцание самой молнии
          Animated.sequence([
            Animated.timing(boltOpacity, { toValue: 1, duration: 40, useNativeDriver: true }),
            Animated.timing(boltOpacity, { toValue: 0.15, duration: 60, useNativeDriver: true }),
            Animated.timing(boltOpacity, { toValue: 0.9, duration: 40, useNativeDriver: true }),
            Animated.timing(boltOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
          ]),
          // логотип вспыхивает белым
          Animated.sequence([
            Animated.timing(flashOpacity, { toValue: 0.95, duration: 50, useNativeDriver: true }),
            Animated.timing(flashOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
          // лёгкая дрожь
          Animated.sequence([
            Animated.timing(shakeX, { toValue: 3, duration: 45, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: -3, duration: 45, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: 1.8, duration: 45, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: 0, duration: 70, useNativeDriver: true }),
          ]),
        ]).start(({ finished: ok }) => {
          if (ok && alive) resolve();
          else resolve();
        });
      });

    const run = async () => {
      if (!alive) return;
      // появление логотипа и подписи
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start();
      Animated.timing(textOpacity, { toValue: 1, duration: 400, delay: 150, useNativeDriver: true }).start();

      // Три удара молнии с вибрацией на каждый
      const strikes = [450, 1300, 2150];
      for (const delay of strikes) {
        await new Promise<void>((r) => setTimeout(r, delay));
        if (!alive) return;
        hapticMedium();
        await strike(0);
        if (!alive) return;
      }

      // пауза и плавный уход
      await new Promise<void>((r) => setTimeout(r, 700));
      if (!alive) return;
      Animated.timing(screenOpacity, { toValue: 0, duration: 450, useNativeDriver: true }).start(({ finished: ok }) => {
        if (!alive) return;
        setFinished(true);
        if (ok) onDone();
      });
    };

    run();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[styles.screen, { opacity: screenOpacity }]}
      pointerEvents={finished ? "none" : "auto"}
    >
      <LinearGradient
        colors={[...colors.gradCosmic]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Молния поверх всего */}
      <Svg style={StyleSheet.absoluteFill} width={winW} height={winH} pointerEvents="none">
        <AnimatedG opacity={boltOpacity as never}>
          {bolt.main ? (
            <>
              <Polyline points={bolt.main} fill="none" stroke={colors.accent} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" opacity={0.55} />
              <Polyline points={bolt.main} fill="none" stroke="#ffffff" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : null}
          {bolt.branch ? (
            <Polyline points={bolt.branch} fill="none" stroke="#ffffff" strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
          ) : null}
        </AnimatedG>
      </Svg>

      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale: logoScale }, { translateX: shakeX }], opacity: logoOpacity }}>
          {/* База: серебристый логотип */}
          <Animated.Image
            source={LOGO}
            style={[styles.logo, { opacity: logoOpacity }]}
            resizeMode="contain"
          />
          {/* Вспышка: тот же логотип, залитый белым */}
          <Animated.Image
            source={LOGO}
            style={[styles.logo, StyleSheet.absoluteFill as never, { tintColor: "#ffffff", opacity: flashOpacity }]}
            resizeMode="contain"
          />
        </Animated.View>
        <Animated.View style={{ opacity: textOpacity, alignItems: "center" }}>
          <Text style={styles.title}>Админ-панель</Text>
          <Text style={styles.subtitle}>Управление магазином BOOOMERANGS</Text>
        </Animated.View>
        <View style={styles.dots}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </View>
      <Animated.Text style={[styles.footer, { opacity: textOpacity }]}>
        booomerangs.ru
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    elevation: 100,
  },
  center: {
    alignItems: "center",
    gap: spacing.md,
  },
  logo: {
    width: LOGO_W,
    height: LOGO_H,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    fontFamily: font.bold,
    letterSpacing: 2,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.lg,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
  },
});
