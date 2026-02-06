import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

const App = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Projeto Mercado</Text>
        <Text style={styles.subtitle}>Android-first em React Native</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center"
  },
  card: {
    backgroundColor: "#1E293B",
    padding: 24,
    borderRadius: 16
  },
  title: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8
  },
  subtitle: {
    color: "#CBD5F5",
    fontSize: 16
  }
});

export default App;
