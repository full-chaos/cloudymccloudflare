import type { DeployLogEntry } from "../../types";

const STATUS_CLASSES: Record<DeployLogEntry["status"], string> = {
  queued: "bg-yellow-400 animate-pulse",
  deployed: "bg-emerald-400",
  error: "bg-red-400",
};

interface LogStatusDotProps {
  status: DeployLogEntry["status"];
}

export function LogStatusDot({ status }: LogStatusDotProps) {
  return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CLASSES[status]}`} />;
}
