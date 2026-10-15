import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import "dayjs/locale/fr";
import { SaisieCycle } from "./pages/SaisieCycle";
import { theme } from "./theme";

function App() {
  return (
    <MantineProvider theme={theme} forceColorScheme="light">
      <DatesProvider settings={{ locale: "fr", firstDayOfWeek: 1 }}>
        <SaisieCycle />
      </DatesProvider>
    </MantineProvider>
  );
}

export default App;
