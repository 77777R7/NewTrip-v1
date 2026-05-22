#!/usr/bin/env node
const { spawn } = require("child_process");
const fs = require("fs");

const logFile = "/private/tmp/unity-mcp-stdio-adapter.log";
function log(message) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
  } catch (_) {
    // Logging is diagnostic only; never break the MCP bridge because of it.
  }
}

const uvx = "/opt/homebrew/bin/uvx";
log(`starting adapter pid=${process.pid}`);
const child = spawn(
  uvx,
  ["--from", "mcpforunityserver==9.6.8", "mcp-for-unity", "--transport", "stdio"],
  { stdio: ["pipe", "pipe", "pipe"] }
);
log(`spawned child pid=${child.pid}`);

let inbound = Buffer.alloc(0);
let outbound = "";
let parentProtocol = null;

const readOnlyTelemetryTool = {
  name: "unity_telemetry_status",
  title: "Unity Telemetry Status",
  description:
    "Read-only health check for the connected Unity Editor MCP bridge. Returns whether Unity telemetry is enabled.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  outputSchema: {
    type: "object",
    additionalProperties: true,
  },
  annotations: {
    title: "Unity Telemetry Status",
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
};

function writeResponse(jsonText) {
  if (parentProtocol === "jsonl") {
    process.stdout.write(jsonText + "\n");
    return;
  }

  const body = Buffer.from(jsonText, "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

function forwardJsonLine(jsonText) {
  let forwardedText = jsonText;
  try {
    const message = JSON.parse(jsonText);
    if (message?.method === "tools/call" && message?.params?.name === readOnlyTelemetryTool.name) {
      message.params = {
        name: "manage_editor",
        arguments: { action: "telemetry_status" },
      };
      forwardedText = JSON.stringify(message);
    }
  } catch (_) {
    // Invalid JSON will be forwarded unchanged so the MCP server can report it.
  }

  log(`parent->child ${forwardedText.slice(0, 160)}`);
  child.stdin.write(forwardedText + "\n");
}

function decorateChildResponse(jsonText) {
  try {
    const message = JSON.parse(jsonText);
    if (Array.isArray(message?.result?.tools)) {
      const hasTelemetryTool = message.result.tools.some((tool) => tool?.name === readOnlyTelemetryTool.name);
      if (!hasTelemetryTool) {
        message.result.tools = [readOnlyTelemetryTool, ...message.result.tools];
      }
      return JSON.stringify(message);
    }
  } catch (_) {
    // Fall through and return the original payload.
  }

  return jsonText;
}

function parseInboundMessages() {
  while (true) {
    const trimmedStart = inbound.toString("utf8", 0, Math.min(inbound.length, 64)).trimStart();
    if (trimmedStart.startsWith("{")) {
      parentProtocol = parentProtocol ?? "jsonl";
      const newlineIndex = inbound.indexOf("\n");
      if (newlineIndex >= 0) {
        const line = inbound.slice(0, newlineIndex).toString("utf8").trim();
        inbound = inbound.slice(newlineIndex + 1);
        if (line) forwardJsonLine(line);
        continue;
      }

      const candidate = inbound.toString("utf8").trim();
      try {
        JSON.parse(candidate);
        inbound = Buffer.alloc(0);
        forwardJsonLine(candidate);
        continue;
      } catch (_) {
        return;
      }
    }

    const crlfSeparatorIndex = inbound.indexOf("\r\n\r\n");
    const lfSeparatorIndex = inbound.indexOf("\n\n");
    let separatorIndex = -1;
    let separatorLength = 0;

    if (crlfSeparatorIndex >= 0 && (lfSeparatorIndex < 0 || crlfSeparatorIndex <= lfSeparatorIndex)) {
      separatorIndex = crlfSeparatorIndex;
      separatorLength = 4;
    } else if (lfSeparatorIndex >= 0) {
      separatorIndex = lfSeparatorIndex;
      separatorLength = 2;
    }

    if (separatorIndex < 0) return;
    parentProtocol = parentProtocol ?? "framed";

    const header = inbound.slice(0, separatorIndex).toString("utf8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      process.stderr.write(`[unity-mcp-adapter] Ignoring malformed MCP header: ${header}\n`);
      inbound = inbound.slice(separatorIndex + separatorLength);
      continue;
    }

    const byteLength = Number(match[1]);
    const bodyStart = separatorIndex + separatorLength;
    const bodyEnd = bodyStart + byteLength;
    if (inbound.length < bodyEnd) return;

    const body = inbound.slice(bodyStart, bodyEnd).toString("utf8");
    inbound = inbound.slice(bodyEnd);
    forwardJsonLine(body);
  }
}

process.stdin.on("data", (chunk) => {
  inbound = Buffer.concat([inbound, chunk]);
  log(`stdin chunk bytes=${chunk.length} buffered=${inbound.length}`);
  parseInboundMessages();
});

process.stdin.on("end", () => {
  child.stdin.end();
});

child.stdout.on("data", (chunk) => {
  outbound += chunk.toString("utf8");
  while (true) {
    const newlineIndex = outbound.indexOf("\n");
    if (newlineIndex < 0) return;

    const line = outbound.slice(0, newlineIndex).trim();
    outbound = outbound.slice(newlineIndex + 1);
    if (!line) continue;

    if (!line.startsWith("{")) {
      log(`child stdout non-json ${line.slice(0, 200)}`);
      process.stderr.write(`[unity-mcp-adapter] child stdout: ${line}\n`);
      continue;
    }

    const decoratedLine = decorateChildResponse(line);
    log(`child->parent ${decoratedLine.slice(0, 160)}`);
    writeResponse(decoratedLine);
  }
});

child.stderr.on("data", (chunk) => {
  log(`child stderr ${chunk.toString("utf8").slice(0, 300)}`);
  process.stderr.write(chunk);
});

child.on("exit", (code, signal) => {
  log(`child exited code=${code} signal=${signal}`);
  process.stderr.write(`[unity-mcp-adapter] child exited code=${code} signal=${signal}\n`);
  process.exit(code ?? 1);
});

process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
