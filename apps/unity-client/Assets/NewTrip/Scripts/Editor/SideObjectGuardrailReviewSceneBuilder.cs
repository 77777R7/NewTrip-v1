#if UNITY_EDITOR
using System.IO;
using NewTrip.Client.Road;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace NewTrip.Client.Editor
{
    public static class SideObjectGuardrailReviewSceneBuilder
    {
        private const string ScenePath = "Assets/NewTrip/Scenes/SideObjectGuardrailReview.unity";
        private const string BaseScenePath = "Assets/NewTrip/Scenes/CarAnchorTest.unity";
        private const string GuardrailAssetPath = "Assets/NewTrip/Art/ExtractedSprites/roadside_guardrail_low_wooden_01.png";
        private const string OutputFolder = "Artifacts/SideObjectsGuardrailReview";
        private const string ReportFileName = "side_objects_guardrail_review_report.md";
        private const int CaptureWidth = 1080;
        private const int CaptureHeight = 1920;
        private const float GuardrailPixelsPerUnit = 256f;
        private const float CruiseSpeedKmph = 72f;

        [MenuItem("NewTrip/Road Prototype/Create SideObject Guardrail Review Scene")]
        public static void CreateSideObjectGuardrailReviewScene()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before creating SideObjectGuardrailReview.");
                return;
            }

            ApplyImportSettings();
            CarAnchorTestSceneBuilder.CreateCarAnchorTestScene();

            Scene scene = EditorSceneManager.OpenScene(BaseScenePath, OpenSceneMode.Single);
            SceneManager.SetActiveScene(scene);
            RemoveExistingSideObjectLayers();

            RoadMotionState motionState = Object.FindAnyObjectByType<RoadMotionState>(FindObjectsInactive.Exclude);
            Pseudo3DRoadRenderer roadRenderer = GameObject.Find("RoadMesh")?.GetComponent<Pseudo3DRoadRenderer>();

            if (motionState == null || roadRenderer == null)
            {
                Debug.LogError("SideObjectGuardrailReview could not find RoadMotionState and RoadMesh.");
                return;
            }

            GameObject layerRoot = new GameObject("SideObjectReviewLayers");
            SideObjectSpawner spawner = CreateGuardrailSpawner(layerRoot.transform, motionState, roadRenderer);
            spawner.RebuildDistancePreview(0f);

            Selection.activeGameObject = spawner.gameObject;
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            Selection.activeGameObject = GameObject.Find("SideObjectSpawner_Guardrail");
            Debug.Log("Created SideObjectGuardrailReview scene with projected roadside guardrail side objects only.");
        }

        [MenuItem("NewTrip/Road Prototype/Capture SideObject Guardrail Review")]
        public static void CaptureSideObjectGuardrailReview()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before capturing SideObjectGuardrailReview.");
                return;
            }

            CreateSideObjectGuardrailReviewScene();
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);

            Camera camera = Camera.main;
            RoadMotionState motionState = Object.FindAnyObjectByType<RoadMotionState>(FindObjectsInactive.Exclude);
            Pseudo3DRoadRenderer roadRenderer = GameObject.Find("RoadMesh")?.GetComponent<Pseudo3DRoadRenderer>();
            SideObjectSpawner spawner = Object.FindAnyObjectByType<SideObjectSpawner>(FindObjectsInactive.Exclude);

            if (camera == null || motionState == null || roadRenderer == null || spawner == null)
            {
                Debug.LogError("SideObjectGuardrailReview capture failed. Expected camera, RoadMotionState, RoadMesh, and SideObjectSpawner.");
                return;
            }

            string outputPath = GetOutputPath();
            Directory.CreateDirectory(outputPath);

            CaptureVariant(camera, outputPath, "side_objects_guardrail_still.png", motionState, spawner, 0f);
            CaptureVariant(camera, outputPath, "side_objects_guardrail_10s_motion.png", motionState, spawner, motionState.VisualSpeedMetersPerSecond * 10f);
            CaptureDebugGuides(camera, outputPath, motionState, spawner, roadRenderer);
            WriteReport();
            AssetDatabase.Refresh();
            Debug.Log("Captured SideObjectGuardrailReview and wrote report to: " + GetReportPath());
        }

        private static SideObjectSpawner CreateGuardrailSpawner(Transform parent, RoadMotionState motionState, Pseudo3DRoadRenderer roadRenderer)
        {
            GameObject sideRoot = new GameObject("SideObjectRoot");
            sideRoot.transform.SetParent(parent, false);

            GameObject spawnerObject = new GameObject("SideObjectSpawner_Guardrail");
            spawnerObject.transform.SetParent(parent, false);

            SideObjectSpawner spawner = spawnerObject.AddComponent<SideObjectSpawner>();
            spawner.motionState = motionState;
            spawner.roadRenderer = roadRenderer;
            spawner.objectRoot = sideRoot.transform;
            spawner.spawnInPlayModeOnly = false;
            spawner.useDistanceBasedMotion = true;
            spawner.seedInitialDistanceWindow = true;
            spawner.initialPreviewObjectCount = 10;
            spawner.maxActiveObjects = 20;
            spawner.spawnDepth = 1f;
            spawner.despawnDepth = 0f;
            spawner.sideObjectPerspectiveCurve = 2.45f;
            spawner.forceBottomCenterAnchor = true;
            spawner.sortingOrderRange = 1000;
            spawner.profile = CreateGuardrailProfile();
            return spawner;
        }

        private static RoadsideSpawnProfile CreateGuardrailProfile()
        {
            Sprite guardrailSprite = AssetDatabase.LoadAssetAtPath<Sprite>(GuardrailAssetPath);

            if (guardrailSprite == null)
            {
                Debug.LogError("Missing guardrail side object sprite: " + GuardrailAssetPath);
                return ScriptableObject.CreateInstance<RoadsideSpawnProfile>();
            }

            RoadsideSpawnProfile profile = ScriptableObject.CreateInstance<RoadsideSpawnProfile>();
            profile.spawnSpacingMeters = new Vector2(9f, 13f);
            profile.depthTravelMeters = 84f;
            profile.depthMoveRate = 0.32f;
            profile.shoulderOuterRoadOffset = 1.06f;
            profile.lateralJitterRoadOffsets = new Vector2(0f, 0.045f);
            profile.entries.Add(new RoadsideSpawnEntry
            {
                spriteId = "roadside_guardrail_low_wooden_01",
                sprite = guardrailSprite,
                tint = new Color(1f, 0.88f, 0.74f, 1f),
                side = RoadsideSide.Right,
                laneOffset = 0.015f,
                nearScale = 0.38f,
                farScale = 0f,
                parallaxSpeed = 1.03f,
                rarityWeight = 1f
            });
            return profile;
        }

        private static void ApplyImportSettings()
        {
            AssetDatabase.ImportAsset(GuardrailAssetPath, ImportAssetOptions.ForceUpdate);
            TextureImporter importer = AssetImporter.GetAtPath(GuardrailAssetPath) as TextureImporter;

            if (importer == null)
            {
                Debug.LogError("Could not load TextureImporter for: " + GuardrailAssetPath);
                return;
            }

            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = GuardrailPixelsPerUnit;
            importer.mipmapEnabled = false;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.filterMode = FilterMode.Point;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.alphaIsTransparency = true;

            TextureImporterSettings settings = new TextureImporterSettings();
            importer.ReadTextureSettings(settings);
            settings.spriteAlignment = (int)SpriteAlignment.Custom;
            settings.spritePivot = new Vector2(0.5f, 0f);
            settings.spriteMeshType = SpriteMeshType.FullRect;
            importer.SetTextureSettings(settings);

            EditorUtility.SetDirty(importer);
            importer.SaveAndReimport();
        }

        private static void CaptureVariant(Camera camera, string outputPath, string fileName, RoadMotionState motionState, SideObjectSpawner spawner, float visualDistanceMeters)
        {
            motionState.SetReviewSpeedKmph(CruiseSpeedKmph);
            motionState.SetVisualDistanceForReview(visualDistanceMeters);
            spawner.RebuildDistancePreview(visualDistanceMeters);
            RefreshMotionForReview();

            Texture2D image = RenderCamera(camera);
            File.WriteAllBytes(Path.Combine(outputPath, fileName), image.EncodeToPNG());
            Object.DestroyImmediate(image);
        }

        private static void CaptureDebugGuides(Camera camera, string outputPath, RoadMotionState motionState, SideObjectSpawner spawner, Pseudo3DRoadRenderer roadRenderer)
        {
            motionState.SetVisualDistanceForReview(0f);
            spawner.RebuildDistancePreview(0f);
            RefreshMotionForReview();

            GameObject debugObject = new GameObject("SideObjectDebugGuides");
            RoadDebugOverlay debugOverlay = debugObject.AddComponent<RoadDebugOverlay>();
            debugOverlay.roadRenderer = roadRenderer;
            debugOverlay.showGuides = true;
            debugOverlay.carAnchorViewport = new Vector2(RoadViewportContract.CarAnchorX, RoadViewportContract.CarAnchorY);
            debugOverlay.RebuildGuides();

            Texture2D image = RenderCamera(camera);
            File.WriteAllBytes(Path.Combine(outputPath, "side_objects_guardrail_debug_guides.png"), image.EncodeToPNG());
            Object.DestroyImmediate(image);
            Object.DestroyImmediate(debugObject);
        }

        private static void RefreshMotionForReview()
        {
            foreach (Pseudo3DRoadRenderer renderer in Object.FindObjectsByType<Pseudo3DRoadRenderer>(FindObjectsInactive.Exclude))
            {
                renderer.RefreshMotionForReview();
            }

            foreach (LaneMarkingRenderer renderer in Object.FindObjectsByType<LaneMarkingRenderer>(FindObjectsInactive.Exclude))
            {
                renderer.RefreshMotionForReview();
            }
        }

        private static Texture2D RenderCamera(Camera camera)
        {
            RenderTexture renderTexture = new RenderTexture(CaptureWidth, CaptureHeight, 24, RenderTextureFormat.ARGB32)
            {
                filterMode = FilterMode.Point
            };
            Texture2D texture = new Texture2D(CaptureWidth, CaptureHeight, TextureFormat.RGBA32, mipChain: false)
            {
                filterMode = FilterMode.Point
            };

            RenderTexture previousActive = RenderTexture.active;
            RenderTexture previousTarget = camera.targetTexture;

            camera.targetTexture = renderTexture;
            RenderTexture.active = renderTexture;
            camera.Render();
            texture.ReadPixels(new Rect(0f, 0f, CaptureWidth, CaptureHeight), 0, 0);
            texture.Apply(updateMipmaps: false, makeNoLongerReadable: false);

            camera.targetTexture = previousTarget;
            RenderTexture.active = previousActive;
            renderTexture.Release();
            Object.DestroyImmediate(renderTexture);
            return texture;
        }

        private static void RemoveExistingSideObjectLayers()
        {
            DestroyIfPresent("SideObjectReviewLayers");
            DestroyIfPresent("SideObjectRoot");
            DestroyIfPresent("SideObjectSpawner_Guardrail");
            DestroyIfPresent("SideObjectSpawner");
        }

        private static void DestroyIfPresent(string name)
        {
            GameObject existing = GameObject.Find(name);

            if (existing != null)
            {
                Object.DestroyImmediate(existing);
            }
        }

        private static string GetOutputPath()
        {
            DirectoryInfo projectRoot = Directory.GetParent(Application.dataPath);
            return Path.Combine(projectRoot.FullName, OutputFolder);
        }

        private static string GetReportPath()
        {
            return Path.Combine(GetOutputPath(), ReportFileName);
        }

        private static void WriteReport()
        {
            string outputPath = GetOutputPath();
            Directory.CreateDirectory(outputPath);
            File.WriteAllText(GetReportPath(), BuildReport());
        }

        private static string BuildReport()
        {
            return
                "# SideObject Guardrail Review\n\n" +
                "Status: review-ready\n\n" +
                "## Scope\n\n" +
                "- Base scene: Step 6 CarAnchorTest stack.\n" +
                "- Added only the first Side Object asset: low wooden guardrail/fence.\n" +
                "- No trees, road signs, dirt patches, bridge, UI, weather, or full-road image were added.\n\n" +
                "## Contract\n\n" +
                "- Side objects use `Pseudo3DRoadRenderer.Sample(depthT)` for X/Y projection.\n" +
                "- Spawn depth: `1.0` at horizon.\n" +
                "- Despawn depth: `0.0` at bottom.\n" +
                "- Scale formula: `baseScale * (1 - Mathf.Pow(depthT, 2.45))`.\n" +
                "- Sorting formula: `Mathf.RoundToInt((1.0f - depthT) * 1000)`.\n" +
                "- Runtime child SpriteRenderer compensates pivot so the visible bottom-center sits on the projected ground point.\n" +
                "- Guardrail is placed on the right roadside outside the road edge using deterministic distance spacing.\n\n" +
                "## Review Captures\n\n" +
                "- `apps/unity-client/Artifacts/SideObjectsGuardrailReview/side_objects_guardrail_still.png`\n" +
                "- `apps/unity-client/Artifacts/SideObjectsGuardrailReview/side_objects_guardrail_10s_motion.png`\n" +
                "- `apps/unity-client/Artifacts/SideObjectsGuardrailReview/side_objects_guardrail_debug_guides.png`\n";
        }
    }
}
#endif
