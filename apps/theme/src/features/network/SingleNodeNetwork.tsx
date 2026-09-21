import { useMemo, useState } from "react";
import { useModel } from "../../data/context";
import { presetWindow } from "../../domain/time-window";
import { TimeControls, type TimeChoice } from "./TimeControls";
import { NetworkMonitor } from "./NetworkMonitor";
import V from "../../ui/v2.module.css";
export function SingleNodeNetwork({ id }: { id: string }) {
  const { settings } = useModel();
  const ids = useMemo(() => [id], [id]);
  const [choice, setChoice] = useState<TimeChoice>(() => ({
      preset: "1h",
      window: presetWindow("1h", settings.timezone),
    })),
    [tasks, setTasks] = useState<string[] | null>(null);
  return (
    <>
      <div className={V.panel}>
        <TimeControls
          window={choice.window}
          preset={choice.preset}
          onChange={setChoice}
        />
      </div>
      <NetworkMonitor
        ids={ids}
        window={choice.window}
        selectedTasks={tasks}
        onTasksChange={setTasks}
        onRange={(window) => setChoice({ preset: "custom", window })}
      />
    </>
  );
}
