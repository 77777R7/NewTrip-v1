#if UNITY_EDITOR
using System.IO;
using NewTrip.Client.Road;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace NewTrip.Client.Editor
{
    public static class RoadOnlyTestSceneBuilder
    {
        private static readonly int MainTexSt = Shader.PropertyToID("_MainTex_ST");

        private const string ScenePath = "Assets/NewTrip/Scenes/RoadOnlyTest.unity";
        private const string ScreenshotOutputFolder = "Artifacts/RoadOnlyTest";
        private const float RenderWidth = 5.625f;
        private const float RenderHeight = 10f;
        private const int CaptureWidth = 1080;
        private const int CaptureHeight = 1920;

        [MenuItem("NewTrip/Road Prototype/Create RoadOnlyTest Scene")]
        public static void CreateRoadOnlyTestScene()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before creating RoadOnlyTest.");
                return;
            }

            RoadSurfaceSupportImportSettings.ApplyAll();

            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            SceneManager.SetActiveScene(scene);

            Camera camera = CreateCamera();
            GameObject root = new GameObject("RoadOnlyTestRoot");
            GameObject motionObject = CreateChild(root, "RoadMotionState");
            RoadMotionState motionState = motionObject.AddComponent<RoadMotionState>();
            motionState.serverSpeedKmph = 72f;

            Material roadMaterial = CreateTextureMaterial(
                "RoadOnly_AsphaltTile_Material",
                LoadTexture(RoadSurfaceSupportImportSettings.AsphaltAssetPath)
            );
            Material laneMaterial = CreateTextureMaterial(
                "RoadOnly_SingleYellowLine_Material",
                LoadTexture(RoadSurfaceSupportImportSettings.LaneAssetPath)
            );
            Material crackDetailMaterial = CreateTextureMaterial(
                "RoadOnly_CrackDetail_Source_Material",
                LoadTexture(RoadSurfaceSupportImportSettings.CrackDecalAssetPath)
            );
            crackDetailMaterial.SetColor("_Color", new Color(1f, 1f, 1f, 0f));
            LogTexture("RoadOnly road", roadMaterial);
            LogTexture("RoadOnly lane", laneMaterial);
            LogTexture("RoadOnly crack detail", crackDetailMaterial);

            GameObject roadObject = CreateChild(root, "RoadMesh");
            Pseudo3DRoadRenderer roadRenderer = roadObject.AddComponent<Pseudo3DRoadRenderer>();
            roadRenderer.motionState = motionState;
            roadRenderer.renderWidth = RenderWidth;
            roadRenderer.renderHeight = RenderHeight;
            roadRenderer.projectionPreset = RoadProjectionPreset.BigSurPrototype;
            roadRenderer.applyProjectionPresetOnRebuild = true;
            roadRenderer.sliceCount = 72;
            roadRenderer.textureUMin = 0f;
            roadRenderer.textureUMax = 1f;
            roadRenderer.useWidthBasedTextureU = true;
            roadRenderer.asphaltTileWorldWidth = 1.45f;
            roadRenderer.textureRepeat = 3.8f;
            roadRenderer.textureMetersPerRepeat = 44f;
            roadRenderer.useDepthAwareMotion = true;
            roadRenderer.useHorizonFade = true;
            roadRenderer.horizonFadeStartDepth = 0.58f;
            roadRenderer.horizonAlpha = 0.035f;
            roadRenderer.nearTint = Color.white;
            roadRenderer.farTint = new Color(0.58f, 0.53f, 0.48f, 1f);
            roadRenderer.SetMaterial(roadMaterial);
            SetRendererOrder(roadObject, 10);
            roadRenderer.RebuildMesh();

            GameObject crackObject = CreateChild(root, "RoadCrackDetailMesh");
            Pseudo3DRoadRenderer crackRenderer = crackObject.AddComponent<Pseudo3DRoadRenderer>();
            crackRenderer.motionState = motionState;
            crackRenderer.renderWidth = RenderWidth;
            crackRenderer.renderHeight = RenderHeight;
            crackRenderer.projectionPreset = RoadProjectionPreset.BigSurPrototype;
            crackRenderer.applyProjectionPresetOnRebuild = true;
            crackRenderer.sliceCount = 72;
            crackRenderer.textureUMin = 0f;
            crackRenderer.textureUMax = 1f;
            crackRenderer.useWidthBasedTextureU = true;
            crackRenderer.asphaltTileWorldWidth = 5.6f;
            crackRenderer.textureRepeat = 0.85f;
            crackRenderer.textureMetersPerRepeat = 180f;
            crackRenderer.useDepthAwareMotion = true;
            crackRenderer.useHorizonFade = true;
            crackRenderer.horizonFadeStartDepth = 0.38f;
            crackRenderer.horizonAlpha = 0f;
            crackRenderer.nearTint = Color.white;
            crackRenderer.farTint = new Color(1f, 1f, 1f, 0.55f);
            crackRenderer.SetMaterial(crackDetailMaterial);
            SetRendererOrder(crackObject, 11);
            crackRenderer.RebuildMesh();

            CreateProjectedYellowLine(
                root,
                "LaneYellowLeftMesh",
                roadRenderer,
                motionState,
                laneMaterial,
                side: -1
            );
            CreateProjectedYellowLine(
                root,
                "LaneYellowRightMesh",
                roadRenderer,
                motionState,
                laneMaterial,
                side: 1
            );

            camera.transform.position = new Vector3(0f, 0f, -10f);
            Selection.activeGameObject = root;

            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            Debug.Log("Created RoadOnlyTest scene with road mesh and lane mesh only: " + ScenePath);
        }

        [MenuItem("NewTrip/Road Prototype/Capture RoadOnlyTest Screenshots")]
        public static void CaptureRoadOnlyTestScreenshots()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Exit Play mode before capturing RoadOnlyTest screenshots.");
                return;
            }

            if (AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath) == null)
            {
                CreateRoadOnlyTestScene();
            }

            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);

            Camera camera = Camera.main;
            RoadMotionState motionState = Object.FindAnyObjectByType<RoadMotionState>(FindObjectsInactive.Exclude);
            Pseudo3DRoadRenderer roadRenderer = GameObject.Find("RoadMesh")?.GetComponent<Pseudo3DRoadRenderer>();
            Pseudo3DRoadRenderer crackRenderer = GameObject.Find("RoadCrackDetailMesh")?.GetComponent<Pseudo3DRoadRenderer>();
            LaneMarkingRenderer leftLaneRenderer = GameObject.Find("LaneYellowLeftMesh")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer rightLaneRenderer = GameObject.Find("LaneYellowRightMesh")?.GetComponent<LaneMarkingRenderer>();

            if (camera == null || motionState == null || roadRenderer == null || leftLaneRenderer == null || rightLaneRenderer == null)
            {
                Debug.LogError("RoadOnlyTest capture failed. Expected one camera, one motion state, one road renderer, and two yellow-line renderers.");
                return;
            }

            roadRenderer.SetMaterial(CreateTextureMaterial(
                "RoadOnly_AsphaltTile_CaptureMaterial",
                LoadTexture(RoadSurfaceSupportImportSettings.AsphaltAssetPath)
            ));
            LogTexture("RoadOnly capture road", roadRenderer.GetComponent<Renderer>()?.sharedMaterial);
            if (crackRenderer != null)
            {
                Material crackMaterial = CreateTextureMaterial(
                    "RoadOnly_CrackDetail_CaptureMaterial",
                    LoadTexture(RoadSurfaceSupportImportSettings.CrackDecalAssetPath)
                );
                crackMaterial.SetColor("_Color", new Color(1f, 1f, 1f, 0f));
                crackRenderer.SetMaterial(crackMaterial);
                LogTexture("RoadOnly capture crack detail", crackMaterial);
            }
            Material yellowLineMaterial = CreateTextureMaterial(
                "RoadOnly_SingleYellowLine_CaptureMaterial",
                LoadTexture(RoadSurfaceSupportImportSettings.LaneAssetPath)
            );
            leftLaneRenderer.SetMaterial(yellowLineMaterial);
            rightLaneRenderer.SetMaterial(yellowLineMaterial);
            LogTexture("RoadOnly capture yellow line", yellowLineMaterial);
            roadRenderer.RebuildMesh();
            crackRenderer?.RebuildMesh();
            leftLaneRenderer.RebuildMesh();
            rightLaneRenderer.RebuildMesh();

            string screenshotOutputPath = GetScreenshotOutputPath();
            Directory.CreateDirectory(screenshotOutputPath);

            roadRenderer.textureOffset = 0f;
            leftLaneRenderer.textureOffset = 0f;
            rightLaneRenderer.textureOffset = 0f;
            motionState.SetVisualDistanceForReview(0f);
            roadRenderer.RebuildMesh();
            crackRenderer?.RebuildMesh();
            leftLaneRenderer.RebuildMesh();
            rightLaneRenderer.RebuildMesh();
            Texture2D stillFrame = RenderCamera(camera);
            WritePng(stillFrame, screenshotOutputPath, "road_only_still.png");

            motionState.SetVisualDistanceForReview(motionState.VisualSpeedMetersPerSecond * 10f);
            roadRenderer.RefreshMotionForReview();
            crackRenderer?.RefreshMotionForReview();
            leftLaneRenderer.RefreshMotionForReview();
            rightLaneRenderer.RefreshMotionForReview();
            Texture2D motionFrame = RenderCamera(camera);
            WritePng(motionFrame, screenshotOutputPath, "road_only_10s_motion.png");

            roadRenderer.textureOffset = 0f;
            leftLaneRenderer.textureOffset = 0f;
            rightLaneRenderer.textureOffset = 0f;
            motionState.SetVisualDistanceForReview(0f);
            roadRenderer.RebuildMesh();
            crackRenderer?.RebuildMesh();
            leftLaneRenderer.RebuildMesh();
            rightLaneRenderer.RebuildMesh();
            RenderCropToPng(camera, screenshotOutputPath, "road_only_lane_horizon_closeup.png", new RectInt(420, 860, 240, 300));
            RenderCropToPng(camera, screenshotOutputPath, "road_only_road_bottom_closeup.png", new RectInt(90, 80, 900, 420));

            Object.DestroyImmediate(stillFrame);
            Object.DestroyImmediate(motionFrame);
            AssetDatabase.Refresh();

            Debug.Log("Captured RoadOnlyTest screenshots to: " + screenshotOutputPath);
        }

        public static void CreateAndCaptureRoadOnlyTest()
        {
            CreateRoadOnlyTestScene();
            CaptureRoadOnlyTestScreenshots();
        }

        private static LaneMarkingRenderer CreateProjectedYellowLine(
            GameObject root,
            string objectName,
            Pseudo3DRoadRenderer roadRenderer,
            RoadMotionState motionState,
            Material material,
            int side
        )
        {
            GameObject laneObject = CreateChild(root, objectName);
            LaneMarkingRenderer laneRenderer = laneObject.AddComponent<LaneMarkingRenderer>();
            laneRenderer.roadRenderer = roadRenderer;
            laneRenderer.motionState = motionState;
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
            laneRenderer.useHorizonFade = true;
            laneRenderer.horizonFadeStartDepth = 0.58f;
            laneRenderer.horizonAlpha = 0.015f;
            laneRenderer.nearTint = Color.white;
            laneRenderer.farTint = new Color(1f, 0.76f, 0.48f, 1f);
            laneRenderer.SetMaterial(material);
            SetRendererOrder(laneObject, 20);
            laneRenderer.RebuildMesh();
            return laneRenderer;
        }

        private static Camera CreateCamera()
        {
            GameObject cameraObject = new GameObject("Main Camera");
            cameraObject.tag = "MainCamera";

            Camera camera = cameraObject.AddComponent<Camera>();
            camera.orthographic = true;
            camera.orthographicSize = RenderHeight * 0.5f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.04f, 0.04f, 0.045f, 1f);
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

        private static Texture2D LoadTexture(string assetPath)
        {
            Texture2D texture = AssetDatabase.LoadAssetAtPath<Texture2D>(assetPath);

            if (texture == null)
            {
                Debug.LogError("RoadOnlyTest texture missing: " + assetPath);
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

        private static void SetRendererOrder(GameObject target, int sortingOrder)
        {
            Renderer renderer = target.GetComponent<Renderer>();

            if (renderer != null)
            {
                renderer.sortingOrder = sortingOrder;
            }
        }

        private static void ApplyTextureOffset(GameObject target, float yOffset)
        {
            Renderer renderer = target.GetComponent<Renderer>();

            if (renderer == null)
            {
                return;
            }

            MaterialPropertyBlock block = new MaterialPropertyBlock();
            renderer.GetPropertyBlock(block);
            block.SetVector(MainTexSt, new Vector4(1f, 1f, 0f, -Mathf.Repeat(yOffset, 1f)));
            renderer.SetPropertyBlock(block);

            if (renderer.sharedMaterial != null)
            {
                renderer.sharedMaterial.mainTextureScale = Vector2.one;
                renderer.sharedMaterial.mainTextureOffset = new Vector2(0f, -Mathf.Repeat(yOffset, 1f));
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

        private static string GetScreenshotOutputPath()
        {
            DirectoryInfo projectRoot = Directory.GetParent(Application.dataPath);
            return Path.Combine(projectRoot.FullName, ScreenshotOutputFolder);
        }

        private static void WritePng(Texture2D texture, string outputPath, string fileName)
        {
            File.WriteAllBytes(Path.Combine(outputPath, fileName), texture.EncodeToPNG());
        }

        private static void WriteCrop(Texture2D source, string outputPath, string fileName, RectInt crop)
        {
            RectInt clampedCrop = ClampCrop(source, crop);
            Texture2D cropped = new Texture2D(clampedCrop.width, clampedCrop.height, TextureFormat.RGBA32, mipChain: false)
            {
                filterMode = FilterMode.Point
            };
            Color[] pixels = source.GetPixels(clampedCrop.x, clampedCrop.y, clampedCrop.width, clampedCrop.height);
            cropped.SetPixels(pixels);
            cropped.Apply(updateMipmaps: false, makeNoLongerReadable: false);
            WritePng(cropped, outputPath, fileName);
            Object.DestroyImmediate(cropped);
        }

        private static void RenderCropToPng(Camera camera, string outputPath, string fileName, RectInt crop)
        {
            RectInt clampedCrop = ClampCrop(CaptureWidth, CaptureHeight, crop);
            RenderTexture renderTexture = new RenderTexture(CaptureWidth, CaptureHeight, 24, RenderTextureFormat.ARGB32)
            {
                filterMode = FilterMode.Point
            };
            Texture2D cropped = new Texture2D(clampedCrop.width, clampedCrop.height, TextureFormat.RGBA32, mipChain: false)
            {
                filterMode = FilterMode.Point
            };

            RenderTexture previousActive = RenderTexture.active;
            RenderTexture previousTarget = camera.targetTexture;

            camera.targetTexture = renderTexture;
            RenderTexture.active = renderTexture;
            camera.Render();
            cropped.ReadPixels(new Rect(clampedCrop.x, clampedCrop.y, clampedCrop.width, clampedCrop.height), 0, 0);
            cropped.Apply(updateMipmaps: false, makeNoLongerReadable: false);

            camera.targetTexture = previousTarget;
            RenderTexture.active = previousActive;
            renderTexture.Release();
            Object.DestroyImmediate(renderTexture);

            WritePng(cropped, outputPath, fileName);
            Object.DestroyImmediate(cropped);
        }

        private static RectInt ClampCrop(Texture2D source, RectInt crop)
        {
            return ClampCrop(source.width, source.height, crop);
        }

        private static RectInt ClampCrop(int sourceWidth, int sourceHeight, RectInt crop)
        {
            int x = Mathf.Clamp(crop.x, 0, sourceWidth - 1);
            int y = Mathf.Clamp(crop.y, 0, sourceHeight - 1);
            int width = Mathf.Clamp(crop.width, 1, sourceWidth - x);
            int height = Mathf.Clamp(crop.height, 1, sourceHeight - y);
            return new RectInt(x, y, width, height);
        }
    }
}
#endif
