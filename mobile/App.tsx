import "react-native-gesture-handler";
import "react-native-get-random-values";
import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "./src/store";
import Navigation from "./src/navigation";
import { loadPersistedState } from "./src/store/hydration";

export default function App() {
  useEffect(() => {
    // hydrate persisted player/ui state on cold start
    loadPersistedState(store.dispatch as any);
  }, []);

  return (
    <Provider store={store}>
      <Navigation />
    </Provider>
  );
}
