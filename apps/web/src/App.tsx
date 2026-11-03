import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomePage } from "./pages/HomePage";
import { SettingsPage } from "./pages/SettingsPage";

const queryClient = new QueryClient();

export default function App() {
  const [page, setPage] = useState<"home" | "settings">("home");
  return (
    <QueryClientProvider client={queryClient}>
      {page === "home" ? (
        <HomePage onOpenSettings={() => setPage("settings")} />
      ) : (
        <SettingsPage onBack={() => setPage("home")} />
      )}
    </QueryClientProvider>
  );
}
