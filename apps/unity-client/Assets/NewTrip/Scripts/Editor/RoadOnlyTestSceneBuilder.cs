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
        private const bool UseAcceptedWideRoadRelativeYellow = true;

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
            Material edgeStripMaterial = CreateTextureMaterial(
                "RoadOnly_EdgeWhiteLineStrip_Material",
                LoadTexture(RoadSurfaceSupportImportSettings.RoadEdgeWhiteLineStripAssetPath)
            );
            Material leftShoulderMaterial = CreateTextureMaterial(
                "RoadOnly_LeftDirtShoulder_Material",
                LoadTexture(RoadSurfaceSupportImportSettings.DirtShoulderAssetPath)
            );
            Material rightShoulderMaterial = CreateTextureMaterial(
                "RoadOnly_RightFlowerBorderShoulder_Material",
                LoadTexture(RoadSurfaceSupportImportSettings.RoadsideFlowerBorderAssetPath)
            );
            Material crackDetailMaterial = CreateTextureMaterial(
                "RoadOnly_CrackDetail_Source_Material",
                LoadTexture(RoadSurfaceSupportImportSettings.CrackDecalAssetPath)
            );
            crackDetailMaterial.SetColor("_Color", new Color(1f, 1f, 1f, 0f));
            LogTexture("RoadOnly road", roadMaterial);
            LogTexture("RoadOnly lane", laneMaterial);
            LogTexture("RoadOnly edge strip", edgeStripMaterial);
            LogTexture("RoadOnly left shoulder", leftShoulderMaterial);
            LogTexture("RoadOnly right shoulder", rightShoulderMaterial);
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

            CreateRoadEdgeStrip(
                root,
                "RoadEdgeLeftStrip",
                roadRenderer,
                motionState,
                edgeStripMaterial,
                RoadShoulderSide.Left
            );
            CreateRoadEdgeStrip(
                root,
                "RoadEdgeRightStrip",
                roadRenderer,
                motionState,
                edgeStripMaterial,
                RoadShoulderSide.Right
            );
            CreateRoadShoulder(
                root,
                "RoadShoulderLeftDirt",
                roadRenderer,
                motionState,
                leftShoulderMaterial,
                RoadShoulderSide.Left,
                innerRoadMultiplier: 0.92f,
                outerRoadMultiplier: 1.14f,
                nearTint: new Color(0.72f, 0.39f, 0.20f, 0.86f),
                farTint: new Color(0.42f, 0.27f, 0.18f, 0.18f)
            );
            CreateRoadShoulder(
                root,
                "RoadShoulderRightFlowers",
                roadRenderer,
                motionState,
                rightShoulderMaterial,
                RoadShoulderSide.Right,
                innerRoadMultiplier: 0.92f,
                outerRoadMultiplier: 1.18f,
                nearTint: new Color(1f, 0.92f, 0.76f, 1f),
                farTint: new Color(0.56f, 0.50f, 0.34f, 0.28f)
            );

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
                side: -1,
                useRoadRelativeProjection: UseAcceptedWideRoadRelativeYellow
            );
            CreateProjectedYellowLine(
                root,
                "LaneYellowRightMesh",
                roadRenderer,
                motionState,
                laneMaterial,
                side: 1,
                useRoadRelativeProjection: UseAcceptedWideRoadRelativeYellow
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

            if (!HasRequiredRoadOnlyCaptureObjects())
            {
                Debug.LogWarning("RoadOnlyTest scene is missing V2 road-edge/yellow-line objects. Refreshing scene before capture.");
                CreateRoadOnlyTestScene();
                EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            }

            Camera camera = Camera.main;
            RoadMotionState motionState = Object.FindAnyObjectByType<RoadMotionState>(FindObjectsInactive.Exclude);
            Pseudo3DRoadRenderer roadRenderer = GameObject.Find("RoadMesh")?.GetComponent<Pseudo3DRoadRenderer>();
            Pseudo3DRoadRenderer crackRenderer = GameObject.Find("RoadCrackDetailMesh")?.GetComponent<Pseudo3DRoadRenderer>();
            RoadShoulderRenderer leftEdgeStripRenderer = GameObject.Find("RoadEdgeLeftStrip")?.GetComponent<RoadShoulderRenderer>();
            RoadShoulderRenderer rightEdgeStripRenderer = GameObject.Find("RoadEdgeRightStrip")?.GetComponent<RoadShoulderRenderer>();
            RoadShoulderRenderer leftShoulderRenderer = GameObject.Find("RoadShoulderLeftDirt")?.GetComponent<RoadShoulderRenderer>();
            RoadShoulderRenderer rightShoulderRenderer = GameObject.Find("RoadShoulderRightFlowers")?.GetComponent<RoadShoulderRenderer>();
            LaneMarkingRenderer leftLaneRenderer = GameObject.Find("LaneYellowLeftMesh")?.GetComponent<LaneMarkingRenderer>();
            LaneMarkingRenderer rightLaneRenderer = GameObject.Find("LaneYellowRightMesh")?.GetComponent<LaneMarkingRenderer>();

            if (camera == null || motionState == null || roadRenderer == null || leftEdgeStripRenderer == null || rightEdgeStripRenderer == null || leftShoulderRenderer == null || rightShoulderRenderer == null || leftLaneRenderer == null || rightLaneRenderer == null)
            {
                Debug.LogError("RoadOnlyTest capture failed. Expected camera, motion state, road renderer, two road-edge strip renderers, two shoulder renderers, and two yellow-line renderers.");
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
            Material edgeStripMaterial = CreateTextureMaterial(
                "RoadOnly_EdgeWhiteLineStrip_CaptureMaterial",
                LoadTexture(RoadSurfaceSupportImportSettings.RoadEdgeWhiteLineStripAssetPath)
            );
            Material leftShoulderMaterial = CreateTextureMaterial(
                "RoadOnly_LeftDirtShoulder_CaptureMaterial",
                LoadTexture(RoadSurfaceSupportImportSettings.DirtShoulderAssetPath)
            );
            Material rightShoulderMaterial = CreateTextureMaterial(
                "RoadOnly_RightFlowerBorderShoulder_CaptureMaterial",
                LoadTexture(RoadSurfaceSupportImportSettings.RoadsideFlowerBorderAssetPath)
            );
            ConfigureRoadEdgeStrip(leftEdgeStripRenderer, RoadShoulderSide.Left);
            ConfigureRoadEdgeStrip(rightEdgeStripRenderer, RoadShoulderSide.Right);
            ConfigureRoadShoulder(
                leftShoulderRenderer,
                RoadShoulderSide.Left,
                innerRoadMultiplier: 0.92f,
                outerRoadMultiplier: 1.14f,
                nearTint: new Color(0.72f, 0.39f, 0.20f, 0.86f),
                farTint: new Color(0.42f, 0.27f, 0.18f, 0.18f)
            );
            ConfigureRoadShoulder(
                rightShoulderRenderer,
                RoadShoulderSide.Right,
                innerRoadMultiplier: 0.92f,
                outerRoadMultiplier: 1.18f,
                nearTint: new Color(1f, 0.92f, 0.76f, 1f),
                farTint: new Color(0.56f, 0.50f, 0.34f, 0.28f)
            );
            leftEdgeStripRenderer.SetMaterial(edgeStripMaterial);
            rightEdgeStripRenderer.SetMaterial(edgeStripMaterial);
            leftShoulderRenderer.SetMaterial(leftShoulderMaterial);
            rightShoulderRenderer.SetMaterial(rightShoulderMaterial);
            leftLaneRenderer.SetMaterial(yellowLineMaterial);
            rightLaneRenderer.SetMaterial(yellowLineMaterial);
            LogTexture("RoadOnly capture yellow line", yellowLineMaterial);
            LogTexture("RoadOnly capture edge strip", edgeStripMaterial);
            LogTexture("RoadOnly capture left shoulder", leftShoulderMaterial);
            LogTexture("RoadOnly capture right shoulder", rightShoulderMaterial);
            roadRenderer.RebuildMesh();
            crackRenderer?.RebuildMesh();
            leftEdgeStripRenderer.RebuildMesh();
            rightEdgeStripRenderer.RebuildMesh();
            leftShoulderRenderer.RebuildMesh();
            rightShoulderRenderer.RebuildMesh();
            leftLaneRenderer.RebuildMesh();
            rightLaneRenderer.RebuildMesh();

            string screenshotOutputPath = GetScreenshotOutputPath();
            Directory.CreateDirectory(screenshotOutputPath);

            CaptureRoadOnlyVariant(
                camera,
                screenshotOutputPath,
                "road_context_a_viewport_depth_yellow_shoulders",
                writeLegacyNames: false,
                useRoadRelativeYellow: false,
                motionState,
                roadRenderer,
                crackRenderer,
                leftEdgeStripRenderer,
                rightEdgeStripRenderer,
                leftShoulderRenderer,
                rightShoulderRenderer,
                leftLaneRenderer,
                rightLaneRenderer
            );
            CaptureRoadOnlyVariant(
                camera,
                screenshotOutputPath,
                "road_context_b_road_relative_yellow_shoulders",
                writeLegacyNames: true,
                useRoadRelativeYellow: true,
                motionState,
                roadRenderer,
                crackRenderer,
                leftEdgeStripRenderer,
                rightEdgeStripRenderer,
                leftShoulderRenderer,
                rightShoulderRenderer,
                leftLaneRenderer,
                rightLaneRenderer
            );
            AssetDatabase.Refresh();

            Debug.Log("Captured RoadOnlyTest screenshots to: " + screenshotOutputPath);
        }

        private static bool HasRequiredRoadOnlyCaptureObjects()
        {
            return Camera.main != null
                && Object.FindAnyObjectByType<RoadMotionState>(FindObjectsInactive.Exclude) != null
                && GameObject.Find("RoadMesh")?.GetComponent<Pseudo3DRoadRenderer>() != null
                && GameObject.Find("RoadEdgeLeftStrip")?.GetComponent<RoadShoulderRenderer>() != null
                && GameObject.Find("RoadEdgeRightStrip")?.GetComponent<RoadShoulderRenderer>() != null
                && GameObject.Find("RoadShoulderLeftDirt")?.GetComponent<RoadShoulderRenderer>() != null
                && GameObject.Find("RoadShoulderRightFlowers")?.GetComponent<RoadShoulderRenderer>() != null
                && GameObject.Find("LaneYellowLeftMesh")?.GetComponent<LaneMarkingRenderer>() != null
                && GameObject.Find("LaneYellowRightMesh")?.GetComponent<LaneMarkingRenderer>() != null;
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
            int side,
            bool useRoadRelativeProjection
        )
        {
            GameObject laneObject = CreateChild(root, objectName);
            LaneMarkingRenderer laneRenderer = laneObject.AddComponent<LaneMarkingRenderer>();
            laneRenderer.roadRenderer = roadRenderer;
            laneRenderer.motionState = motionState;
            laneRenderer.sliceCount = 72;
            ConfigureYellowLine(laneRenderer, side, useRoadRelativeProjection);
            laneRenderer.SetMaterial(material);
            SetRendererOrder(laneObject, 20);
            laneRenderer.RebuildMesh();
            return laneRenderer;
        }

        private static RoadShoulderRenderer CreateRoadShoulder(
            GameObject root,
            string objectName,
            Pseudo3DRoadRenderer roadRenderer,
            RoadMotionState motionState,
            Material material,
            RoadShoulderSide side,
            float innerRoadMultiplier,
            float outerRoadMultiplier,
            Color nearTint,
            Color farTint
        )
        {
            GameObject shoulderObject = CreateChild(root, objectName);
            RoadShoulderRenderer shoulderRenderer = shoulderObject.AddComponent<RoadShoulderRenderer>();
            shoulderRenderer.roadRenderer = roadRenderer;
            shoulderRenderer.motionState = motionState;
            shoulderRenderer.sliceCount = 72;
            ConfigureRoadShoulder(shoulderRenderer, side, innerRoadMultiplier, outerRoadMultiplier, nearTint, farTint);
            shoulderRenderer.SetMaterial(material);
            SetRendererOrder(shoulderObject, 11);
            shoulderRenderer.RebuildMesh();
            return shoulderRenderer;
        }

        private static RoadShoulderRenderer CreateRoadEdgeStrip(
            GameObject root,
            string objectName,
            Pseudo3DRoadRenderer roadRenderer,
            RoadMotionState motionState,
            Material material,
            RoadShoulderSide side
        )
        {
            GameObject edgeObject = CreateChild(root, objectName);
            RoadShoulderRenderer edgeRenderer = edgeObject.AddComponent<RoadShoulderRenderer>();
            edgeRenderer.roadRenderer = roadRenderer;
            edgeRenderer.motionState = motionState;
            edgeRenderer.sliceCount = 72;
            ConfigureRoadEdgeStrip(edgeRenderer, side);
            edgeRenderer.SetMaterial(material);
            SetRendererOrder(edgeObject, 19);
            edgeRenderer.RebuildMesh();
            return edgeRenderer;
        }

        private static void ConfigureRoadEdgeStrip(RoadShoulderRenderer edgeRenderer, RoadShoulderSide side)
        {
            edgeRenderer.side = side;
            edgeRenderer.useExplicitRoadMultipliers = true;
            edgeRenderer.innerRoadMultiplier = 0.80f;
            edgeRenderer.outerRoadMultiplier = 0.94f;
            edgeRenderer.mapDepthToTextureU = false;
            edgeRenderer.shoulderWidthMultiplier = 0.14f;
            edgeRenderer.textureRepeat = 5.8f;
            edgeRenderer.textureMetersPerRepeat = 42f;
            edgeRenderer.scrollMultiplier = 0.82f;
            edgeRenderer.useDepthAwareMotion = true;
            edgeRenderer.horizonMotionMultiplier = 0.08f;
            edgeRenderer.motionDepthCurve = 1.35f;
            edgeRenderer.useHorizonFade = true;
            edgeRenderer.horizonFadeStartDepth = 0.55f;
            edgeRenderer.horizonAlpha = 0.04f;
            edgeRenderer.nearTint = Color.white;
            edgeRenderer.farTint = new Color(0.74f, 0.64f, 0.55f, 0.26f);
        }

        private static void ConfigureRoadShoulder(
            RoadShoulderRenderer shoulderRenderer,
            RoadShoulderSide side,
            float innerRoadMultiplier,
            float outerRoadMultiplier,
            Color nearTint,
            Color farTint
        )
        {
            shoulderRenderer.side = side;
            shoulderRenderer.useExplicitRoadMultipliers = true;
            shoulderRenderer.innerRoadMultiplier = innerRoadMultiplier;
            shoulderRenderer.outerRoadMultiplier = outerRoadMultiplier;
            shoulderRenderer.mapDepthToTextureU = side == RoadShoulderSide.Right;
            shoulderRenderer.shoulderWidthMultiplier = 0.18f;
            shoulderRenderer.textureRepeat = side == RoadShoulderSide.Left ? 4.2f : 2.1f;
            shoulderRenderer.textureMetersPerRepeat = side == RoadShoulderSide.Left ? 48f : 58f;
            shoulderRenderer.scrollMultiplier = 0.75f;
            shoulderRenderer.useDepthAwareMotion = true;
            shoulderRenderer.horizonMotionMultiplier = 0.08f;
            shoulderRenderer.motionDepthCurve = 1.35f;
            shoulderRenderer.useHorizonFade = true;
            shoulderRenderer.horizonFadeStartDepth = 0.54f;
            shoulderRenderer.horizonAlpha = 0.03f;
            shoulderRenderer.nearTint = nearTint;
            shoulderRenderer.farTint = farTint;
        }

        private static void ConfigureYellowLine(LaneMarkingRenderer laneRenderer, int side, bool useRoadRelativeProjection)
        {
            laneRenderer.textureUMin = 0f;
            laneRenderer.textureUMax = 1f;
            laneRenderer.textureRepeat = 12.5f;
            laneRenderer.textureMetersPerRepeat = 18f;
            laneRenderer.useDepthAwareMotion = true;
            laneRenderer.useHorizonFade = true;
            laneRenderer.horizonFadeStartDepth = 0.55f;
            laneRenderer.horizonAlpha = 0.01f;
            laneRenderer.nearTint = Color.white;
            laneRenderer.farTint = new Color(1f, 0.74f, 0.42f, 1f);

            if (useRoadRelativeProjection)
            {
                laneRenderer.useRoadRelativeWidth = true;
                laneRenderer.useDepthViewportWidth = false;
                laneRenderer.laneWidthRoadRatio = 0.0125f;
                laneRenderer.minLaneHalfWidth = 0.0012f;
                laneRenderer.useDepthViewportCenterOffset = false;
                laneRenderer.centerOffsetRoadRatio = side * 0.032f;
                return;
            }

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
            laneRenderer.centerOffsetRoadRatio = 0f;
        }

        private static void CaptureRoadOnlyVariant(
            Camera camera,
            string screenshotOutputPath,
            string prefix,
            bool writeLegacyNames,
            bool useRoadRelativeYellow,
            RoadMotionState motionState,
            Pseudo3DRoadRenderer roadRenderer,
            Pseudo3DRoadRenderer crackRenderer,
            RoadShoulderRenderer leftEdgeStripRenderer,
            RoadShoulderRenderer rightEdgeStripRenderer,
            RoadShoulderRenderer leftShoulderRenderer,
            RoadShoulderRenderer rightShoulderRenderer,
            LaneMarkingRenderer leftLaneRenderer,
            LaneMarkingRenderer rightLaneRenderer
        )
        {
            ConfigureYellowLine(leftLaneRenderer, side: -1, useRoadRelativeProjection: useRoadRelativeYellow);
            ConfigureYellowLine(rightLaneRenderer, side: 1, useRoadRelativeProjection: useRoadRelativeYellow);
            ConfigureRoadEdgeStrip(leftEdgeStripRenderer, RoadShoulderSide.Left);
            ConfigureRoadEdgeStrip(rightEdgeStripRenderer, RoadShoulderSide.Right);
            ResetMotionOffsets(roadRenderer, leftLaneRenderer, rightLaneRenderer);
            motionState.SetVisualDistanceForReview(0f);
            RebuildAll(roadRenderer, crackRenderer, leftEdgeStripRenderer, rightEdgeStripRenderer, leftShoulderRenderer, rightShoulderRenderer, leftLaneRenderer, rightLaneRenderer);

            Texture2D stillFrame = RenderCamera(camera);
            WritePng(stillFrame, screenshotOutputPath, prefix + "_still.png");

            if (writeLegacyNames)
            {
                WritePng(stillFrame, screenshotOutputPath, "road_only_still.png");
            }

            motionState.SetVisualDistanceForReview(motionState.VisualSpeedMetersPerSecond * 10f);
            RefreshAll(roadRenderer, crackRenderer, leftEdgeStripRenderer, rightEdgeStripRenderer, leftShoulderRenderer, rightShoulderRenderer, leftLaneRenderer, rightLaneRenderer);
            Texture2D motionFrame = RenderCamera(camera);
            WritePng(motionFrame, screenshotOutputPath, prefix + "_10s_motion.png");

            if (writeLegacyNames)
            {
                WritePng(motionFrame, screenshotOutputPath, "road_only_10s_motion.png");
            }

            ResetMotionOffsets(roadRenderer, leftLaneRenderer, rightLaneRenderer);
            motionState.SetVisualDistanceForReview(0f);
            RebuildAll(roadRenderer, crackRenderer, leftEdgeStripRenderer, rightEdgeStripRenderer, leftShoulderRenderer, rightShoulderRenderer, leftLaneRenderer, rightLaneRenderer);
            RenderCropToPng(camera, screenshotOutputPath, prefix + "_lane_horizon_closeup.png", new RectInt(420, 860, 240, 300));
            RenderCropToPng(camera, screenshotOutputPath, prefix + "_road_bottom_closeup.png", new RectInt(90, 80, 900, 420));

            if (writeLegacyNames)
            {
                RenderCropToPng(camera, screenshotOutputPath, "road_only_lane_horizon_closeup.png", new RectInt(420, 860, 240, 300));
                RenderCropToPng(camera, screenshotOutputPath, "road_only_road_bottom_closeup.png", new RectInt(90, 80, 900, 420));
            }

            Object.DestroyImmediate(stillFrame);
            Object.DestroyImmediate(motionFrame);
        }

        private static void ResetMotionOffsets(Pseudo3DRoadRenderer roadRenderer, params LaneMarkingRenderer[] lineRenderers)
        {
            roadRenderer.textureOffset = 0f;

            foreach (LaneMarkingRenderer renderer in lineRenderers)
            {
                renderer.textureOffset = 0f;
            }
        }

        private static void RebuildAll(
            Pseudo3DRoadRenderer roadRenderer,
            Pseudo3DRoadRenderer crackRenderer,
            RoadShoulderRenderer leftEdgeStripRenderer,
            RoadShoulderRenderer rightEdgeStripRenderer,
            RoadShoulderRenderer leftShoulderRenderer,
            RoadShoulderRenderer rightShoulderRenderer,
            params LaneMarkingRenderer[] lineRenderers
        )
        {
            roadRenderer.RebuildMesh();
            crackRenderer?.RebuildMesh();
            leftEdgeStripRenderer.RebuildMesh();
            rightEdgeStripRenderer.RebuildMesh();
            leftShoulderRenderer.RebuildMesh();
            rightShoulderRenderer.RebuildMesh();

            foreach (LaneMarkingRenderer renderer in lineRenderers)
            {
                renderer.RebuildMesh();
            }
        }

        private static void RefreshAll(
            Pseudo3DRoadRenderer roadRenderer,
            Pseudo3DRoadRenderer crackRenderer,
            RoadShoulderRenderer leftEdgeStripRenderer,
            RoadShoulderRenderer rightEdgeStripRenderer,
            RoadShoulderRenderer leftShoulderRenderer,
            RoadShoulderRenderer rightShoulderRenderer,
            params LaneMarkingRenderer[] lineRenderers
        )
        {
            roadRenderer.RefreshMotionForReview();
            crackRenderer?.RefreshMotionForReview();
            leftEdgeStripRenderer.RefreshMotionForReview();
            rightEdgeStripRenderer.RefreshMotionForReview();
            leftShoulderRenderer.RefreshMotionForReview();
            rightShoulderRenderer.RefreshMotionForReview();

            foreach (LaneMarkingRenderer renderer in lineRenderers)
            {
                renderer.RefreshMotionForReview();
            }
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
