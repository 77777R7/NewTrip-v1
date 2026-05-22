#if UNITY_EDITOR
using NewTrip.Client.Road;
using UnityEditor;
using UnityEngine;

namespace NewTrip.Client.Editor
{
    public sealed class NewTripPixelArtImportSettings : AssetPostprocessor
    {
        public const float RuntimeSpritePixelsPerUnit = PixelArtMaterialUtility.RuntimeSpritePixelsPerUnit;
        private const string ArtRoot = "Assets/NewTrip/Art/";

        private void OnPreprocessTexture()
        {
            if (!IsNewTripArtTexture(assetPath))
            {
                return;
            }

            ApplyToImporter((TextureImporter)assetImporter, assetPath);
        }

        [MenuItem("NewTrip/Art/Apply Pixel Art Runtime Import Settings")]
        public static void ApplyAll()
        {
            string[] textureGuids = AssetDatabase.FindAssets("t:Texture2D", new[] { "Assets/NewTrip/Art" });
            int updatedCount = 0;

            foreach (string guid in textureGuids)
            {
                string path = AssetDatabase.GUIDToAssetPath(guid);
                TextureImporter importer = AssetImporter.GetAtPath(path) as TextureImporter;

                if (importer == null || !IsNewTripArtTexture(path))
                {
                    continue;
                }

                ApplyToImporter(importer, path);
                importer.SaveAndReimport();
                updatedCount++;
            }

            AssetDatabase.Refresh();
            Debug.Log("Applied NewTrip pixel-art import settings to " + updatedCount + " texture assets.");
        }

        [MenuItem("NewTrip/Art/Validate Pixel Art Runtime Import Settings")]
        public static void ValidateAll()
        {
            string[] textureGuids = AssetDatabase.FindAssets("t:Texture2D", new[] { "Assets/NewTrip/Art" });
            int checkedCount = 0;
            int issueCount = 0;

            foreach (string guid in textureGuids)
            {
                string path = AssetDatabase.GUIDToAssetPath(guid);
                TextureImporter importer = AssetImporter.GetAtPath(path) as TextureImporter;

                if (importer == null || !IsNewTripArtTexture(path))
                {
                    continue;
                }

                checkedCount++;
                bool repeatTexture = IsRepeatRuntimeTexture(path);
                bool expectedSprite = !repeatTexture;

                issueCount += ReportIf(path, importer.filterMode != FilterMode.Point, "Filter Mode must be Point.");
                issueCount += ReportIf(path, importer.mipmapEnabled, "Mip Maps must be Off.");
                issueCount += ReportIf(path, importer.textureCompression != TextureImporterCompression.Uncompressed, "Compression must be None.");
                issueCount += ReportIf(path, importer.wrapMode != (repeatTexture ? TextureWrapMode.Repeat : TextureWrapMode.Clamp), "Wrap Mode does not match runtime use.");
                issueCount += ReportIf(path, expectedSprite && importer.textureType != TextureImporterType.Sprite, "Sprite assets must use Texture Type Sprite.");
                issueCount += ReportIf(path, expectedSprite && Mathf.Abs(importer.spritePixelsPerUnit - RuntimeSpritePixelsPerUnit) > 0.01f, "Sprite PPU must be " + RuntimeSpritePixelsPerUnit + ".");
            }

            if (issueCount == 0)
            {
                Debug.Log("NewTrip pixel-art import validation passed for " + checkedCount + " texture assets.");
            }
            else
            {
                Debug.LogWarning("NewTrip pixel-art import validation found " + issueCount + " issue(s) across " + checkedCount + " texture assets.");
            }
        }

        private static bool IsNewTripArtTexture(string path)
        {
            return path.StartsWith(ArtRoot) && path.EndsWith(".png");
        }

        public static void ApplyToImporter(TextureImporter importer, string path)
        {
            bool repeatTexture = IsRepeatRuntimeTexture(path);
            bool roadTexture = IsRoadBaseTexture(path);

            // NewTrip pixel art carries its authored light/shadow in the bitmap.
            // Keep every runtime PNG sharp and uncompressed; lighting/materials
            // should not invent extra smoothing over the source pixels.
            // Repeat textures stay TextureType Default because road/lane meshes
            // sample them through material UV repeat; normal sprites use one
            // shared PPU so pixel density stays coherent in the portrait frame.
            importer.textureType = repeatTexture ? TextureImporterType.Default : TextureImporterType.Sprite;
            importer.filterMode = FilterMode.Point;
            importer.wrapMode = repeatTexture ? TextureWrapMode.Repeat : TextureWrapMode.Clamp;
            importer.mipmapEnabled = false;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.alphaSource = TextureImporterAlphaSource.FromInput;
            importer.alphaIsTransparency = !roadTexture && HasLikelyTransparency(path);

            if (!repeatTexture)
            {
                importer.spritePixelsPerUnit = RuntimeSpritePixelsPerUnit;
                importer.spriteImportMode = SpriteImportMode.Single;

                TextureImporterSettings settings = new TextureImporterSettings();
                importer.ReadTextureSettings(settings);
                settings.spriteMeshType = SpriteMeshType.FullRect;
                importer.SetTextureSettings(settings);
            }

            ApplyPlatform(importer, "DefaultTexturePlatform");
            ApplyPlatform(importer, "Standalone");
            ApplyPlatform(importer, "iPhone");
            ApplyPlatform(importer, "Android");
        }

        private static bool IsRepeatRuntimeTexture(string path)
        {
            string lower = path.ToLowerInvariant();
            return lower.Contains("road_asphalt")
                || lower.Contains("asphalt_tile")
                || lower.Contains("runtime_tile")
                || lower.Contains("lane_")
                || lower.Contains("yellow")
                || lower.Contains("worn_paint")
                || lower.Contains("crack")
                || lower.Contains("edge_line")
                || lower.Contains("white_line")
                || lower.Contains("strip");
        }

        private static bool IsRoadBaseTexture(string path)
        {
            string lower = path.ToLowerInvariant();
            return lower.Contains("road_asphalt")
                || lower.Contains("asphalt_tile")
                || lower.Contains("runtime_tile")
                || lower.Contains("asphalt_source");
        }

        private static bool HasLikelyTransparency(string path)
        {
            string lower = path.ToLowerInvariant();
            return lower.Contains("alpha")
                || lower.Contains("cutout")
                || lower.Contains("haze")
                || lower.Contains("glow")
                || lower.Contains("cloud")
                || lower.Contains("weather")
                || lower.Contains("car")
                || lower.Contains("roadside")
                || lower.Contains("sign")
                || lower.Contains("sprite")
                || lower.Contains("guardrail")
                || lower.Contains("bush")
                || lower.Contains("rock")
                || lower.Contains("pine")
                || lower.Contains("reflector")
                || lower.Contains("arrow");
        }

        private static void ApplyPlatform(TextureImporter importer, string buildTarget)
        {
            importer.SetPlatformTextureSettings(new TextureImporterPlatformSettings
            {
                name = buildTarget,
                overridden = true,
                maxTextureSize = 4096,
                format = TextureImporterFormat.RGBA32,
                textureCompression = TextureImporterCompression.Uncompressed,
                crunchedCompression = false,
                compressionQuality = 100
            });
        }

        private static int ReportIf(string path, bool failed, string message)
        {
            if (!failed)
            {
                return 0;
            }

            Debug.LogWarning("Pixel import setting issue: " + path + " - " + message);
            return 1;
        }
    }
}
#endif
