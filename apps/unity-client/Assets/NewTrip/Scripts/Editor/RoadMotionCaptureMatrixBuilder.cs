#if UNITY_EDITOR
using System.IO;
using System.Text;
using NewTrip.Client.Road;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace NewTrip.Client.Editor
{
    public static class RoadMotionCaptureMatrixBuilder
    {
        private const string ScenePath = "Assets/NewTrip/Scenes/RoadMotionReview.unity";
        private const string ScreenshotOutputFolder = "Artifacts/RoadMotionMatrix";
        private const float RenderWidth = 5.625f;
        private const float RenderHeight = 10f;
        private const int CaptureWidth = 1080;
        private const int CaptureHeight = 1920;

        private static readonly RoadMotionVariant[] Variants =
        {
            new RoadMotionVariant("runtime_asphalt_projected_lines_72", 72f, 3.8f, 44f, 18f, 0.58f, 0.035f, 0.0078f),
            new RoadMotionVariant("runtime_asphalt_quieter_far_72", 72f, 3.4f, 52f, 20f, 0.54f, 0.025f, 0.0075f),
            new RoadMotionVariant("runtime_asphalt_faster_90", 90f, 3.8f, 44f, 18f, 0.58f, 0.035f, 0.0078f)
        };

        [MenuItem("NewTrip/Road Prototype/Create RoadMotionReview Scene")]
        public static void CreateRoadMotionReviewScene()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before creating RoadMotionReview.");
                return;
            }

            RoadSurfaceSupportImportSettings.ApplyAll();

            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            SceneManager.SetActiveScene(scene);

            Camera camera = CreateCamera();
            GameObject root = new GameObject("RoadMotionReviewRoot");
            RoadMotionState motionState = CreateMotionState(root);

            Material roadMaterial = CreateTextureMaterial(
                "RoadMotion_User_Asphalt_Material",
                LoadTextureOrFallback(RoadSurfaceSupportImportSettings.AsphaltAssetPath, CreateRoadFallbackTexture())
            );
            Material laneMaterial = CreateTextureMaterial(
                "RoadMotion_User_WornLane_Material",
                LoadTextureOrFallback(RoadSurfaceSupportImportSettings.LaneAssetPath, CreateLaneFallbackTexture())
            );
            Material shoulderMaterial = CreateTextureMaterial("RoadMotion_Shoulder_Material", CreateShoulderFallbackTexture());
            LogTexture("RoadMotion road", roadMaterial);
            LogTexture("RoadMotion lane", laneMaterial);

            Pseudo3DRoadRenderer roadRenderer = CreateRoad(root, motionState, roadMaterial);
            RoadShoulderRenderer shoulderRenderer = CreateShoulder(root, motionState, roadRenderer, shoulderMaterial);
            LaneMarkingRenderer leftLaneRenderer = CreateProjectedYellowLine(root, motionState, roadRenderer, laneMaterial, "LaneYellowLeftMesh", -1);
            LaneMarkingRenderer rightLaneRenderer = CreateProjectedYellowLine(root, motionState, roadRenderer, laneMaterial, "LaneYellowRightMesh", 1);
            SideObjectSpawner spawner = CreatePlaceholderSpawner(root, motionState, roadRenderer);

            GameObject debugObject = CreateChild(root, "RoadDebugOverlay");
            RoadDebugOverlay debugOverlay = debugObject.AddComponent<RoadDebugOverlay>();
            debugOverlay.roadRenderer = roadRenderer;
            debugOverlay.showGuides = true;

            ApplyVariant(Variants[0], motionState, roadRenderer, shoulderRenderer, leftLaneRenderer, rightLaneRenderer, spawner, 0f);
            camera.transform.position = new Vector3(0f, 0f, -10f);
            Selection.activeGameObject = root;

            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            Debug.Log("Created RoadMotionReview scene with shared RoadMotionState and placeholder roadside markers: " + ScenePath);
        }

        [MenuItem("NewTrip/Road Prototype/Capture RoadMotion 10s Matrix")]
        public static void CaptureRoadMotionMatrix()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before capturing RoadMotion matrix.");
                return;
            }

            if (AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath) == null)
            {
                CreateRoadMotionReviewScene();
            }

            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);

            Camera camera = Camera.main;
            RoadMotionState motionState = Object.FindAnyObjectByType<RoadMotionState>(FindObjectsInactive.Exclude);
            Pseudo3DRoadRenderer roadRenderer = Object.FindAnyObjectByType<Pseudo3DRoadRenderer>(FindObjectsInactive.Exclude);
            RoadShoulderRenderer shoulderRenderer = Object.FindAnyObjectByType<RoadShoulderRenderer>(FindObjectsInactive.Exclude);
            LaneMarkingRenderer leftLaneRenderer = GameObject.Find("LaneYellowLeftMesh")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer rightLaneRenderer = GameObject.Find("LaneYellowRightMesh")?.GetComponent<LaneMarkingRenderer>();
            SideObjectSpawner spawner = Object.FindAnyObjectByType<SideObjectSpawner>(FindObjectsInactive.Exclude);

            if (camera == null || motionState == null || roadRenderer == null || shoulderRenderer == null || leftLaneRenderer == null || rightLaneRenderer == null || spawner == null)
            {
                Debug.LogError("RoadMotion matrix capture failed. Expected camera, motion state, road, shoulder, two yellow-line renderers, and placeholder spawner.");
                return;
            }

            string outputPath = GetScreenshotOutputPath();
            Directory.CreateDirectory(outputPath);

            StringBuilder matrix = new StringBuilder();
            matrix.AppendLine("# Road Motion 10s Capture Matrix");
            matrix.AppendLine();
            matrix.AppendLine("Generated by `NewTrip/Road Prototype/Capture RoadMotion 10s Matrix`.");
            matrix.AppendLine();
            matrix.AppendLine("| Variant | Speed km/h | Road repeat | Road meters/repeat | Lane meters/repeat | Horizon fade | Horizon alpha | Near lane half-width | Captures |");
            matrix.AppendLine("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |");

            for (int i = 0; i < Variants.Length; i++)
            {
                RoadMotionVariant variant = Variants[i];
                string prefix = i.ToString("00") + "_" + variant.Name;

                ApplyVariant(variant, motionState, roadRenderer, shoulderRenderer, leftLaneRenderer, rightLaneRenderer, spawner, 0f);
                Texture2D still = RenderCamera(camera);
                string stillName = prefix + "_still.png";
                WritePng(still, outputPath, stillName);

                float tenSecondDistance = motionState.VisualSpeedMetersPerSecond * 10f;
                ApplyVariant(variant, motionState, roadRenderer, shoulderRenderer, leftLaneRenderer, rightLaneRenderer, spawner, tenSecondDistance);
                Texture2D motion = RenderCamera(camera);
                string motionName = prefix + "_10s_motion.png";
                WritePng(motion, outputPath, motionName);

                RenderCropToPng(camera, outputPath, prefix + "_horizon_lane_closeup.png", new RectInt(420, 840, 240, 320));
                RenderCropToPng(camera, outputPath, prefix + "_near_road_closeup.png", new RectInt(90, 80, 900, 420));

                matrix.Append("| ");
                matrix.Append(variant.Name);
                matrix.Append(" | ");
                matrix.Append(variant.SpeedKmph.ToString("0"));
                matrix.Append(" | ");
                matrix.Append(variant.RoadRepeat.ToString("0.0"));
                matrix.Append(" | ");
                matrix.Append(variant.RoadMetersPerRepeat.ToString("0.0"));
                matrix.Append(" | ");
                matrix.Append(variant.LaneMetersPerRepeat.ToString("0.0"));
                matrix.Append(" | ");
                matrix.Append(variant.HorizonFadeStart.ToString("0.00"));
                matrix.Append(" | ");
                matrix.Append(variant.HorizonAlpha.ToString("0.00"));
                matrix.Append(" | ");
                matrix.Append(variant.NearLaneHalfWidthViewport.ToString("0.0000"));
                matrix.Append(" | ");
                matrix.Append(stillName);
                matrix.Append(", ");
                matrix.Append(motionName);
                matrix.AppendLine(" |");

                Object.DestroyImmediate(still);
                Object.DestroyImmediate(motion);
            }

            File.WriteAllText(Path.Combine(outputPath, "road_motion_capture_matrix.md"), matrix.ToString());
            AssetDatabase.Refresh();

            Debug.Log("Captured RoadMotion 10s matrix to: " + outputPath);
        }

        private static RoadMotionState CreateMotionState(GameObject root)
        {
            GameObject motionObject = CreateChild(root, "RoadMotionState");
            RoadMotionState motionState = motionObject.AddComponent<RoadMotionState>();
            motionState.serverSpeedKmph = 72f;
            return motionState;
        }

        private static Pseudo3DRoadRenderer CreateRoad(GameObject root, RoadMotionState motionState, Material material)
        {
            GameObject roadObject = CreateChild(root, "RoadMesh");
            Pseudo3DRoadRenderer roadRenderer = roadObject.AddComponent<Pseudo3DRoadRenderer>();
            roadRenderer.motionState = motionState;
            roadRenderer.renderWidth = RenderWidth;
            roadRenderer.renderHeight = RenderHeight;
            roadRenderer.projectionPreset = RoadProjectionPreset.BigSurPrototype;
            roadRenderer.applyProjectionPresetOnRebuild = true;
            roadRenderer.sliceCount = 72;
            roadRenderer.useDepthAwareMotion = true;
            roadRenderer.useWidthBasedTextureU = true;
            roadRenderer.asphaltTileWorldWidth = 1.45f;
            roadRenderer.textureRepeat = 3.8f;
            roadRenderer.textureMetersPerRepeat = 44f;
            roadRenderer.horizonFadeStartDepth = 0.58f;
            roadRenderer.horizonAlpha = 0.035f;
            roadRenderer.farTint = new Color(0.58f, 0.53f, 0.48f, 1f);
            roadRenderer.SetMaterial(material);
            SetRendererOrder(roadObject, 10);
            roadRenderer.RebuildMesh();
            return roadRenderer;
        }

        private static RoadShoulderRenderer CreateShoulder(GameObject root, RoadMotionState motionState, Pseudo3DRoadRenderer roadRenderer, Material material)
        {
            GameObject shoulderObject = CreateChild(root, "RoadShoulders");
            RoadShoulderRenderer shoulderRenderer = shoulderObject.AddComponent<RoadShoulderRenderer>();
            shoulderRenderer.motionState = motionState;
            shoulderRenderer.roadRenderer = roadRenderer;
            shoulderRenderer.sliceCount = 72;
            shoulderRenderer.SetMaterial(material);
            SetRendererOrder(shoulderObject, 8);
            shoulderRenderer.RebuildMesh();
            return shoulderRenderer;
        }

        private static LaneMarkingRenderer CreateProjectedYellowLine(GameObject root, RoadMotionState motionState, Pseudo3DRoadRenderer roadRenderer, Material material, string objectName, int side)
        {
            GameObject laneObject = CreateChild(root, objectName);
            LaneMarkingRenderer laneRenderer = laneObject.AddComponent<LaneMarkingRenderer>();
            laneRenderer.motionState = motionState;
            laneRenderer.roadRenderer = roadRenderer;
            laneRenderer.sliceCount = 72;
            laneRenderer.useRoadRelativeWidth = false;
            laneRenderer.useDepthViewportWidth = true;
            laneRenderer.nearLaneHalfWidthViewport = 0.0078f;
            laneRenderer.farLaneHalfWidthViewport = 0.0008f;
            laneRenderer.widthDepthCurve = 1f;
            laneRenderer.minLaneHalfWidth = 0.0025f;
            laneRenderer.useDepthViewportCenterOffset = true;
            laneRenderer.nearCenterOffsetViewport = side * 0.014f;
            laneRenderer.farCenterOffsetViewport = side * 0.0017f;
            laneRenderer.centerOffsetDepthCurve = 1f;
            laneRenderer.textureUMin = 0f;
            laneRenderer.textureUMax = 1f;
            laneRenderer.textureRepeat = 12.5f;
            laneRenderer.textureMetersPerRepeat = 18f;
            laneRenderer.useDepthAwareMotion = true;
            laneRenderer.horizonFadeStartDepth = 0.58f;
            laneRenderer.horizonAlpha = 0.015f;
            laneRenderer.farTint = new Color(1f, 0.76f, 0.48f, 1f);
            laneRenderer.SetMaterial(material);
            SetRendererOrder(laneObject, 20);
            laneRenderer.RebuildMesh();
            return laneRenderer;
        }

        private static SideObjectSpawner CreatePlaceholderSpawner(GameObject root, RoadMotionState motionState, Pseudo3DRoadRenderer roadRenderer)
        {
            GameObject sideRoot = CreateChild(root, "SideObjectRoot");
            GameObject spawnerObject = CreateChild(root, "SideObjectSpawner");
            SideObjectSpawner spawner = spawnerObject.AddComponent<SideObjectSpawner>();
            spawner.motionState = motionState;
            spawner.roadRenderer = roadRenderer;
            spawner.objectRoot = sideRoot.transform;
            spawner.spawnInPlayModeOnly = false;
            spawner.useDistanceBasedMotion = true;
            spawner.seedInitialDistanceWindow = true;
            spawner.profile = CreatePlaceholderProfile();
            spawner.RebuildDistancePreview(0f);
            return spawner;
        }

        private static RoadsideSpawnProfile CreatePlaceholderProfile()
        {
            RoadsideSpawnProfile profile = ScriptableObject.CreateInstance<RoadsideSpawnProfile>();
            profile.spawnSpacingMeters = new Vector2(7f, 18f);
            profile.depthTravelMeters = 62f;
            profile.entries.Add(new RoadsideSpawnEntry
            {
                spriteId = "placeholder_left_marker",
                sprite = CreateSprite("placeholder_left_marker", CreateMarkerTexture(new Color(0.95f, 0.55f, 0.24f, 1f)), 64f),
                side = RoadsideSide.Left,
                laneOffset = 0.22f,
                nearScale = 1.15f,
                farScale = 0.08f,
                parallaxSpeed = 0.95f,
                rarityWeight = 1.2f
            });
            profile.entries.Add(new RoadsideSpawnEntry
            {
                spriteId = "placeholder_right_post",
                sprite = CreateSprite("placeholder_right_post", CreatePostTexture(new Color(0.72f, 0.78f, 0.82f, 1f)), 64f),
                side = RoadsideSide.Right,
                laneOffset = 0.12f,
                nearScale = 1.05f,
                farScale = 0.08f,
                parallaxSpeed = 1.1f,
                rarityWeight = 1.8f
            });
            profile.entries.Add(new RoadsideSpawnEntry
            {
                spriteId = "placeholder_far_tree",
                sprite = CreateSprite("placeholder_far_tree", CreateMarkerTexture(new Color(0.2f, 0.43f, 0.26f, 1f)), 64f),
                side = RoadsideSide.Left,
                laneOffset = 0.42f,
                nearScale = 1.25f,
                farScale = 0.09f,
                parallaxSpeed = 0.72f,
                rarityWeight = 0.9f
            });
            return profile;
        }

        private static void ApplyVariant(
            RoadMotionVariant variant,
            RoadMotionState motionState,
            Pseudo3DRoadRenderer roadRenderer,
            RoadShoulderRenderer shoulderRenderer,
            LaneMarkingRenderer leftLaneRenderer,
            LaneMarkingRenderer rightLaneRenderer,
            SideObjectSpawner spawner,
            float visualDistanceMeters
        )
        {
            motionState.SetServerSpeedKmph(variant.SpeedKmph);
            motionState.SetVisualDistanceForReview(visualDistanceMeters);

            roadRenderer.textureRepeat = variant.RoadRepeat;
            roadRenderer.textureMetersPerRepeat = variant.RoadMetersPerRepeat;
            roadRenderer.useWidthBasedTextureU = true;
            roadRenderer.asphaltTileWorldWidth = 1.45f;
            roadRenderer.horizonFadeStartDepth = variant.HorizonFadeStart;
            roadRenderer.horizonAlpha = variant.HorizonAlpha;
            roadRenderer.nearTint = Color.white;
            roadRenderer.farTint = new Color(0.58f, 0.53f, 0.48f, 1f);
            roadRenderer.RebuildMesh();

            shoulderRenderer.textureRepeat = Mathf.Max(3f, variant.RoadRepeat * 0.65f);
            shoulderRenderer.textureMetersPerRepeat = Mathf.Max(10f, variant.RoadMetersPerRepeat * 0.9f);
            shoulderRenderer.horizonFadeStartDepth = Mathf.Max(0.48f, variant.HorizonFadeStart - 0.04f);
            shoulderRenderer.horizonAlpha = Mathf.Clamp01(variant.HorizonAlpha + 0.08f);
            shoulderRenderer.RebuildMesh();

            ApplyYellowLineVariant(leftLaneRenderer, variant, side: -1);
            ApplyYellowLineVariant(rightLaneRenderer, variant, side: 1);

            spawner.RebuildDistancePreview(visualDistanceMeters);
        }

        private static void ApplyYellowLineVariant(LaneMarkingRenderer laneRenderer, RoadMotionVariant variant, int side)
        {
            laneRenderer.textureRepeat = 12.5f;
            laneRenderer.textureMetersPerRepeat = variant.LaneMetersPerRepeat;
            laneRenderer.useRoadRelativeWidth = false;
            laneRenderer.useDepthViewportWidth = true;
            laneRenderer.nearLaneHalfWidthViewport = variant.NearLaneHalfWidthViewport;
            laneRenderer.farLaneHalfWidthViewport = 0.0008f;
            laneRenderer.widthDepthCurve = 1f;
            laneRenderer.minLaneHalfWidth = 0.0025f;
            laneRenderer.useDepthViewportCenterOffset = true;
            laneRenderer.nearCenterOffsetViewport = side * 0.014f;
            laneRenderer.farCenterOffsetViewport = side * 0.0017f;
            laneRenderer.centerOffsetDepthCurve = 1f;
            laneRenderer.textureUMin = 0f;
            laneRenderer.textureUMax = 1f;
            laneRenderer.useDepthAwareMotion = true;
            laneRenderer.horizonFadeStartDepth = variant.HorizonFadeStart;
            laneRenderer.horizonAlpha = Mathf.Min(variant.HorizonAlpha, 0.025f);
            laneRenderer.nearTint = Color.white;
            laneRenderer.farTint = new Color(1f, 0.76f, 0.48f, 1f);
            laneRenderer.RebuildMesh();
        }

        private static Camera CreateCamera()
        {
            GameObject cameraObject = new GameObject("Main Camera");
            cameraObject.tag = "MainCamera";

            Camera camera = cameraObject.AddComponent<Camera>();
            camera.orthographic = true;
            camera.orthographicSize = RenderHeight * 0.5f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.045f, 0.044f, 0.048f, 1f);
            camera.transform.position = new Vector3(0f, 0f, -10f);

            RoadPortraitCameraController cameraController = cameraObject.AddComponent<RoadPortraitCameraController>();
            cameraController.targetWidth = RenderWidth;
            cameraController.targetHeight = RenderHeight;
            cameraController.letterboxWhenAspectDiffers = false;
            cameraController.clearColor = camera.backgroundColor;
            cameraController.Apply();

            return camera;
        }

        private static GameObject CreateChild(GameObject parent, string name)
        {
            GameObject child = new GameObject(name);
            child.transform.SetParent(parent.transform, worldPositionStays: false);
            child.transform.localPosition = Vector3.zero;
            child.transform.localRotation = Quaternion.identity;
            child.transform.localScale = Vector3.one;
            return child;
        }

        private static Texture2D LoadTextureOrFallback(string assetPath, Texture2D fallback)
        {
            Texture2D texture = AssetDatabase.LoadAssetAtPath<Texture2D>(assetPath);

            if (texture == null)
            {
                Debug.LogWarning("RoadMotion texture missing, using fallback: " + assetPath);
                return fallback;
            }

            return texture;
        }

        private static Material CreateTextureMaterial(string materialName, Texture2D texture)
        {
            Shader shader = Shader.Find("Sprites/Default");

            if (shader == null)
            {
                shader = Shader.Find("Unlit/Transparent");
            }

            Material material = new Material(shader)
            {
                name = materialName,
                mainTexture = texture
            };
            material.SetColor("_Color", Color.white);
            material.SetInt("_Cull", (int)UnityEngine.Rendering.CullMode.Off);
            return material;
        }

        private static void LogTexture(string label, Material material)
        {
            Texture texture = material != null ? material.mainTexture : null;

            if (texture == null)
            {
                Debug.LogWarning(label + " texture loaded: <missing>");
                return;
            }

            Debug.Log(
                label + " texture loaded: " +
                texture.name + ", " +
                texture.width + "x" + texture.height + ", " +
                "wrap=" + texture.wrapMode + ", " +
                "filter=" + texture.filterMode
            );
        }

        private static Sprite CreateSprite(string name, Texture2D texture, float pixelsPerUnit)
        {
            Sprite sprite = Sprite.Create(
                texture,
                new Rect(0f, 0f, texture.width, texture.height),
                new Vector2(0.5f, 0f),
                pixelsPerUnit
            );
            sprite.name = name;
            return sprite;
        }

        private static Texture2D CreateRoadFallbackTexture()
        {
            Texture2D texture = NewTexture("RoadMotionQuietAsphalt", 128, 128, TextureWrapMode.Repeat);

            for (int y = 0; y < texture.height; y++)
            {
                for (int x = 0; x < texture.width; x++)
                {
                    float centerWear = Mathf.Abs(x - texture.width * 0.5f) < texture.width * 0.22f ? 0.026f : 0f;
                    float softVertical = Mathf.Sin(y * 0.11f) * 0.012f;
                    float broadGrain = ((x * 3 + y * 5) % 17) / 17f * 0.012f;
                    float asphaltVein = Mathf.Sin((x * 0.17f) + (y * 0.045f)) * 0.01f;
                    float value = centerWear + softVertical + broadGrain + asphaltVein;
                    Color baseColor = new Color(0.215f, 0.205f, 0.2f, 1f);
                    Color color = baseColor + new Color(value, value * 0.75f, value * 0.45f, 0f);
                    texture.SetPixel(x, y, color);
                }
            }

            texture.Apply();
            return texture;
        }

        private static Texture2D CreateLaneFallbackTexture()
        {
            Texture2D texture = NewTexture("RoadMotionCenteredDoubleYellow", 64, 96, TextureWrapMode.Repeat);
            Color clear = new Color(1f, 1f, 1f, 0f);

            for (int y = 0; y < texture.height; y++)
            {
                for (int x = 0; x < texture.width; x++)
                {
                    bool leftStripe = x >= 22 && x <= 26;
                    bool rightStripe = x >= 38 && x <= 42;
                    bool sparseWear = ((x * 13 + y * 7) % 83) == 0;
                    bool stripe = (leftStripe || rightStripe) && !sparseWear;
                    texture.SetPixel(x, y, stripe ? new Color(1f, 0.72f, 0.08f, 0.96f) : clear);
                }
            }

            texture.Apply();
            return texture;
        }

        private static Texture2D CreateShoulderFallbackTexture()
        {
            Texture2D texture = NewTexture("RoadMotionFallbackShoulder", 32, 64, TextureWrapMode.Repeat);

            for (int y = 0; y < texture.height; y++)
            {
                for (int x = 0; x < texture.width; x++)
                {
                    float grain = ((x * 7 + y * 11) % 9) / 80f;
                    texture.SetPixel(x, y, new Color(0.4f + grain, 0.25f + grain, 0.15f, 0.92f));
                }
            }

            texture.Apply();
            return texture;
        }

        private static Texture2D CreateMarkerTexture(Color color)
        {
            Texture2D texture = NewTexture("RoadMotionPlaceholderMarker", 20, 32, TextureWrapMode.Clamp);
            Fill(texture, new Color(0f, 0f, 0f, 0f));
            DrawRect(texture, 8, 0, 4, 14, new Color(0.18f, 0.12f, 0.08f, 1f));
            DrawRect(texture, 4, 12, 12, 12, color);
            DrawRect(texture, 6, 24, 8, 5, color * 0.75f);
            texture.Apply();
            return texture;
        }

        private static Texture2D CreatePostTexture(Color color)
        {
            Texture2D texture = NewTexture("RoadMotionPlaceholderPost", 18, 28, TextureWrapMode.Clamp);
            Fill(texture, new Color(0f, 0f, 0f, 0f));
            DrawRect(texture, 8, 0, 3, 22, new Color(0.22f, 0.18f, 0.14f, 1f));
            DrawRect(texture, 3, 16, 12, 5, color);
            texture.Apply();
            return texture;
        }

        private static Texture2D NewTexture(string textureName, int width, int height, TextureWrapMode wrapMode)
        {
            Texture2D texture = new Texture2D(width, height, TextureFormat.RGBA32, false)
            {
                name = textureName,
                filterMode = FilterMode.Point,
                wrapMode = wrapMode
            };
            return texture;
        }

        private static void Fill(Texture2D texture, Color color)
        {
            for (int y = 0; y < texture.height; y++)
            {
                for (int x = 0; x < texture.width; x++)
                {
                    texture.SetPixel(x, y, color);
                }
            }
        }

        private static void DrawRect(Texture2D texture, int x, int y, int width, int height, Color color)
        {
            for (int iy = y; iy < y + height; iy++)
            {
                for (int ix = x; ix < x + width; ix++)
                {
                    if (ix >= 0 && ix < texture.width && iy >= 0 && iy < texture.height)
                    {
                        texture.SetPixel(ix, iy, color);
                    }
                }
            }
        }

        private static void SetRendererOrder(GameObject target, int sortingOrder)
        {
            Renderer renderer = target.GetComponent<Renderer>();

            if (renderer != null)
            {
                renderer.sortingOrder = sortingOrder;
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
            RectInt clampedCrop = ClampCrop(source.width, source.height, crop);
            Texture2D cropped = new Texture2D(clampedCrop.width, clampedCrop.height, TextureFormat.RGBA32, mipChain: false)
            {
                filterMode = FilterMode.Point
            };
            Color[] pixels = source.GetPixels(clampedCrop.x, clampedCrop.y, clampedCrop.width, clampedCrop.height);
            cropped.SetPixels(pixels);
            cropped.Apply(updateMipmaps: false, makeNoLongerReadable: false);
            WritePng(cropped, outputPath, fileName);
            Object.DestroyImmediate(cropped);
            Object.DestroyImmediate(source);
        }

        private static RectInt ClampCrop(int sourceWidth, int sourceHeight, RectInt crop)
        {
            int x = Mathf.Clamp(crop.x, 0, sourceWidth - 1);
            int y = Mathf.Clamp(crop.y, 0, sourceHeight - 1);
            int width = Mathf.Clamp(crop.width, 1, sourceWidth - x);
            int height = Mathf.Clamp(crop.height, 1, sourceHeight - y);
            return new RectInt(x, y, width, height);
        }

        private static string GetScreenshotOutputPath()
        {
            DirectoryInfo projectRoot = Directory.GetParent(Application.dataPath);
            return Path.Combine(projectRoot.FullName, ScreenshotOutputFolder);
        }

        private static void WritePng(Texture2D texture, string outputPath, string fileName)
        {
            File.WriteAllBytes(Path.Combine(outputPath, fileName), texture.EncodeToPNG());
        }

        private readonly struct RoadMotionVariant
        {
            public RoadMotionVariant(string name, float speedKmph, float roadRepeat, float roadMetersPerRepeat, float laneMetersPerRepeat, float horizonFadeStart, float horizonAlpha, float nearLaneHalfWidthViewport)
            {
                Name = name;
                SpeedKmph = speedKmph;
                RoadRepeat = roadRepeat;
                RoadMetersPerRepeat = roadMetersPerRepeat;
                LaneMetersPerRepeat = laneMetersPerRepeat;
                HorizonFadeStart = horizonFadeStart;
                HorizonAlpha = horizonAlpha;
                NearLaneHalfWidthViewport = nearLaneHalfWidthViewport;
            }

            public string Name { get; }
            public float SpeedKmph { get; }
            public float RoadRepeat { get; }
            public float RoadMetersPerRepeat { get; }
            public float LaneMetersPerRepeat { get; }
            public float HorizonFadeStart { get; }
            public float HorizonAlpha { get; }
            public float NearLaneHalfWidthViewport { get; }
        }
    }
}
#endif
