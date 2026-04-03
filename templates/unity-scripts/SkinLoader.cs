using System.Runtime.InteropServices;
using UnityEngine;

/// <summary>
/// SkinLoader — Signals "ready" to the React app on startup,
/// so it can push saved skin textures into the game.
///
/// Attach to the same GameObject as TextureSwapper.
/// </summary>
public class SkinLoader : MonoBehaviour
{
    [DllImport("__Internal")]
    private static extern void JS_SendToReact(string msg);

    void Start()
    {
        // Give Unity a frame to finish loading
        Invoke(nameof(SignalReady), 0.5f);
    }

    void SignalReady()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        JS_SendToReact("{\"type\":\"ready\"}");
        Debug.Log("[SkinLoader] Sent ready signal to React");
#else
        Debug.Log("[SkinLoader] Ready (editor mode, no React connection)");
#endif
    }
}
