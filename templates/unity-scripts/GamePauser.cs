using UnityEngine;

/// <summary>
/// GamePauser — Pauses/resumes the game via Time.timeScale.
/// Called from JavaScript: SendMessage("TextureSwapper", "PauseGame", "")
/// (Attached to the same persistent GameObject as TextureSwapper.)
/// </summary>
public class GamePauser : MonoBehaviour
{
    private float _savedTimeScale = 1f;
    private bool _isPaused = false;

    /// <summary>
    /// Called from JavaScript via SendMessage.
    /// </summary>
    public void PauseGame(string unused)
    {
        if (_isPaused) return;
        _savedTimeScale = Time.timeScale;
        Time.timeScale = 0f;
        _isPaused = true;
        AudioListener.pause = true;
        Debug.Log("[GamePauser] Game paused");
    }

    /// <summary>
    /// Called from JavaScript via SendMessage.
    /// </summary>
    public void ResumeGame(string unused)
    {
        if (!_isPaused) return;
        Time.timeScale = _savedTimeScale;
        _isPaused = false;
        AudioListener.pause = false;
        Debug.Log("[GamePauser] Game resumed");
    }
}
