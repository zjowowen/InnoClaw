/**
 * Unit tests for Feishu bot adapter.
 */

import { describe, it, expect } from "vitest";
import { createFeishuAdapter } from "./client";
import type { FeishuBotConfig } from "../types";

const testConfig: FeishuBotConfig = {
  appId: "cli_test123",
  appSecret: "secret123",
  verificationToken: "verify_token_abc",
  encryptKey: "encrypt_key_xyz",
  enabled: true,
};

describe("Feishu adapter", () => {
  describe("isEnabled", () => {
    it("should return true when all required fields are set and enabled", () => {
      const adapter = createFeishuAdapter(testConfig);
      expect(adapter.isEnabled()).toBe(true);
    });

    it("should return false when enabled is false", () => {
      const adapter = createFeishuAdapter({ ...testConfig, enabled: false });
      expect(adapter.isEnabled()).toBe(false);
    });

    it("should return false when appId is empty", () => {
      const adapter = createFeishuAdapter({ ...testConfig, appId: "" });
      expect(adapter.isEnabled()).toBe(false);
    });

    it("should return false when appSecret is empty", () => {
      const adapter = createFeishuAdapter({ ...testConfig, appSecret: "" });
      expect(adapter.isEnabled()).toBe(false);
    });

    it("should return false when verificationToken is empty", () => {
      const adapter = createFeishuAdapter({
        ...testConfig,
        verificationToken: "",
      });
      expect(adapter.isEnabled()).toBe(false);
    });
  });

  describe("platform", () => {
    it("should return 'feishu'", () => {
      const adapter = createFeishuAdapter(testConfig);
      expect(adapter.platform).toBe("feishu");
    });
  });

  describe("parseMessages", () => {
    it("should parse a text message", () => {
      const adapter = createFeishuAdapter(testConfig);
      const body = {
        header: {
          event_type: "im.message.receive_v1",
          token: "verify_token_abc",
        },
        event: {
          sender: {
            sender_id: { open_id: "ou_user123" },
          },
          message: {
            message_id: "msg_001",
            chat_id: "oc_chat123",
            chat_type: "group",
            message_type: "text",
            content: JSON.stringify({ text: "Hello bot" }),
          },
        },
      };

      const messages = adapter.parseMessages(body);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe("text");
      if (messages[0].type === "text") {
        expect(messages[0].text).toBe("Hello bot");
        expect(messages[0].senderId).toBe("ou_user123");
        expect(messages[0].chatId).toBe("oc_chat123");
        expect(messages[0].isGroup).toBe(true);
      }
    });

    it("should parse a file message", () => {
      const adapter = createFeishuAdapter(testConfig);
      const body = {
        header: {
          event_type: "im.message.receive_v1",
          token: "verify_token_abc",
        },
        event: {
          sender: {
            sender_id: { open_id: "ou_user456" },
          },
          message: {
            message_id: "msg_002",
            chat_id: "oc_chat456",
            chat_type: "p2p",
            message_type: "file",
            content: JSON.stringify({
              file_key: "fk_001",
              file_name: "report.xlsx",
              file_size: 12345,
            }),
          },
        },
      };

      const messages = adapter.parseMessages(body);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe("file");
      if (messages[0].type === "file") {
        expect(messages[0].fileName).toBe("report.xlsx");
        expect(messages[0].fileKey).toBe("fk_001");
        expect(messages[0].fileSize).toBe(12345);
        expect(messages[0].isGroup).toBe(false);
      }
    });

    it("should reject messages with invalid verification token", () => {
      const adapter = createFeishuAdapter(testConfig);
      const body = {
        header: {
          event_type: "im.message.receive_v1",
          token: "wrong_token",
        },
        event: {
          sender: { sender_id: { open_id: "ou_user" } },
          message: {
            message_id: "msg_003",
            chat_id: "oc_chat",
            chat_type: "p2p",
            message_type: "text",
            content: JSON.stringify({ text: "test" }),
          },
        },
      };

      const messages = adapter.parseMessages(body);
      expect(messages).toHaveLength(0);
    });

    it("should return empty array for unknown event types", () => {
      const adapter = createFeishuAdapter(testConfig);
      const body = {
        header: {
          event_type: "unknown_event",
          token: "verify_token_abc",
        },
        event: {},
      };

      const messages = adapter.parseMessages(body);
      expect(messages).toHaveLength(0);
    });

    it("should return empty array when header or event is missing", () => {
      const adapter = createFeishuAdapter(testConfig);
      expect(adapter.parseMessages({})).toHaveLength(0);
      expect(adapter.parseMessages({ header: {} })).toHaveLength(0);
    });
  });
});
