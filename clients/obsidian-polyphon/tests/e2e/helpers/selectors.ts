// Obsidian structural and plugin-specific selectors for Polyphon e2e tests

// Obsidian structural
export const WORKSPACE_CONTAINER = ".workspace";
export const RIBBON_OPEN_POLYPHON = '[aria-label="Open sidebar"]';
export const COMMAND_PALETTE_INPUT = 'input[placeholder*="command"], .prompt-input';

// Plugin root
export const SIDEBAR_ROOT = ".polyphon-sidebar";

// Status bar
export const STATUS_BAR = ".polyphon-status-bar";
export const STATUS_CONNECTED = ".polyphon-status-bar--connected";
export const STATUS_ERROR = ".polyphon-status-bar--error";
export const STATUS_RETRY_BTN = ".polyphon-btn--retry";

// Selectors
export const COMPOSITION_SELECT = ".polyphon-top-bar .polyphon-select";
export const SESSION_ROW = ".polyphon-session-row";
export const SESSION_SELECT = ".polyphon-session-select";
export const SESSION_NEW_BTN = ".polyphon-btn--new";
export const SESSION_HEADER = ".polyphon-session-header";

// Conversation
export const CONVERSATION = ".polyphon-conversation";
export const MSG_USER = ".pm--user";
export const MSG_VOICE = ".pm--voice";
export const MSG_PENDING = ".pm--pending";
export const MSG_STREAMING = ".pm--streaming";
export const THINKING_DOTS = ".pm__thinking-dot";
export const CONDUCTOR_TYPING = "[data-conductor-typing]";

// Input
export const CHAT_INPUT = ".polyphon-input";
export const SEND_BTN = ".polyphon-btn--send";

// Mention dropdown
export const MENTION_DROPDOWN = ".polyphon-mention-dropdown";
export const MENTION_ITEM = ".polyphon-mention-item";
