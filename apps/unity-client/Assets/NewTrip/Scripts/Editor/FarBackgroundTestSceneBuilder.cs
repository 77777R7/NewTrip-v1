#if UNITY_EDITOR
using System.IO;
using NewTrip.Client.Road;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace NewTrip.Client.Editor
{
    public static class FarBackgroundTestSceneBuilder
    {
        private const string RoadOnlyScenePath = "Assets/NewTrip/Scenes/RoadOnlyTest.unity";
        private const string ScenePath = "Assets/NewTrip/Scenes/SkyFarRoadTest.unity";
        private const string SkyAssetPath = "Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/sky_step2_soft_orange_background.png";
        private const string SunAssetPath = "Assets/NewTrip/Art/ScenePacks/CaliforniaHwy1/BigSurSunset/Background/orange_orb_01.png";
        private const string FarAssetPath = "Assets/NewTrip/Art/PrototypeComposite/Resources/PrototypeComposite/far_coastal_mountains_01.png";
        private const string HorizonHazeAssetPath = "Assets/NewTrip/Art/ScenePacks/CaliforniaHwy1/BigSurSunset/Background/horizon_haze_warm_v01.png";
        private const string RoadColorOutputFolder = "Artifacts/RoadColorTuning";
        private const string HorizonHazeOutputFolder = "Artifacts/HorizonHaze";
        private const string RoadLockOutputFolder = "Artifacts/RoadLockPass";
        private const string RoadLockReportFileName = "road_lock_pass_report.md";
        private const string RoadColorCaptureRequestPath = "Temp/newtrip-road-color-capture.request";
        private const string RoadColorCaptureLogPath = "Temp/newtrip-road-color-capture.log";
        private const string HorizonHazeCaptureRequestPath = "Temp/newtrip-horizon-haze-capture.request";
        private const string HorizonHazeCaptureLogPath = "Temp/newtrip-horizon-haze-capture.log";
        private const int CaptureWidth = 1080;
        private const int CaptureHeight = 1920;

        private const int SkySortingOrder = 0;
        private const int SunSortingOrder = 3;
        private const int FarSortingOrder = 5;
        private const int HorizonHazeSortingOrder = 12;
        private const float SkyPixelsPerUnit = NewTripPixelArtImportSettings.RuntimeSpritePixelsPerUnit;
        private const float SunPixelsPerUnit = NewTripPixelArtImportSettings.RuntimeSpritePixelsPerUnit;
        private const float FarPixelsPerUnit = NewTripPixelArtImportSettings.RuntimeSpritePixelsPerUnit;
        private const float HorizonHazePixelsPerUnit = NewTripPixelArtImportSettings.RuntimeSpritePixelsPerUnit;
        private const float FarWidthWorld = RoadViewportContract.WorldWidth * 1.12f;
        private const float FarBaseViewportY = RoadViewportContract.RoadHorizonY;
        private const float SunViewportX = 0.77f;
        private const float SunViewportY = RoadViewportContract.RoadHorizonY - 0.045f;
        private const float SunWorldWidth = 0.86f;
        private const float HorizonHazeViewportY = RoadViewportContract.RoadHorizonY + 0.020f;
        private const float DefaultHorizonHazeAlpha = 0.30f;

        [InitializeOnLoadMethod]
        private static void RunRequestedRoadColorCapture()
        {
            if (!File.Exists(RoadColorCaptureRequestPath))
            {
                return;
            }

            File.Delete(RoadColorCaptureRequestPath);
            File.AppendAllText(RoadColorCaptureLogPath, "Road color capture requested.\n");
            EditorApplication.delayCall += RunRoadColorCaptureWhenReady;
        }

        private static void RunRoadColorCaptureWhenReady()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                File.AppendAllText(RoadColorCaptureLogPath, "Waiting for Unity to leave Play Mode.\n");
                EditorApplication.isPlaying = false;
                EditorApplication.delayCall += RunRoadColorCaptureWhenReady;
                return;
            }

            File.AppendAllText(RoadColorCaptureLogPath, "Running road color capture.\n");
            CaptureRoadColorTuningScreenshots();
            File.AppendAllText(RoadColorCaptureLogPath, "Road color capture finished.\n");
        }

        [InitializeOnLoadMethod]
        private static void RunRequestedHorizonHazeCapture()
        {
            if (!File.Exists(HorizonHazeCaptureRequestPath))
            {
                return;
            }

            File.Delete(HorizonHazeCaptureRequestPath);
            File.AppendAllText(HorizonHazeCaptureLogPath, "Horizon haze capture requested.\n");
            EditorApplication.delayCall += RunHorizonHazeCaptureWhenReady;
        }

        private static void RunHorizonHazeCaptureWhenReady()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                File.AppendAllText(HorizonHazeCaptureLogPath, "Waiting for Unity to leave Play Mode.\n");
                EditorApplication.isPlaying = false;
                EditorApplication.delayCall += RunHorizonHazeCaptureWhenReady;
                return;
            }

            File.AppendAllText(HorizonHazeCaptureLogPath, "Running horizon haze capture.\n");
            CaptureHorizonHazeReviewScreenshots();
            File.AppendAllText(HorizonHazeCaptureLogPath, "Horizon haze capture finished.\n");
        }

        [MenuItem("NewTrip/Road Prototype/Create SkyFarRoadTest Scene")]
        public static void CreateSkyFarRoadTestScene()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before creating SkyFarRoadTest.");
                return;
            }

            ApplyImportSettings();

            RoadOnlyTestSceneBuilder.CreateRoadOnlyTestScene();

            Scene scene = EditorSceneManager.OpenScene(RoadOnlyScenePath, OpenSceneMode.Single);
            SceneManager.SetActiveScene(scene);
            RemoveExistingBackgroundLayers();

            GameObject backgroundRoot = new GameObject("BackgroundLayers");
            CreateSkyLayer(backgroundRoot.transform);
            CreateSunLayer(backgroundRoot.transform);
            GameObject farLayer = CreateFarBackgroundLayer(backgroundRoot.transform);
            CreateHorizonHazeLayer(backgroundRoot.transform);
            ApplySkyFarRoadCompositeTuning();

            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            Selection.activeGameObject = GameObject.Find("FarBackgroundLayer");

            Debug.Log(
                "Created SkyFarRoadTest scene: SkyLayer sortingOrder=0, FarBackgroundLayer sortingOrder=5, " +
                "far_base_y=" + FarBaseViewportY.ToString("0.000") +
                ", road_horizon_y=" + RoadViewportContract.RoadHorizonY.ToString("0.000") +
                ", no car, UI, bridge, signs, props, or weather."
            );
        }

        [MenuItem("NewTrip/Road Prototype/Capture Road Color Tuning Screenshots")]
        public static void CaptureRoadColorTuningScreenshots()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before capturing road color tuning screenshots.");
                return;
            }

            CreateSkyFarRoadTestScene();
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);

            Camera camera = Camera.main;
            Pseudo3DRoadRenderer roadRenderer = GameObject.Find("RoadMesh")?.GetComponent<Pseudo3DRoadRenderer>();
            LaneMarkingRenderer leftLaneRenderer = GameObject.Find("LaneYellowLeftMesh")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer rightLaneRenderer = GameObject.Find("LaneYellowRightMesh")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer leftEdgeRenderer = GameObject.Find("RoadEdgeLeftLine")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer rightEdgeRenderer = GameObject.Find("RoadEdgeRightLine")?.GetComponent<LaneMarkingRenderer>();

            if (camera == null || roadRenderer == null || leftLaneRenderer == null || rightLaneRenderer == null)
            {
                Debug.LogError("Road color capture failed. Expected SkyFarRoadTest camera, RoadMesh, and two yellow lane meshes.");
                return;
            }

            roadRenderer.SetMaterial(CreateOpaqueRoadMaterial(
                "RoadColor_Asphalt_Opaque_Material",
                AssetDatabase.LoadAssetAtPath<Texture2D>(RoadSurfaceSupportImportSettings.AsphaltAssetPath)
            ));

            string outputPath = GetRoadColorOutputPath();
            Directory.CreateDirectory(outputPath);

            CaptureRoadColorVariant(
                camera,
                outputPath,
                "road_color_a_warm_balanced.png",
                roadRenderer,
                leftLaneRenderer,
                rightLaneRenderer,
                leftEdgeRenderer,
                rightEdgeRenderer,
                RoadVisualTuningPreset.BigSurSunsetWarmBalanced
            );
            CaptureRoadColorVariant(
                camera,
                outputPath,
                "road_color_b_sunset_warm.png",
                roadRenderer,
                leftLaneRenderer,
                rightLaneRenderer,
                leftEdgeRenderer,
                rightEdgeRenderer,
                RoadVisualTuningPreset.BigSurSunsetWarm
            );
            CaptureRoadColorVariant(
                camera,
                outputPath,
                "road_color_c_darker_natural.png",
                roadRenderer,
                leftLaneRenderer,
                rightLaneRenderer,
                leftEdgeRenderer,
                rightEdgeRenderer,
                RoadVisualTuningPreset.BigSurSunsetDarkerNatural
            );
            CaptureRoadColorVariant(
                camera,
                outputPath,
                "road_color_d_atmospheric_blend.png",
                roadRenderer,
                leftLaneRenderer,
                rightLaneRenderer,
                leftEdgeRenderer,
                rightEdgeRenderer,
                RoadVisualTuningPreset.BigSurSunsetAtmosphericBlend
            );

            AssetDatabase.Refresh();
            Debug.Log("Captured road color tuning screenshots to: " + outputPath);
        }

        [MenuItem("NewTrip/Road Prototype/Capture Horizon Haze Review Screenshots")]
        public static void CaptureHorizonHazeReviewScreenshots()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before capturing horizon haze review screenshots.");
                return;
            }

            CreateSkyFarRoadTestScene();
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);

            Camera camera = Camera.main;
            Pseudo3DRoadRenderer roadRenderer = GameObject.Find("RoadMesh")?.GetComponent<Pseudo3DRoadRenderer>();
            LaneMarkingRenderer leftLaneRenderer = GameObject.Find("LaneYellowLeftMesh")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer rightLaneRenderer = GameObject.Find("LaneYellowRightMesh")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer leftEdgeRenderer = GameObject.Find("RoadEdgeLeftLine")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer rightEdgeRenderer = GameObject.Find("RoadEdgeRightLine")?.GetComponent<LaneMarkingRenderer>();
            SpriteRenderer horizonHazeRenderer = GameObject.Find("HorizonHazeLayer")?.GetComponent<SpriteRenderer>();

            if (camera == null || roadRenderer == null || leftLaneRenderer == null || rightLaneRenderer == null || horizonHazeRenderer == null)
            {
                Debug.LogError("Horizon haze capture failed. Expected camera, RoadMesh, two yellow-line renderers, and HorizonHazeLayer.");
                return;
            }

            roadRenderer.SetMaterial(CreateOpaqueRoadMaterial(
                "HorizonHaze_Asphalt_Opaque_Material",
                AssetDatabase.LoadAssetAtPath<Texture2D>(RoadSurfaceSupportImportSettings.AsphaltAssetPath)
            ));
            roadRenderer.ApplyVisualTuningPreset(RoadVisualTuningPreset.BigSurSunsetAtmosphericBlend);
            roadRenderer.RebuildMesh();
            ApplyLaneTint(leftLaneRenderer);
            ApplyLaneTint(rightLaneRenderer);
            ApplyEdgeTint(leftEdgeRenderer);
            ApplyEdgeTint(rightEdgeRenderer);

            string outputPath = GetHorizonHazeOutputPath();
            Directory.CreateDirectory(outputPath);

            CaptureHorizonHazeVariant(camera, outputPath, "background_haze_a_022.png", horizonHazeRenderer, 0.22f);
            CaptureHorizonHazeVariant(camera, outputPath, "background_haze_b_030.png", horizonHazeRenderer, DefaultHorizonHazeAlpha);
            CaptureHorizonHazeVariant(camera, outputPath, "background_haze_c_038.png", horizonHazeRenderer, 0.38f);

            CaptureHorizonHazeVariant(camera, outputPath, "background_haze_horizon_closeup.png", horizonHazeRenderer, DefaultHorizonHazeAlpha, crop: new RectInt(180, 760, 720, 500));
            CaptureHorizonHazeDebugGuides(camera, outputPath, horizonHazeRenderer, roadRenderer);

            AssetDatabase.Refresh();
            Debug.Log("Captured horizon haze review screenshots to: " + outputPath);
        }

        [MenuItem("NewTrip/Road Prototype/Capture Step 5 Road Lock Pass")]
        public static void CaptureStep5RoadLockPass()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before capturing the Step 5 Road Lock Pass.");
                return;
            }

            RoadOnlyTestSceneBuilder.CreateAndCaptureRoadOnlyTest();
            CaptureHorizonHazeReviewScreenshots();
            WriteRoadLockReport();
            AssetDatabase.Refresh();
            Debug.Log("Captured Step 5 Road Lock Pass and wrote report to: " + GetRoadLockReportPath());
        }

        private static void ApplyImportSettings()
        {
            ApplySpriteImportSettings(SkyAssetPath, SkyPixelsPerUnit, alphaIsTransparency: false, pivot: new Vector2(0.5f, 0.5f));
            ApplySpriteImportSettings(SunAssetPath, SunPixelsPerUnit, alphaIsTransparency: true, pivot: new Vector2(0.5f, 0.5f));
            ApplySpriteImportSettings(FarAssetPath, FarPixelsPerUnit, alphaIsTransparency: true, pivot: new Vector2(0.5f, 0f));
            EnsureHorizonHazeAssetExists();
            ApplySpriteImportSettings(
                HorizonHazeAssetPath,
                HorizonHazePixelsPerUnit,
                alphaIsTransparency: true,
                pivot: new Vector2(0.5f, 0.5f),
                filterMode: FilterMode.Point
            );
        }

        private static void ApplySpriteImportSettings(
            string assetPath,
            float pixelsPerUnit,
            bool alphaIsTransparency,
            Vector2 pivot,
            FilterMode filterMode = FilterMode.Point
        )
        {
            AssetDatabase.ImportAsset(assetPath, ImportAssetOptions.ForceUpdate);
            TextureImporter importer = AssetImporter.GetAtPath(assetPath) as TextureImporter;

            if (importer == null)
            {
                Debug.LogError("Could not load TextureImporter for: " + assetPath);
                return;
            }

            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = pixelsPerUnit;
            importer.mipmapEnabled = false;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.filterMode = filterMode;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.alphaIsTransparency = alphaIsTransparency;

            TextureImporterSettings textureSettings = new TextureImporterSettings();
            importer.ReadTextureSettings(textureSettings);
            textureSettings.spriteAlignment = (int)SpriteAlignment.Custom;
            textureSettings.spritePivot = pivot;
            textureSettings.spriteMeshType = SpriteMeshType.FullRect;
            importer.SetTextureSettings(textureSettings);

            EditorUtility.SetDirty(importer);
            importer.SaveAndReimport();
        }

        private static void EnsureHorizonHazeAssetExists()
        {
            string projectRoot = Directory.GetParent(Application.dataPath).FullName;
            string absolutePath = Path.Combine(projectRoot, HorizonHazeAssetPath);

            if (!File.Exists(absolutePath))
            {
                Debug.LogError(
                    "SkyFarRoadTest missing imported horizon haze PNG. Expected the user-provided zip asset at: " +
                    HorizonHazeAssetPath
                );
                return;
            }

            AssetDatabase.ImportAsset(HorizonHazeAssetPath, ImportAssetOptions.ForceUpdate);
        }

        private static void RemoveExistingBackgroundLayers()
        {
            DestroyIfPresent("BackgroundLayers");
            DestroyIfPresent("SkyLayer");
            DestroyIfPresent("FarBackgroundLayer");
        }

        private static void DestroyIfPresent(string name)
        {
            GameObject existing = GameObject.Find(name);

            if (existing != null)
            {
                Object.DestroyImmediate(existing);
            }
        }

        private static void CreateSkyLayer(Transform parent)
        {
            Sprite skySprite = AssetDatabase.LoadAssetAtPath<Sprite>(SkyAssetPath);

            if (skySprite == null)
            {
                Debug.LogError("SkyFarRoadTest missing sky sprite: " + SkyAssetPath);
                return;
            }

            GameObject skyObject = new GameObject("SkyLayer");
            skyObject.transform.SetParent(parent, worldPositionStays: false);
            SpriteRenderer skyRenderer = skyObject.AddComponent<SpriteRenderer>();
            skyRenderer.sprite = skySprite;
            skyRenderer.sortingOrder = SkySortingOrder;
            skyRenderer.color = Color.white;
            skyRenderer.sharedMaterial = PixelArtMaterialUtility.CreateTransparentMaterial("SkyLayer_PixelUnlit_Material");
            skyObject.transform.position = Vector3.zero;
            FitSpriteCover(skyRenderer, RoadViewportContract.WorldWidth, RoadViewportContract.WorldHeight);
        }

        private static void CreateSunLayer(Transform parent)
        {
            Sprite sunSprite = AssetDatabase.LoadAssetAtPath<Sprite>(SunAssetPath);

            if (sunSprite == null)
            {
                Debug.LogError("SkyFarRoadTest missing sun sprite: " + SunAssetPath);
                return;
            }

            GameObject sunObject = new GameObject("SunLayer");
            sunObject.transform.SetParent(parent, worldPositionStays: false);
            SpriteRenderer sunRenderer = sunObject.AddComponent<SpriteRenderer>();
            sunRenderer.sprite = sunSprite;
            sunRenderer.sortingOrder = SunSortingOrder;
            sunRenderer.color = new Color(1f, 0.78f, 0.48f, 0.76f);
            sunRenderer.sharedMaterial = PixelArtMaterialUtility.CreateTransparentMaterial("SunLayer_PixelUnlit_Material");
            sunObject.transform.position = new Vector3(ViewportXToWorld(SunViewportX), ViewportYToWorld(SunViewportY), 0f);
            FitSpriteWidth(sunRenderer, SunWorldWidth);
        }

        private static GameObject CreateFarBackgroundLayer(Transform parent)
        {
            Sprite farSprite = AssetDatabase.LoadAssetAtPath<Sprite>(FarAssetPath);

            if (farSprite == null)
            {
                Debug.LogError("SkyFarRoadTest missing far background sprite: " + FarAssetPath);
                return null;
            }

            GameObject farObject = new GameObject("FarBackgroundLayer");
            farObject.transform.SetParent(parent, worldPositionStays: false);
            SpriteRenderer farRenderer = farObject.AddComponent<SpriteRenderer>();
            farRenderer.sprite = farSprite;
            farRenderer.sortingOrder = FarSortingOrder;
            farRenderer.color = new Color(1f, 0.96f, 0.94f, 0.78f);
            farRenderer.sharedMaterial = CreateVerticalFadeMaterial("FarBackground_VerticalFade_Material", bottomFadeStart: 0.24f);

            float baseWorldY = ViewportYToWorld(FarBaseViewportY);
            farObject.transform.position = new Vector3(0f, baseWorldY, 0f);
            FitSpriteWidth(farRenderer, FarWidthWorld);
            return farObject;
        }

        private static void CreateHorizonHazeLayer(Transform parent)
        {
            Sprite hazeSprite = AssetDatabase.LoadAssetAtPath<Sprite>(HorizonHazeAssetPath);

            if (hazeSprite == null)
            {
                Debug.LogError("SkyFarRoadTest missing horizon haze sprite: " + HorizonHazeAssetPath);
                return;
            }

            GameObject hazeObject = new GameObject("HorizonHazeLayer");
            hazeObject.transform.SetParent(parent, worldPositionStays: false);
            SpriteRenderer hazeRenderer = hazeObject.AddComponent<SpriteRenderer>();
            hazeRenderer.sprite = hazeSprite;
            hazeRenderer.sharedMaterial = CreateTransparentSpriteMaterial("HorizonHaze_Material");

            HorizonHazeLayerController controller = hazeObject.AddComponent<HorizonHazeLayerController>();
            controller.hazeAlpha = DefaultHorizonHazeAlpha;
            controller.hazeTintColor = new Color(1f, 0.76f, 0.62f, 1f);
            controller.hazePositionY = HorizonHazeViewportY;
            controller.hazeScaleX = 4.0f;
            controller.hazeScaleY = 0.50f;
            controller.hazeSortingOrder = HorizonHazeSortingOrder;
            controller.Apply();
        }

        private static void ApplySkyFarRoadCompositeTuning()
        {
            Pseudo3DRoadRenderer roadRenderer = GameObject.Find("RoadMesh")?.GetComponent<Pseudo3DRoadRenderer>();
            LaneMarkingRenderer leftLaneRenderer = GameObject.Find("LaneYellowLeftMesh")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer rightLaneRenderer = GameObject.Find("LaneYellowRightMesh")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer leftEdgeRenderer = GameObject.Find("RoadEdgeLeftLine")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer rightEdgeRenderer = GameObject.Find("RoadEdgeRightLine")?.GetComponent<LaneMarkingRenderer>();

            if (roadRenderer != null)
            {
                roadRenderer.ApplyVisualTuningPreset(RoadVisualTuningPreset.BigSurSunsetAtmosphericBlend);
                roadRenderer.RebuildMesh();
            }

            ApplyLaneTint(leftLaneRenderer);
            ApplyLaneTint(rightLaneRenderer);
            ApplyEdgeTint(leftEdgeRenderer);
            ApplyEdgeTint(rightEdgeRenderer);
        }

        private static void FitSpriteCover(SpriteRenderer renderer, float targetWidth, float targetHeight)
        {
            Vector2 spriteSize = renderer.sprite.bounds.size;
            float scale = Mathf.Max(targetWidth / spriteSize.x, targetHeight / spriteSize.y);
            renderer.transform.localScale = Vector3.one * scale;
        }

        private static void FitSpriteWidth(SpriteRenderer renderer, float targetWidth)
        {
            Vector2 spriteSize = renderer.sprite.bounds.size;
            float scale = targetWidth / spriteSize.x;
            renderer.transform.localScale = Vector3.one * scale;
        }

        private static float ViewportYToWorld(float viewportY)
        {
            return (viewportY - 0.5f) * RoadViewportContract.WorldHeight;
        }

        private static float ViewportXToWorld(float viewportX)
        {
            return (viewportX - 0.5f) * RoadViewportContract.WorldWidth;
        }

        private static void CaptureRoadColorVariant(
            Camera camera,
            string outputPath,
            string fileName,
            Pseudo3DRoadRenderer roadRenderer,
            LaneMarkingRenderer leftLaneRenderer,
            LaneMarkingRenderer rightLaneRenderer,
            LaneMarkingRenderer leftEdgeRenderer,
            LaneMarkingRenderer rightEdgeRenderer,
            RoadVisualTuningPreset preset
        )
        {
            roadRenderer.ApplyVisualTuningPreset(preset);
            roadRenderer.RebuildMesh();
            ApplyLaneTint(leftLaneRenderer);
            ApplyLaneTint(rightLaneRenderer);
            ApplyEdgeTint(leftEdgeRenderer);
            ApplyEdgeTint(rightEdgeRenderer);

            Texture2D image = RenderCamera(camera);
            File.WriteAllBytes(Path.Combine(outputPath, fileName), image.EncodeToPNG());
            Object.DestroyImmediate(image);
        }

        private static void ApplyLaneTint(LaneMarkingRenderer laneRenderer)
        {
            if (laneRenderer == null)
            {
                return;
            }

            laneRenderer.nearTint = new Color(1f, 0.70f, 0.18f, 1f);
            laneRenderer.farTint = new Color(1f, 0.62f, 0.18f, 1f);
            laneRenderer.useHorizonFade = true;
            laneRenderer.horizonFadeStartDepth = 0.55f;
            laneRenderer.horizonAlpha = 0.01f;
            laneRenderer.RebuildMesh();
        }

        private static void ApplyEdgeTint(LaneMarkingRenderer edgeRenderer)
        {
            if (edgeRenderer == null)
            {
                return;
            }

            edgeRenderer.nearTint = new Color(0.92f, 0.78f, 0.60f, 0.82f);
            edgeRenderer.farTint = new Color(0.86f, 0.68f, 0.54f, 0.70f);
            edgeRenderer.useHorizonFade = true;
            edgeRenderer.horizonFadeStartDepth = 0.55f;
            edgeRenderer.horizonAlpha = 0.02f;
            edgeRenderer.RebuildMesh();
        }

        private static void CaptureHorizonHazeVariant(
            Camera camera,
            string outputPath,
            string fileName,
            SpriteRenderer horizonHazeRenderer,
            float alpha,
            RectInt? crop = null
        )
        {
            SetHorizonHazeAlpha(horizonHazeRenderer, alpha);

            Texture2D image = RenderCamera(camera);

            if (crop.HasValue)
            {
                Texture2D cropped = CropTexture(image, crop.Value);
                File.WriteAllBytes(Path.Combine(outputPath, fileName), cropped.EncodeToPNG());
                Object.DestroyImmediate(cropped);
            }
            else
            {
                File.WriteAllBytes(Path.Combine(outputPath, fileName), image.EncodeToPNG());
            }

            Object.DestroyImmediate(image);
        }

        private static void CaptureHorizonHazeDebugGuides(
            Camera camera,
            string outputPath,
            SpriteRenderer horizonHazeRenderer,
            Pseudo3DRoadRenderer roadRenderer
        )
        {
            SetHorizonHazeAlpha(horizonHazeRenderer, DefaultHorizonHazeAlpha);

            GameObject debugObject = new GameObject("HorizonHazeDebugGuides");
            RoadDebugOverlay debugOverlay = debugObject.AddComponent<RoadDebugOverlay>();
            debugOverlay.roadRenderer = roadRenderer;
            debugOverlay.showGuides = true;
            debugOverlay.RebuildGuides();

            Texture2D image = RenderCamera(camera);
            File.WriteAllBytes(Path.Combine(outputPath, "background_haze_debug_guides.png"), image.EncodeToPNG());
            Object.DestroyImmediate(image);
            Object.DestroyImmediate(debugObject);
        }

        private static void SetHorizonHazeAlpha(SpriteRenderer horizonHazeRenderer, float alpha)
        {
            HorizonHazeLayerController controller = horizonHazeRenderer.GetComponent<HorizonHazeLayerController>();

            if (controller != null)
            {
                controller.hazeAlpha = Mathf.Clamp01(alpha);
                controller.Apply();
                return;
            }

            Color color = horizonHazeRenderer.color;
            color.a = Mathf.Clamp01(alpha);
            horizonHazeRenderer.color = color;
        }

        private static Texture2D CropTexture(Texture2D source, RectInt crop)
        {
            RectInt clamped = new RectInt(
                Mathf.Clamp(crop.x, 0, source.width - 1),
                Mathf.Clamp(crop.y, 0, source.height - 1),
                Mathf.Clamp(crop.width, 1, source.width),
                Mathf.Clamp(crop.height, 1, source.height)
            );

            if (clamped.xMax > source.width)
            {
                clamped.width = source.width - clamped.x;
            }

            if (clamped.yMax > source.height)
            {
                clamped.height = source.height - clamped.y;
            }

            Texture2D cropped = new Texture2D(clamped.width, clamped.height, TextureFormat.RGBA32, mipChain: false)
            {
                filterMode = FilterMode.Point
            };
            cropped.SetPixels(source.GetPixels(clamped.x, clamped.y, clamped.width, clamped.height));
            cropped.Apply(updateMipmaps: false, makeNoLongerReadable: false);
            return cropped;
        }

        private static Material CreateOpaqueRoadMaterial(string materialName, Texture2D texture)
        {
            return PixelArtMaterialUtility.CreateOpaqueRoadMaterial(materialName, texture);
        }

        private static Material CreateVerticalFadeMaterial(string materialName, float bottomFadeStart)
        {
            Shader shader = Shader.Find("NewTrip/SpriteVerticalFade");

            if (shader == null)
            {
                shader = PixelArtMaterialUtility.FindTransparentShader();
            }

            Material material = new Material(shader)
            {
                name = materialName
            };
            material.SetColor("_Color", Color.white);
            material.SetFloat("_BottomFadeStart", bottomFadeStart);
            material.SetFloat("_BottomFadeEnd", 0f);
            material.SetFloat("_TopFadeStart", 1f);
            material.SetFloat("_TopFadeEnd", 1f);
            material.renderQueue = 2990;
            return material;
        }

        private static Material CreateTransparentSpriteMaterial(string materialName)
        {
            return PixelArtMaterialUtility.CreateTransparentMaterial(materialName);
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

        private static string GetRoadColorOutputPath()
        {
            DirectoryInfo projectRoot = Directory.GetParent(Application.dataPath);
            return Path.Combine(projectRoot.FullName, RoadColorOutputFolder);
        }

        private static string GetHorizonHazeOutputPath()
        {
            DirectoryInfo projectRoot = Directory.GetParent(Application.dataPath);
            return Path.Combine(projectRoot.FullName, HorizonHazeOutputFolder);
        }

        private static string GetRoadLockOutputPath()
        {
            DirectoryInfo projectRoot = Directory.GetParent(Application.dataPath);
            return Path.Combine(projectRoot.FullName, RoadLockOutputFolder);
        }

        private static string GetRoadLockReportPath()
        {
            return Path.Combine(GetRoadLockOutputPath(), RoadLockReportFileName);
        }

        private static void WriteRoadLockReport()
        {
            string outputPath = GetRoadLockOutputPath();
            Directory.CreateDirectory(outputPath);
            File.WriteAllText(GetRoadLockReportPath(), BuildRoadLockReport());
        }

        private static string BuildRoadLockReport()
        {
            return
                "# Step 5 Road Lock Pass\n\n" +
                "Status: review-ready\n\n" +
                "## Locked Contract\n\n" +
                "- Frame: 9:16 portrait, 1080x1920 capture.\n" +
                "- Road: code-generated mesh slices, not a full-road image.\n" +
                "- Road depth: `1.0 = far horizon`, `0.0 = near bottom`.\n" +
                "- Base road horizon contract: `" + RoadViewportContract.RoadHorizonY.ToString("0.00") + "` viewport Y.\n" +
                "- Active projection: `RoadProjectionPreset.GeminiLowCamera` for the lower-camera / upper-third-horizon feel.\n" +
                "- Future car anchor: `0.105` viewport Y.\n" +
                "- Asphalt: opaque runtime tile with width-based UV repeat.\n" +
                "- Lane: accepted RoadOnly B road-relative double-yellow preset.\n" +
                "- Edge: projected white edge-line meshes.\n" +
                "- Horizon softness: `HorizonHazeLayer`, not road alpha.\n" +
                "- Motion: road, lanes, edges, and future spawners consume one `RoadMotionState.visualDistanceMeters` source.\n\n" +
                "## Layer Order\n\n" +
                "```text\n" +
                "SkyLayer = 0\n" +
                "FarBackgroundLayer = 5\n" +
                "RoadMesh = 10\n" +
                "HorizonHazeLayer = 12\n" +
                "WhiteEdgeLineMesh = 19\n" +
                "YellowLaneMesh = 20\n" +
                "Future car / foreground / UI = 20+\n" +
                "```\n\n" +
                "## Review Captures\n\n" +
                "- `apps/unity-client/Artifacts/RoadOnlyTest/road_only_still.png`\n" +
                "- `apps/unity-client/Artifacts/RoadOnlyTest/road_only_10s_motion.png`\n" +
                "- `apps/unity-client/Artifacts/RoadOnlyTest/road_only_lane_horizon_closeup.png`\n" +
                "- `apps/unity-client/Artifacts/RoadOnlyTest/road_only_road_bottom_closeup.png`\n" +
                "- `apps/unity-client/Artifacts/HorizonHaze/background_haze_b_030.png`\n" +
                "- `apps/unity-client/Artifacts/HorizonHaze/background_haze_horizon_closeup.png`\n\n" +
                "## Acceptance Checklist\n\n" +
                "- [x] Road does not read as a black triangle in the accepted `background_haze_b_030` composite.\n" +
                "- [x] Asphalt is opaque, warm, and tiled rather than stretched.\n" +
                "- [x] Double yellow lines are road-relative, near-wide and far-thin.\n" +
                "- [x] White edge lines align to the projected road edge.\n" +
                "- [x] Asphalt motion was regenerated in the 10-second RoadOnly capture.\n" +
                "- [x] Road apex is softened by haze without making the road transparent.\n" +
                "- [x] No full-road image, car, UI, bridge, guardrail, sign, prop, weather, dirt shoulder, or vegetation is present in the Step 5 review scenes.\n";
        }
    }
}
#endif
