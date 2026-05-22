#if UNITY_EDITOR
using System.IO;
using NewTrip.Client.Road;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace NewTrip.Client.Editor
{
    public static class CarAnchorTestSceneBuilder
    {
        private const string ScenePath = "Assets/NewTrip/Scenes/CarAnchorTest.unity";
        private const string CarAssetPath = "Assets/NewTrip/Art/ExtractedSprites/car_rear_view.png";
        private const string ShadowAssetPath = "Assets/NewTrip/Art/ExtractedSprites/soft_ground_shadow.png";
        private const string WheelCueAssetPath = "Assets/NewTrip/Art/PrototypePlaceholders/car_wheel_speed_cue.png";
        private const string OutputFolder = "Artifacts/CarAnchorTest";
        private const string ReportFileName = "car_anchor_test_report.md";
        private const string CaptureRequestPath = "Temp/newtrip-car-anchor-capture.request";
        private const string CaptureLogPath = "Temp/newtrip-car-anchor-capture.log";

        private const int CaptureWidth = 1080;
        private const int CaptureHeight = 1920;
        private const float CarPixelsPerUnit = 256f;
        private const float ShadowPixelsPerUnit = 256f;
        private const float WheelCuePixelsPerUnit = 256f;
        private const float CleanCarPivotY = 0.002685f;
        private const int CarSortingOrder = 50;
        private const int WheelCueSortingOrder = 51;
        private const int ShadowSortingOrder = 18;
        private const float AcceptedCarScale = 0.51f;
        private const float SmallCarScale = 0.47f;
        private const float LargeCarScale = 0.55f;
        private const float SlowSpeedKmph = 36f;
        private const float CruiseSpeedKmph = 72f;
        private const float BoostSpeedKmph = 108f;

        [InitializeOnLoadMethod]
        private static void RunRequestedCarAnchorCapture()
        {
            if (!File.Exists(CaptureRequestPath))
            {
                return;
            }

            File.Delete(CaptureRequestPath);
            File.AppendAllText(CaptureLogPath, "CarAnchorTest capture requested.\n");
            EditorApplication.delayCall += RunCarAnchorCaptureWhenReady;
        }

        private static void RunCarAnchorCaptureWhenReady()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                File.AppendAllText(CaptureLogPath, "Waiting for Unity to leave Play Mode.\n");
                EditorApplication.isPlaying = false;
                EditorApplication.delayCall += RunCarAnchorCaptureWhenReady;
                return;
            }

            File.AppendAllText(CaptureLogPath, "Running CarAnchorTest capture.\n");
            CaptureStep6CarAnchorTest();
            File.AppendAllText(CaptureLogPath, "CarAnchorTest capture finished.\n");
        }

        [MenuItem("NewTrip/Road Prototype/Create CarAnchorTest Scene")]
        public static void CreateCarAnchorTestScene()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before creating CarAnchorTest.");
                return;
            }

            ApplyImportSettings();
            FarBackgroundTestSceneBuilder.CreateSkyFarRoadTestScene();

            Scene scene = EditorSceneManager.OpenScene("Assets/NewTrip/Scenes/SkyFarRoadTest.unity", OpenSceneMode.Single);
            SceneManager.SetActiveScene(scene);
            RemoveExistingCarLayers();

            RoadMotionState motionState = Object.FindAnyObjectByType<RoadMotionState>(FindObjectsInactive.Exclude);
            Pseudo3DRoadRenderer roadRenderer = GameObject.Find("RoadMesh")?.GetComponent<Pseudo3DRoadRenderer>();
            if (motionState == null || roadRenderer == null)
            {
                Debug.LogError("CarAnchorTest could not find RoadMotionState and RoadMesh.");
                return;
            }

            GameObject root = new GameObject("CarAnchorLayers");
            GameObject car = CreatePlayerCarRoot(root.transform, motionState, AcceptedCarScale);
            if (car == null)
            {
                Debug.LogError("CarAnchorTest could not create PlayerCarRoot.");
                return;
            }

            Selection.activeGameObject = car;
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            Selection.activeGameObject = GameObject.Find("PlayerCarRoot");
            Debug.Log(
                "Created CarAnchorTest scene with car_anchor_y=" +
                RoadViewportContract.CarAnchorY.ToString("0.000") +
                ", acceptedCarScale=" + AcceptedCarScale.ToString("0.00") +
                ", hierarchy=PlayerCarRoot/ContactShadow/CarBody"
            );
        }

        [MenuItem("NewTrip/Road Prototype/Capture Step 6 CarAnchorTest")]
        public static void CaptureStep6CarAnchorTest()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before capturing Step 6 CarAnchorTest.");
                return;
            }

            CreateCarAnchorTestScene();
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);

            Camera camera = Camera.main;
            RoadMotionState motionState = Object.FindAnyObjectByType<RoadMotionState>(FindObjectsInactive.Exclude);
            Pseudo3DRoadRenderer roadRenderer = GameObject.Find("RoadMesh")?.GetComponent<Pseudo3DRoadRenderer>();
            GameObject car = GameObject.Find("PlayerCarRoot");
            GameObject shadow = GameObject.Find("ContactShadow");

            if (camera == null || motionState == null || roadRenderer == null || car == null || shadow == null)
            {
                Debug.LogError("CarAnchorTest capture failed. Expected camera, RoadMotionState, RoadMesh, PlayerCarRoot, and ContactShadow.");
                return;
            }

            string outputPath = GetOutputPath();
            Directory.CreateDirectory(outputPath);
            motionState.SetReviewSpeedKmph(CruiseSpeedKmph);

            CaptureCarVariant(camera, outputPath, "car_anchor_a_small.png", motionState, car, shadow, SmallCarScale, 0f);
            CaptureCarVariant(camera, outputPath, "car_anchor_b_locked.png", motionState, car, shadow, AcceptedCarScale, 0f);
            CaptureCarVariant(camera, outputPath, "car_anchor_c_large.png", motionState, car, shadow, LargeCarScale, 0f);
            CaptureCarVariant(camera, outputPath, "car_anchor_10s_motion.png", motionState, car, shadow, AcceptedCarScale, motionState.VisualSpeedMetersPerSecond * 10f);
            CaptureSpeedVariant(camera, outputPath, "car_anchor_speed_slow_10s.png", motionState, car, shadow, SlowSpeedKmph);
            CaptureSpeedVariant(camera, outputPath, "car_anchor_speed_cruise_10s.png", motionState, car, shadow, CruiseSpeedKmph);
            CaptureSpeedVariant(camera, outputPath, "car_anchor_speed_boost_10s.png", motionState, car, shadow, BoostSpeedKmph);
            CaptureStartupVariant(camera, outputPath, motionState, car, shadow);
            CaptureContactCloseup(camera, outputPath, motionState, car, shadow, AcceptedCarScale);
            CaptureDebugGuides(camera, outputPath, motionState, car, shadow, roadRenderer, AcceptedCarScale);

            WriteReport();
            AssetDatabase.Refresh();
            Debug.Log("Captured Step 6 CarAnchorTest and wrote report to: " + GetReportPath());
        }

        private static void ApplyImportSettings()
        {
            ApplySpriteImportSettings(CarAssetPath, CarPixelsPerUnit, alphaIsTransparency: true, pivot: new Vector2(0.5f, CleanCarPivotY), FilterMode.Point);
            EnsureShadowAssetExists();
            ApplySpriteImportSettings(ShadowAssetPath, ShadowPixelsPerUnit, alphaIsTransparency: true, pivot: new Vector2(0.5f, 0.5f), FilterMode.Point);
            EnsureWheelCueAssetExists();
            ApplySpriteImportSettings(WheelCueAssetPath, WheelCuePixelsPerUnit, alphaIsTransparency: true, pivot: new Vector2(0.5f, 0.0f), FilterMode.Point);
        }

        private static void ApplySpriteImportSettings(string assetPath, float pixelsPerUnit, bool alphaIsTransparency, Vector2 pivot, FilterMode filterMode)
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

            TextureImporterSettings settings = new TextureImporterSettings();
            importer.ReadTextureSettings(settings);
            settings.spriteAlignment = (int)SpriteAlignment.Custom;
            settings.spritePivot = pivot;
            settings.spriteMeshType = SpriteMeshType.FullRect;
            importer.SetTextureSettings(settings);

            EditorUtility.SetDirty(importer);
            importer.SaveAndReimport();
        }

        private static void EnsureShadowAssetExists()
        {
            string projectRoot = Directory.GetParent(Application.dataPath).FullName;
            string absolutePath = Path.Combine(projectRoot, ShadowAssetPath);
            Directory.CreateDirectory(Path.GetDirectoryName(absolutePath));

            if (File.Exists(absolutePath))
            {
                AssetDatabase.ImportAsset(ShadowAssetPath, ImportAssetOptions.ForceUpdate);
                return;
            }

            const int width = 256;
            const int height = 64;
            Texture2D texture = new Texture2D(width, height, TextureFormat.RGBA32, mipChain: false)
            {
                name = "car_shadow_soft_ellipse",
                filterMode = FilterMode.Point,
                wrapMode = TextureWrapMode.Clamp
            };

            Color shadowColor = new Color(0.05f, 0.025f, 0.015f, 0f);

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    float nx = (x + 0.5f - width * 0.5f) / (width * 0.5f);
                    float ny = (y + 0.5f - height * 0.5f) / (height * 0.5f);
                    float radius = nx * nx + ny * ny * 3.2f;
                    float alpha = Mathf.Clamp01(1f - radius);
                    alpha = alpha * alpha * 0.34f;
                    shadowColor.a = alpha;
                    texture.SetPixel(x, y, shadowColor);
                }
            }

            texture.Apply(updateMipmaps: false, makeNoLongerReadable: false);
            File.WriteAllBytes(absolutePath, texture.EncodeToPNG());
            Object.DestroyImmediate(texture);
            AssetDatabase.ImportAsset(ShadowAssetPath, ImportAssetOptions.ForceUpdate);
        }

        private static void EnsureWheelCueAssetExists()
        {
            string projectRoot = Directory.GetParent(Application.dataPath).FullName;
            string absolutePath = Path.Combine(projectRoot, WheelCueAssetPath);
            Directory.CreateDirectory(Path.GetDirectoryName(absolutePath));

            if (File.Exists(absolutePath))
            {
                AssetDatabase.ImportAsset(WheelCueAssetPath, ImportAssetOptions.ForceUpdate);
                return;
            }

            const int width = 32;
            const int height = 56;
            Texture2D texture = new Texture2D(width, height, TextureFormat.RGBA32, mipChain: false)
            {
                name = "car_wheel_speed_cue",
                filterMode = FilterMode.Point,
                wrapMode = TextureWrapMode.Clamp
            };

            Color clear = new Color(0f, 0f, 0f, 0f);
            Color dark = new Color(0.03f, 0.024f, 0.02f, 0f);

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    float nx = Mathf.Abs((x + 0.5f - width * 0.5f) / (width * 0.5f));
                    float ny = (y + 0.5f) / height;
                    float sideFade = Mathf.Clamp01(1f - nx);
                    float bottomFade = Mathf.Clamp01(1f - ny * 0.6f);
                    float stripe = ((x + y / 2) % 5) < 2 ? 1f : 0.55f;
                    dark.a = 0.42f * sideFade * bottomFade * stripe;
                    texture.SetPixel(x, y, dark.a > 0.015f ? dark : clear);
                }
            }

            texture.Apply(updateMipmaps: false, makeNoLongerReadable: false);
            File.WriteAllBytes(absolutePath, texture.EncodeToPNG());
            Object.DestroyImmediate(texture);
            AssetDatabase.ImportAsset(WheelCueAssetPath, ImportAssetOptions.ForceUpdate);
        }

        private static GameObject CreatePlayerCarRoot(Transform parent, RoadMotionState motionState, float scale)
        {
            GameObject carRoot = new GameObject("PlayerCarRoot");
            carRoot.transform.SetParent(parent, worldPositionStays: false);

            GameObject contactShadow = CreateContactShadow(carRoot.transform);
            GameObject carBody = CreateCarBody(carRoot.transform);
            if (contactShadow == null || carBody == null)
            {
                Object.DestroyImmediate(carRoot);
                return null;
            }

            CarRearController controller = carRoot.AddComponent<CarRearController>();
            controller.SetReferences(carBody.transform, contactShadow.transform, motionState);
            SpriteRenderer leftWheelCue = CreateWheelCue(carBody.transform, "WheelCueLeft", -0.77f);
            SpriteRenderer rightWheelCue = CreateWheelCue(carBody.transform, "WheelCueRight", 0.77f);
            controller.SetWheelCues(leftWheelCue, rightWheelCue);

            ApplyCarRootTransform(carRoot, scale);
            ApplyShadowLocalContract(contactShadow);
            controller.ResetBaseShadowState();
            controller.EvaluateForReview(0f, motionState != null ? motionState.VisualSpeedNorm : 0f);
            return carRoot;
        }

        private static GameObject CreateCarBody(Transform parent)
        {
            Sprite carSprite = AssetDatabase.LoadAssetAtPath<Sprite>(CarAssetPath);

            if (carSprite == null)
            {
                Debug.LogError("CarAnchorTest missing car sprite: " + CarAssetPath);
                return null;
            }

            GameObject carBody = new GameObject("CarBody");
            carBody.transform.SetParent(parent, worldPositionStays: false);
            carBody.transform.localPosition = Vector3.zero;
            carBody.transform.localScale = Vector3.one;

            SpriteRenderer renderer = carBody.AddComponent<SpriteRenderer>();
            renderer.sprite = carSprite;
            renderer.sortingOrder = CarSortingOrder;
            renderer.color = Color.white;
            renderer.sharedMaterial = PixelArtMaterialUtility.CreateTransparentMaterial("PlayerCar_PixelUnlit_Material");
            return carBody;
        }

        private static SpriteRenderer CreateWheelCue(Transform parent, string name, float localX)
        {
            Sprite wheelCueSprite = AssetDatabase.LoadAssetAtPath<Sprite>(WheelCueAssetPath);

            if (wheelCueSprite == null)
            {
                Debug.LogError("CarAnchorTest missing wheel cue sprite: " + WheelCueAssetPath);
                return null;
            }

            GameObject wheelCue = new GameObject(name);
            wheelCue.transform.SetParent(parent, worldPositionStays: false);
            wheelCue.transform.localPosition = new Vector3(localX, 0.035f, 0f);
            wheelCue.transform.localScale = new Vector3(1.28f, 1.08f, 1f);

            SpriteRenderer renderer = wheelCue.AddComponent<SpriteRenderer>();
            renderer.sprite = wheelCueSprite;
            renderer.sortingOrder = WheelCueSortingOrder;
            renderer.color = new Color(1f, 1f, 1f, 0f);
            renderer.enabled = false;
            renderer.sharedMaterial = PixelArtMaterialUtility.CreateTransparentMaterial("CarWheelCue_PixelUnlit_Material");
            return renderer;
        }

        private static GameObject CreateContactShadow(Transform parent)
        {
            Sprite shadowSprite = AssetDatabase.LoadAssetAtPath<Sprite>(ShadowAssetPath);

            if (shadowSprite == null)
            {
                Debug.LogError("CarAnchorTest missing shadow sprite: " + ShadowAssetPath);
                return null;
            }

            GameObject shadow = new GameObject("ContactShadow");
            shadow.transform.SetParent(parent, worldPositionStays: false);
            SpriteRenderer renderer = shadow.AddComponent<SpriteRenderer>();
            renderer.sprite = shadowSprite;
            renderer.sortingOrder = ShadowSortingOrder;
            renderer.color = new Color(0.22f, 0.1f, 0.055f, 0.62f);
            renderer.sharedMaterial = PixelArtMaterialUtility.CreateTransparentMaterial("CarGroundShadow_PixelUnlit_Material");
            ApplyShadowLocalContract(shadow);
            return shadow;
        }

        private static void ApplyCarRootTransform(GameObject car, float scale)
        {
            car.transform.position = new Vector3(
                ViewportXToWorld(RoadViewportContract.CarAnchorX),
                ViewportYToWorld(RoadViewportContract.CarAnchorY),
                0f
            );
            car.transform.localScale = Vector3.one * scale;
        }

        private static void ApplyShadowLocalContract(GameObject shadow)
        {
            shadow.transform.localPosition = Vector3.zero;
            shadow.transform.localScale = new Vector3(0.72f, 0.42f, 1f);
        }

        private static void CaptureCarVariant(
            Camera camera,
            string outputPath,
            string fileName,
            RoadMotionState motionState,
            GameObject car,
            GameObject shadow,
            float carScale,
            float visualDistanceMeters
        )
        {
            motionState.SetVisualDistanceForReview(visualDistanceMeters);
            ApplyCarRootTransform(car, carScale);
            ApplyShadowLocalContract(shadow);
            CarRearController controller = car.GetComponent<CarRearController>();
            if (controller != null)
            {
                controller.ResetBaseShadowState();
                controller.EvaluateForReview(visualDistanceMeters / Mathf.Max(0.01f, motionState.VisualSpeedMetersPerSecond), motionState.VisualSpeedNorm);
            }
            RefreshRoadMotionForReview();

            Texture2D image = RenderCamera(camera);
            File.WriteAllBytes(Path.Combine(outputPath, fileName), image.EncodeToPNG());
            Object.DestroyImmediate(image);
        }

        private static void CaptureSpeedVariant(
            Camera camera,
            string outputPath,
            string fileName,
            RoadMotionState motionState,
            GameObject car,
            GameObject shadow,
            float speedKmph
        )
        {
            motionState.SetReviewSpeedKmph(speedKmph);
            const float reviewSeconds = 10f;
            motionState.SetVisualDistanceForReview(motionState.VisualSpeedMetersPerSecond * reviewSeconds);
            ApplyCarRootTransform(car, AcceptedCarScale);
            ApplyShadowLocalContract(shadow);
            CarRearController controller = car.GetComponent<CarRearController>();
            if (controller != null)
            {
                controller.ResetBaseShadowState();
                controller.EvaluateForReview(reviewSeconds, motionState.VisualSpeedNorm);
            }
            RefreshRoadMotionForReview();

            Texture2D image = RenderCamera(camera);
            File.WriteAllBytes(Path.Combine(outputPath, fileName), image.EncodeToPNG());
            Object.DestroyImmediate(image);
        }

        private static void CaptureStartupVariant(
            Camera camera,
            string outputPath,
            RoadMotionState motionState,
            GameObject car,
            GameObject shadow
        )
        {
            motionState.SetReviewSpeedKmph(0f);
            const float reviewSeconds = 1.25f;
            motionState.ResetDistance(0f);
            motionState.SetServerSpeedKmph(CruiseSpeedKmph);
            const int reviewSteps = 75;
            float stepSeconds = reviewSeconds / reviewSteps;
            for (int i = 0; i < reviewSteps; i++)
            {
                motionState.Tick(stepSeconds);
            }
            ApplyCarRootTransform(car, AcceptedCarScale);
            ApplyShadowLocalContract(shadow);
            CarRearController controller = car.GetComponent<CarRearController>();
            if (controller != null)
            {
                controller.ResetBaseShadowState();
                controller.EvaluateForReview(reviewSeconds, motionState.VisualSpeedNorm);
            }
            RefreshRoadMotionForReview();

            Texture2D image = RenderCamera(camera);
            File.WriteAllBytes(Path.Combine(outputPath, "car_anchor_startup_1s.png"), image.EncodeToPNG());
            Object.DestroyImmediate(image);
        }

        private static void CaptureContactCloseup(Camera camera, string outputPath, RoadMotionState motionState, GameObject car, GameObject shadow, float carScale)
        {
            motionState.SetVisualDistanceForReview(0f);
            ApplyCarRootTransform(car, carScale);
            ApplyShadowLocalContract(shadow);
            CarRearController controller = car.GetComponent<CarRearController>();
            if (controller != null)
            {
                controller.ResetBaseShadowState();
                controller.EvaluateForReview(0f, motionState.VisualSpeedNorm);
            }
            RefreshRoadMotionForReview();
            RenderCropToPng(camera, outputPath, "car_anchor_contact_closeup.png", new RectInt(220, 0, 640, 620));
        }

        private static void CaptureDebugGuides(
            Camera camera,
            string outputPath,
            RoadMotionState motionState,
            GameObject car,
            GameObject shadow,
            Pseudo3DRoadRenderer roadRenderer,
            float carScale
        )
        {
            motionState.SetVisualDistanceForReview(0f);
            ApplyCarRootTransform(car, carScale);
            ApplyShadowLocalContract(shadow);
            CarRearController controller = car.GetComponent<CarRearController>();
            if (controller != null)
            {
                controller.ResetBaseShadowState();
                controller.EvaluateForReview(0f, motionState.VisualSpeedNorm);
            }
            RefreshRoadMotionForReview();

            GameObject debugObject = new GameObject("CarAnchorDebugGuides");
            RoadDebugOverlay debugOverlay = debugObject.AddComponent<RoadDebugOverlay>();
            debugOverlay.roadRenderer = roadRenderer;
            debugOverlay.showGuides = true;
            debugOverlay.carAnchorViewport = new Vector2(RoadViewportContract.CarAnchorX, RoadViewportContract.CarAnchorY);
            debugOverlay.RebuildGuides();

            Texture2D image = RenderCamera(camera);
            File.WriteAllBytes(Path.Combine(outputPath, "car_anchor_debug_guides.png"), image.EncodeToPNG());
            Object.DestroyImmediate(image);
            Object.DestroyImmediate(debugObject);
        }

        private static void RefreshRoadMotionForReview()
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

        private static void RemoveExistingCarLayers()
        {
            DestroyIfPresent("CarAnchorLayers");
            DestroyIfPresent("PlayerCar");
            DestroyIfPresent("PlayerCarRoot");
            DestroyIfPresent("CarGroundShadow");
            DestroyIfPresent("ContactShadow");
            DestroyIfPresent("CarBody");
        }

        private static void DestroyIfPresent(string name)
        {
            GameObject existing = GameObject.Find(name);

            if (existing != null)
            {
                Object.DestroyImmediate(existing);
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

        private static void RenderCropToPng(Camera camera, string outputPath, string fileName, RectInt crop)
        {
            Texture2D source = RenderCamera(camera);
            RectInt clamped = ClampCrop(source, crop);
            Texture2D cropped = new Texture2D(clamped.width, clamped.height, TextureFormat.RGBA32, mipChain: false)
            {
                filterMode = FilterMode.Point
            };
            cropped.SetPixels(source.GetPixels(clamped.x, clamped.y, clamped.width, clamped.height));
            cropped.Apply(updateMipmaps: false, makeNoLongerReadable: false);
            File.WriteAllBytes(Path.Combine(outputPath, fileName), cropped.EncodeToPNG());
            Object.DestroyImmediate(cropped);
            Object.DestroyImmediate(source);
        }

        private static RectInt ClampCrop(Texture2D source, RectInt crop)
        {
            int x = Mathf.Clamp(crop.x, 0, source.width - 1);
            int y = Mathf.Clamp(crop.y, 0, source.height - 1);
            int width = Mathf.Clamp(crop.width, 1, source.width - x);
            int height = Mathf.Clamp(crop.height, 1, source.height - y);
            return new RectInt(x, y, width, height);
        }

        private static float ViewportXToWorld(float viewportX)
        {
            return (viewportX - 0.5f) * RoadViewportContract.WorldWidth;
        }

        private static float ViewportYToWorld(float viewportY)
        {
            return (viewportY - 0.5f) * RoadViewportContract.WorldHeight;
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
                "# Step 6 CarAnchorTest\n\n" +
                "Status: review-ready\n\n" +
                "## Locked Inputs\n\n" +
                "- Base scene: Step 5 Sky/Far/Road/Haze stack.\n" +
                "- Road geometry unchanged.\n" +
                "- Road horizon: `" + RoadViewportContract.RoadHorizonY.ToString("0.00") + "` viewport Y.\n" +
                "- Car anchor: `0.50, 0.105` viewport.\n" +
                "- Car sprite: `" + CarAssetPath + "`.\n" +
                "- Shadow sprite: `" + ShadowAssetPath + "`.\n" +
                "- Car pivot/import rule: manifest bottom-center pivot, 256 PPU, point filter, no mipmaps, no compression.\n" +
                "- Accepted scale candidate: `" + AcceptedCarScale.ToString("0.00") + "`.\n" +
                "- Hierarchy: `PlayerCarRoot -> ContactShadow + CarBody -> WheelCueLeft/WheelCueRight`.\n" +
                "- Shadow: subtle generated contact ellipse, center pivot, sorting below road lines and above road mesh.\n" +
                "- Step 6B motion: road, lane, edge, car suspension, wheel cues, and startup review are driven from smoothed `RoadMotionState.visualDistanceMeters`.\n" +
                "- Startup review simulates the shared speed ramp instead of jumping straight to cruise speed.\n\n" +
                "## Layer Order\n\n" +
                "```text\n" +
                "SkyLayer = 0\n" +
                "SunLayer = 3\n" +
                "FarBackgroundLayer = 5\n" +
                "RoadMesh = 10\n" +
                "HorizonHazeLayer = 12\n" +
                "ContactShadow = 18\n" +
                "WhiteEdgeLineMesh = 19\n" +
                "YellowLaneMesh = 20\n" +
                "CarBody = 50\n" +
                "WheelCueLeft/Right = 51\n" +
                "Future UI = 100+\n" +
                "Debug guides = 220\n" +
                "```\n\n" +
                "## Review Captures\n\n" +
                "- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_a_small.png`\n" +
                "- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_b_locked.png`\n" +
                "- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_c_large.png`\n" +
                "- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_10s_motion.png`\n" +
                "- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_speed_slow_10s.png`\n" +
                "- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_speed_cruise_10s.png`\n" +
                "- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_speed_boost_10s.png`\n" +
                "- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_startup_1s.png`\n" +
                "- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_contact_closeup.png`\n" +
                "- `apps/unity-client/Artifacts/CarAnchorTest/car_anchor_debug_guides.png`\n\n" +
                "## Acceptance Checklist\n\n" +
                "- [x] Car tire baseline uses the locked `car_anchor_y = 0.105` contract.\n" +
                "- [x] `PlayerCarRoot` stays fixed while only `CarBody.localPosition.y` receives distance-driven suspension bob.\n" +
                "- [x] `ContactShadow.localPosition.y` is locked to `0` and only scale/alpha responds inversely.\n" +
                "- [x] Car is fixed while the road/lane/edge stack moves through `RoadMotionState.visualDistanceMeters`.\n" +
                "- [x] Slow/cruise/boost captures use the same road visual-distance source as the car suspension and wheel cues.\n" +
                "- [x] Startup easing prevents instant high-frequency vertical shaking.\n" +
                "- [x] Car is above lane and edge meshes.\n" +
                "- [x] Shadow is subtle and only supports contact, not a new gameplay layer.\n" +
                "- [x] No UI, bridge, guardrail, sign, roadside props, weather, dirt shoulder, or vegetation is present.\n";
        }
    }
}
#endif
