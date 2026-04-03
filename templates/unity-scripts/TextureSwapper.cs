using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;

/// <summary>
/// TextureSwapper — Singleton that receives texture data from the web page
/// (via SendMessage) and applies it to materials at runtime.
///
/// Attach to a persistent GameObject in the scene (DontDestroyOnLoad).
/// The web page calls: unityInstance.SendMessage("TextureSwapper", "ApplyTexture", jsonString)
/// </summary>
public class TextureSwapper : MonoBehaviour
{
    public static TextureSwapper Instance { get; private set; }

    // Registry: maps element IDs from the web UI to Unity material + property names
    [System.Serializable]
    public class MaterialMapping
    {
        public string elementId;       // e.g. "Graffiti01", "CatAlbedo"
        public string materialName;    // e.g. "Graffiti", "CatOrange"
        public string textureProperty; // e.g. "_MainTex", "_BaseMap"
    }

    // Populated at startup or via inspector
    private Dictionary<string, MaterialMapping> _mappings = new Dictionary<string, MaterialMapping>();
    private Dictionary<string, Material> _materialCache = new Dictionary<string, Material>();

    [DllImport("__Internal")]
    private static extern void JS_SendToReact(string msg);

    [DllImport("__Internal")]
    private static extern void JS_ConsoleLog(string msg);

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
        BuildDefaultMappings();
        CacheMaterials();
    }

    /// <summary>
    /// Build the default element → material mapping for Trash Dash.
    /// </summary>
    void BuildDefaultMappings()
    {
        // Characters
        AddMapping("CatAlbedo", "CatOrange", "_MainTex");
        AddMapping("RacoonAlbedo", "Racoon", "_MainTex");
        AddMapping("DogAlbedo", "Dog", "_MainTex");
        AddMapping("RatAlbedo", "Rat", "_MainTex");

        // Graffiti (all use the same material but different textures per-instance)
        for (int i = 1; i <= 13; i++)
        {
            string id = "Graffiti" + i.ToString("D2");
            AddMapping(id, "Graffiti", "_MainTex");
        }

        // Environment
        AddMapping("BrickWall", "BrickWall", "_MainTex");
        AddMapping("StoneWall", "StoneWall", "_MainTex");
        AddMapping("Plaster", "Plaster", "_MainTex");
        AddMapping("TreeBranch", "TreeBranch", "_MainTex");
        AddMapping("WashingLineClothes", "WashingLineClothes", "_MainTex");

        // Obstacles
        AddMapping("Bin", "Bin", "_MainTex");
        AddMapping("Car01", "Car01", "_MainTex");
        AddMapping("Car02", "Car02", "_MainTex");
        AddMapping("Dumpster", "Dumpster", "_MainTex");

        // UI
        AddMapping("Logo", "Logo", "_MainTex");
        AddMapping("StoreIcon", "StoreIcon", "_MainTex");
    }

    void AddMapping(string elementId, string materialName, string textureProperty)
    {
        _mappings[elementId] = new MaterialMapping
        {
            elementId = elementId,
            materialName = materialName,
            textureProperty = textureProperty
        };
    }

    void CacheMaterials()
    {
        // Find all materials in the scene and resources
        Material[] allMats = Resources.FindObjectsOfTypeAll<Material>();
        foreach (var mat in allMats)
        {
            if (!_materialCache.ContainsKey(mat.name))
            {
                _materialCache[mat.name] = mat;
            }
        }
        Log($"Cached {_materialCache.Count} materials");
    }

    /// <summary>
    /// Called from JavaScript via SendMessage.
    /// JSON format: { "elementId": "Graffiti01", "base64Png": "iVBOR..." }
    /// </summary>
    public void ApplyTexture(string json)
    {
        try
        {
            var request = JsonUtility.FromJson<TextureRequest>(json);
            ApplyTextureInternal(request.elementId, request.base64Png);
        }
        catch (Exception e)
        {
            Log($"ApplyTexture error: {e.Message}");
            SendEvent("error", $"Failed to apply texture: {e.Message}");
        }
    }

    void ApplyTextureInternal(string elementId, string base64Png)
    {
        if (!_mappings.TryGetValue(elementId, out var mapping))
        {
            Log($"No mapping found for element: {elementId}");
            return;
        }

        // Decode base64 to texture
        byte[] pngBytes = Convert.FromBase64String(base64Png);
        Texture2D tex = new Texture2D(2, 2, TextureFormat.RGBA32, false);
        tex.LoadImage(pngBytes);
        tex.Apply();

        // Handle graffiti specially — they're per-instance textures
        if (elementId.StartsWith("Graffiti"))
        {
            ApplyGraffitiTexture(elementId, tex);
            return;
        }

        // Find and update the material
        if (_materialCache.TryGetValue(mapping.materialName, out var mat))
        {
            mat.SetTexture(mapping.textureProperty, tex);
            Log($"Applied {elementId} to material {mapping.materialName}");
            SendEvent("texture-applied", elementId);
        }
        else
        {
            // Try to find it again (new materials may have been loaded)
            CacheMaterials();
            if (_materialCache.TryGetValue(mapping.materialName, out mat))
            {
                mat.SetTexture(mapping.textureProperty, tex);
                Log($"Applied {elementId} to material {mapping.materialName} (recached)");
                SendEvent("texture-applied", elementId);
            }
            else
            {
                Log($"Material not found: {mapping.materialName}");
            }
        }
    }

    /// <summary>
    /// Graffiti textures are applied per-renderer instance on wall segments.
    /// We find all renderers using the Graffiti material and swap textures
    /// on the matching ones.
    /// </summary>
    void ApplyGraffitiTexture(string elementId, Texture2D tex)
    {
        // Store in a static dictionary so new track segments can pick it up
        if (_graffitiTextures == null)
            _graffitiTextures = new Dictionary<string, Texture2D>();
        _graffitiTextures[elementId] = tex;

        // Also apply to any currently active renderers with the Graffiti material
        Renderer[] allRenderers = FindObjectsOfType<Renderer>();
        int applied = 0;
        foreach (var r in allRenderers)
        {
            foreach (var m in r.materials)
            {
                if (m.name.StartsWith("Graffiti"))
                {
                    m.SetTexture("_MainTex", tex);
                    applied++;
                }
            }
        }
        Log($"Applied {elementId} to {applied} graffiti renderers");
        SendEvent("texture-applied", elementId);
    }

    private static Dictionary<string, Texture2D> _graffitiTextures;

    /// <summary>
    /// Get a graffiti override texture (called by track segment spawners).
    /// Returns null if no override exists.
    /// </summary>
    public static Texture2D GetGraffitiOverride(string graffitiId)
    {
        if (_graffitiTextures != null && _graffitiTextures.TryGetValue(graffitiId, out var tex))
            return tex;
        return null;
    }

    /// <summary>
    /// Called from JavaScript to apply multiple textures at once (startup bulk load).
    /// JSON format: { "textures": [{ "elementId": "...", "base64Png": "..." }, ...] }
    /// </summary>
    public void ApplyBulkTextures(string json)
    {
        try
        {
            var bulk = JsonUtility.FromJson<BulkTextureRequest>(json);
            foreach (var t in bulk.textures)
            {
                ApplyTextureInternal(t.elementId, t.base64Png);
            }
            SendEvent("bulk-applied", $"{bulk.textures.Length} textures");
        }
        catch (Exception e)
        {
            Log($"ApplyBulkTextures error: {e.Message}");
        }
    }

    void SendEvent(string type, string data)
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        string msg = JsonUtility.ToJson(new UnityEvent { type = type, data = data });
        JS_SendToReact(msg);
#endif
    }

    void Log(string msg)
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        JS_ConsoleLog(msg);
#else
        Debug.Log($"[TextureSwapper] {msg}");
#endif
    }

    // JSON data classes
    [Serializable] public class TextureRequest { public string elementId; public string base64Png; }
    [Serializable] public class BulkTextureRequest { public TextureRequest[] textures; }
    [Serializable] public class UnityEvent { public string type; public string data; }
}
