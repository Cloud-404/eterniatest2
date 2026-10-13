import { useState } from "react";

export const useVoiceLevel = (active: boolean) => {
  const [level] = useState(0);
  return level;
};
