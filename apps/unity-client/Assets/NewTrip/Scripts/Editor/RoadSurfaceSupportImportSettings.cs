#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace NewTrip.Client.Editor
{
    public sealed class RoadSurfaceSupportImportSettings : AssetPostprocessor
    {
        public const string AsphaltSourceAssetPath = "Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/user_road_asphalt_source.png";
        public const string AsphaltAssetPath = "Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/road_asphalt_runtime_tile_512.png";
        public const string LaneDoubleYellowSourceAssetPath = "Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/lane_double_yellow_alpha_only.png";
        public const string LaneAssetPath = "Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/lane_yellow_single_runtime_strip.png";
        public const string CrackDecalAssetPath = "Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/user_road_crack_detail_source.png";
        public const string LaneWearDetailAssetPath = "Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/user_lane_worn_detail_source.png";

        private void OnPreprocessTexture()
        {
            if (assetPath == AsphaltAssetPath || assetPath == AsphaltSourceAssetPath)
            {
                ApplyTextureSettings((TextureImporter)assetImporter, alphaIsTransparency: false, mipmaps: false, filterMode: FilterMode.Point);
                return;
            }

            if (assetPath == LaneAssetPath || assetPath == LaneDoubleYellowSourceAssetPath)
            {
                ApplyTextureSettings((TextureImporter)assetImporter, alphaIsTransparency: true, mipmaps: false, filterMode: FilterMode.Point);
                return;
            }

            if (assetPath == CrackDecalAssetPath || assetPath == LaneWearDetailAssetPath)
            {
                ApplyTextureSettings((TextureImporter)assetImporter, alphaIsTransparency: false, mipmaps: false, filterMode: FilterMode.Point);
            }
        }

        [MenuItem("NewTrip/Road Prototype/Apply Road Surface Review Import Settings")]
        public static void ApplyAll()
        {
            ApplyToPath(AsphaltSourceAssetPath, alphaIsTransparency: false, mipmaps: false, filterMode: FilterMode.Point);
            ApplyToPath(AsphaltAssetPath, alphaIsTransparency: false, mipmaps: false, filterMode: FilterMode.Point);
            ApplyToPath(LaneDoubleYellowSourceAssetPath, alphaIsTransparency: true, mipmaps: false, filterMode: FilterMode.Point);
            ApplyToPath(LaneAssetPath, alphaIsTransparency: true, mipmaps: false, filterMode: FilterMode.Point);
            ApplyToPath(CrackDecalAssetPath, alphaIsTransparency: false, mipmaps: false, filterMode: FilterMode.Point);
            ApplyToPath(LaneWearDetailAssetPath, alphaIsTransparency: false, mipmaps: false, filterMode: FilterMode.Point);
            AssetDatabase.Refresh();
        }

        private static void ApplyToPath(string assetPath, bool alphaIsTransparency, bool mipmaps, FilterMode filterMode)
        {
            TextureImporter importer = AssetImporter.GetAtPath(assetPath) as TextureImporter;

            if (importer == null)
            {
                Debug.LogWarning("Road surface review asset is missing: " + assetPath);
                return;
            }

            ApplyTextureSettings(importer, alphaIsTransparency, mipmaps, filterMode);
            importer.SaveAndReimport();
        }

        private static void ApplyTextureSettings(TextureImporter importer, bool alphaIsTransparency, bool mipmaps, FilterMode filterMode)
        {
            importer.textureType = TextureImporterType.Default;
            importer.filterMode = filterMode;
            importer.wrapMode = TextureWrapMode.Repeat;
            importer.mipmapEnabled = mipmaps;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.alphaIsTransparency = alphaIsTransparency;
            importer.alphaSource = TextureImporterAlphaSource.FromInput;
            importer.SetPlatformTextureSettings(new TextureImporterPlatformSettings
            {
                name = "Standalone",
                overridden = true,
                maxTextureSize = 2048,
                format = TextureImporterFormat.RGBA32,
                textureCompression = TextureImporterCompression.Uncompressed
            });
        }
    }
}
#endif
