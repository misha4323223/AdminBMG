import React from "react";
import { StyleSheet, View } from "react-native";
import { Screen } from "@/components/Screen";
import { AgentChat } from "@/components/AgentChat";

/** Полноэкранный чат с BOOOM AI — открывается по кнопке разворота с главной.
 * История общая с чатом на главной и вкладкой AI (общий кэш в AgentChat). */
export default function FullscreenChat() {
  return (
    <Screen title="BOOOM AI" subtitle="Ассистент магазина" scroll={false}>
      <View style={styles.flex}>
        <AgentChat />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
