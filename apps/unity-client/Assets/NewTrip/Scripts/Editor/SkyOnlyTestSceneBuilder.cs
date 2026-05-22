#if UNITY_EDITOR
using NewTrip.Client.Road;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace NewTrip.Client.Editor
{
    public static class SkyOnlyTestSceneBuilder
    {
        private const string ScenePath = "Assets/NewTrip/Scenes/SkyOnlyTest.unity";
        private const string SkyAssetPath = "Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/sky_step2_soft_orange_background.png";
        private const int SkySortingOrder = 0;
        private const float PixelsPerUnit = NewTripPixelArtImportSettings.RuntimeSpritePixelsPerUnit;

        [MenuItem("NewTrip/Road Prototype/Create SkyOnlyTest Scene")]
        public static void CreateSkyOnlyTestScene()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before creating SkyOnlyTest.");
                return;
            }

            ApplySkyImportSettings();

            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            SceneManager.SetActiveScene(scene);

            Camera camera = CreateCamera();
            Sprite skySprite = AssetDatabase.LoadAssetAtPath<Sprite>(SkyAssetPath);

            if (skySprite == null)
            {
                Debug.LogError("SkyOnlyTest missing sky sprite: " + SkyAssetPath);
                return;
            }

            GameObject skyObject = new GameObject("SkyLayer");
            SpriteRenderer skyRenderer = skyObject.AddComponent<SpriteRenderer>();
            skyRenderer.sprite = skySprite;
            skyRenderer.sortingOrder = SkySortingOrder;
            skyRenderer.color = Color.white;
            skyRenderer.sharedMaterial = PixelArtMaterialUtility.CreateTransparentMaterial("SkyOnly_SkyLayer_PixelUnlit_Material");
            skyObject.transform.position = Vector3.zero;
            FitSpriteCover(skyRenderer);

            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            Selection.activeGameObject = skyObject;
            Debug.Log(
                "Created SkyOnlyTest scene: full-screen opaque SkyLayer only, movement=0, sortingOrder=0, " +
                "road_horizon_y=" + RoadViewportContract.RoadHorizonY.ToString("0.00") +
                ", HUD_safe_top_y=" + RoadViewportContract.HudSafeTopY.ToString("0.00") +
                "."
            );
        }

        private static Camera CreateCamera()
        {
            GameObject cameraObject = new GameObject("Main Camera");
            cameraObject.tag = "MainCamera";
            Camera camera = cameraObject.AddComponent<Camera>();
            camera.orthographic = true;
            camera.orthographicSize = RoadViewportContract.WorldHeight * 0.5f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = Color.black;
            camera.transform.position = new Vector3(0f, 0f, -10f);
            camera.transform.rotation = Quaternion.identity;

            return camera;
        }

        private static void FitSpriteCover(SpriteRenderer renderer)
        {
            Vector2 spriteSize = renderer.sprite.bounds.size;
            float scale = Mathf.Max(
                RoadViewportContract.WorldWidth / spriteSize.x,
                RoadViewportContract.WorldHeight / spriteSize.y
            );

            renderer.transform.localPosition = Vector3.zero;
            renderer.transform.localScale = Vector3.one * scale;
        }

        private static void ApplySkyImportSettings()
        {
            AssetDatabase.ImportAsset(SkyAssetPath, ImportAssetOptions.ForceUpdate);
            TextureImporter importer = AssetImporter.GetAtPath(SkyAssetPath) as TextureImporter;

            if (importer == null)
            {
                Debug.LogError("SkyOnlyTest could not load TextureImporter for: " + SkyAssetPath);
                return;
            }

            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = PixelsPerUnit;
            importer.mipmapEnabled = false;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.filterMode = FilterMode.Point;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.alphaIsTransparency = false;

            EditorUtility.SetDirty(importer);
            importer.SaveAndReimport();
        }
    }
}
#endif
