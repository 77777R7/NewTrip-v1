using MCPForUnity.Editor;
using UnityEditor;
using UnityEngine;

namespace NewTrip.Editor
{
    /// <summary>
    /// Keeps the CoplayDev MCP bridge available for Codex while this Unity project is open.
    /// This is editor-only infrastructure; it does not touch runtime game code or scenes.
    /// </summary>
    [InitializeOnLoad]
    internal static class NewTripUnityMcpBootstrap
    {
        static NewTripUnityMcpBootstrap()
        {
            EditorApplication.delayCall += EnsureMcpBridge;
        }

        private static void EnsureMcpBridge()
        {
            try
            {
                McpCiBoot.StartStdioForCi();
                Debug.Log("[NewTrip MCP] Requested CoplayDev Unity MCP stdio bridge startup for Codex.");
            }
            catch (System.Exception ex)
            {
                Debug.LogWarning($"[NewTrip MCP] Could not start CoplayDev Unity MCP bridge: {ex.Message}");
            }
        }
    }
}
