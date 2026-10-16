import type {
  Composition as SdkComposition,
  CompositionVoice,
  StreamChunkNotification,
  SettingsGetUserProfileResult,
} from "@polyphon-ai/js";

export type { Session, Message } from "@polyphon-ai/js";

export type ConductorProfile = SettingsGetUserProfileResult;

export type Voice = CompositionVoice & { side: "left" | "right" };
export type Composition = Omit<SdkComposition, "voices"> & { voices: Voice[] };

export type StreamChunkHandler = (params: StreamChunkNotification["params"]) => void;

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface PluginSettings {
  host: string;
  port: number;
  token: string;
  persistConversations: boolean;
  debugMode: boolean;
}
