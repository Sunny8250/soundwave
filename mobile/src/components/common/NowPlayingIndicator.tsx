import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { colors } from "../../utils/theme";

interface Props {
  isPlaying: boolean;
  size?: number;
}

export default function NowPlayingIndicator({ isPlaying, size = 16 }: Props) {
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.6)).current;
  const bar3 = useRef(new Animated.Value(1.0)).current;
  const bar4 = useRef(new Animated.Value(0.5)).current;

  const animateBar = (bar: Animated.Value, delay: number) =>
    Animated.loop(
      Animated.sequence([
        Animated.timing(bar, {
          toValue: 1.0,
          duration: 400 + delay,
          useNativeDriver: true,
        }),
        Animated.timing(bar, {
          toValue: 0.2,
          duration: 400 + delay,
          useNativeDriver: true,
        }),
      ]),
    );

  useEffect(() => {
    if (isPlaying) {
      animateBar(bar1, 0).start();
      animateBar(bar2, 100).start();
      animateBar(bar3, 200).start();
      animateBar(bar4, 150).start();
    } else {
      [bar1, bar2, bar3, bar4].forEach((b) => {
        b.stopAnimation();
        Animated.timing(b, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [isPlaying]);

  const barWidth = size * 0.18;
  const barHeight = size;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {[bar1, bar2, bar3, bar4].map((bar, i) => (
        <Animated.View
          key={i}
          style={{
            width: barWidth,
            height: barHeight,
            borderRadius: barWidth / 2,
            backgroundColor: colors.primary,
            transform: [{ scaleY: bar }],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
