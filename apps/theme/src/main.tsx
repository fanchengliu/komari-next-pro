import { createRoot } from "react-dom/client";
import { Providers } from "./data/context";
import { App, ErrorBoundary } from "./app/App";
import { recoverNativeRoute } from "./data/native-route";
// No Service Worker is registered: native /admin and /terminal remain server-owned documents.
const root = document.getElementById("root");
void recoverNativeRoute().then((recovered) => {
  if (root && !recovered)
    createRoot(root).render(
      <ErrorBoundary>
        <Providers>
          <App />
        </Providers>
      </ErrorBoundary>,
    );
});
